import { Inject, Injectable } from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import { randomUUID } from 'node:crypto';
import { asService } from '../../../../libs/api/auth.js';
import { ApiError, assertVersion, type ApiRequest } from '../../../../libs/api/errors.js';
import { DATABASE, type Database } from '../../../../libs/database/database.module.js';
import type { DB } from '../../../../libs/database/schema.js';
import type { CreateTemperatureConfigDto } from './temperature-configs.dto.js';

type Principal = NonNullable<ApiRequest['principal']>;

@Injectable()
export class TemperatureConfigsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  private audit(tx: Transaction<DB>, action: string, entity: string, id: string, actor: string, payload: Record<string, string | number>) {
    return tx.insertInto('audit_logs').values({ action, entity, entity_id: id, actor_id: actor, payload, created_at: new Date() }).execute();
  }

  private async scopedTrip(tx: Transaction<DB>, principal: Principal, id: string) {
    if (!['admin', 'driver'].includes(principal.roleCode)) throw new ApiError('NOT_FOUND');
    let query = tx.selectFrom('trips').selectAll().where('id', '=', id);
    if (principal.roleCode === 'driver') query = query.where('driver_id', '=', principal.userId);
    const trip = await query.executeTakeFirst();
    if (!trip) throw new ApiError('NOT_FOUND');
    return trip;
  }

  async create(principal: Principal, id: string, body: CreateTemperatureConfigDto) {
    if (principal.roleCode !== 'admin') throw new ApiError('FORBIDDEN');
    if (!Number.isFinite(body.target_min) || !Number.isFinite(body.target_max) || body.target_min < -25 || body.target_max > -15 ||
        body.target_max - body.target_min < 2 || !Number.isInteger(body.target_min * 2) || !Number.isInteger(body.target_max * 2)) {
      throw new ApiError('VALIDATION_FAILED');
    }
    return asService(this.db, async tx => {
      // Parent -> trip -> device agrees with depart and shipment cancellation.
      const scope = await tx.selectFrom('trips').select('shipment_id').where('id', '=', id).executeTakeFirst();
      if (!scope) throw new ApiError('NOT_FOUND');
      const shipment = await tx.selectFrom('shipments').select('id').where('id', '=', scope.shipment_id)
        .where('deleted_at', 'is', null).forUpdate().executeTakeFirst();
      const trip = await tx.selectFrom('trips').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();
      if (!shipment || !trip) throw new ApiError('NOT_FOUND');
      if (!['scheduled', 'in_transit'].includes(trip.status)) throw new ApiError('UNPROCESSABLE');
      assertVersion(trip, body.version);
      const device = await tx.selectFrom('devices').selectAll().where('id', '=', trip.device_id).forUpdate().executeTakeFirstOrThrow();
      const number = device.next_config_version_no;
      await tx.updateTable('devices').set({ next_config_version_no: sql<number>`next_config_version_no + 1` }).where('id', '=', device.id).execute();
      const superseded = await tx.updateTable('temperature_config_versions').set({ status: 'superseded',
        version: sql<number>`version + 1`, updated_at: new Date() }).where('device_id', '=', device.id)
        .where('status', 'in', ['approved', 'sent']).returning(['id', 'config_version_no']).execute();
      for (const previous of superseded) await this.audit(tx, 'temperature_configs.supersede', 'temperature_config_versions', previous.id,
        principal.userId, { device_id: device.id, config_version_no: previous.config_version_no });
      const failed = await tx.updateTable('device_commands').set({ status: 'failed', failure_reason: 'superseded_command', updated_at: new Date() })
        .where('device_id', '=', device.id).where('status', 'in', ['queued', 'sent']).returning(['command_id']).execute();
      for (const previous of failed) await this.audit(tx, 'device_commands.supersede', 'device_commands', previous.command_id,
        principal.userId, { device_id: device.id });
      const issued = (await sql<{ now: Date }>`select clock_timestamp() as now`.execute(tx)).rows[0].now;
      const expires = new Date(issued.getTime() + 30000);
      const config = await tx.insertInto('temperature_config_versions').values({ device_id: device.id, trip_id: trip.id,
        config_version_no: number, target_min: body.target_min, target_max: body.target_max,
        status: 'approved', issued_by: principal.userId, issued_at: issued,
      }).returningAll().executeTakeFirstOrThrow();
      const commandId = randomUUID();
      const payload = { schema_version: 1, command_id: commandId, type: 'set_target_range', config_version_no: number,
        target_min: body.target_min, target_max: body.target_max, issued_at: issued.toISOString(), expires_at: expires.toISOString() };
      await tx.insertInto('device_commands').values({ command_id: commandId, type: 'set_target_range', device_id: device.id,
        trip_id: trip.id, config_version_id: config.id, payload, issued_at: issued, expires_at: expires,
        status: 'queued', issued_by: principal.userId,
      }).execute();
      const outbox = await tx.insertInto('outbox_events').values({ topic: 'device_command.enqueued',
        payload: { command_id: commandId, device_id: device.id }, status: 'pending',
      }).returning('id').executeTakeFirstOrThrow();
      await this.audit(tx, 'temperature_configs.create', 'temperature_config_versions', config.id, principal.userId,
        { device_id: device.id, trip_id: trip.id, config_version_no: number });
      await this.audit(tx, 'device_commands.create', 'device_commands', commandId, principal.userId,
        { device_id: device.id, config_version_id: config.id });
      await this.audit(tx, 'outbox_events.create', 'outbox_events', outbox.id, principal.userId, { command_id: commandId });
      await this.audit(tx, 'devices.allocate_config_version', 'devices', device.id, principal.userId, { config_version_no: number });
      // Deliberate 2.5 policy: validate, but DO NOT increment trips.version.
      // Two concurrent requests with the same trip version may both succeed;
      // the device lock gives distinct numbers and the later config supersedes.
      return { ...config, command_id: commandId };
    });
  }

  async list(principal: Principal, id: string) {
    return asService(this.db, async tx => {
      await this.scopedTrip(tx, principal, id);
      return tx.selectFrom('temperature_config_versions').selectAll().where('trip_id', '=', id).orderBy('config_version_no').execute();
    });
  }

  async command(principal: Principal, id: string) {
    if (!['admin', 'driver'].includes(principal.roleCode)) throw new ApiError('NOT_FOUND');
    return asService(this.db, async tx => {
      let query = tx.selectFrom('device_commands as c').leftJoin('trips as t', 't.id', 'c.trip_id')
        .select(['c.id', 'c.command_id', 'c.device_id', 'c.trip_id', 'c.type', 'c.status', 'c.failure_reason', 'c.issued_at', 'c.expires_at'])
        .where('c.command_id', '=', id);
      if (principal.roleCode === 'driver') query = query.where('t.driver_id', '=', principal.userId);
      const command = await query.executeTakeFirst();
      if (!command) throw new ApiError('NOT_FOUND');
      const { id: internalId, ...response } = command;
      const acks = await tx.selectFrom('device_command_acks').select(['ack_id', 'result', 'reason', 'retry_after_seconds', 'received_at'])
        .where('command_id', '=', internalId).orderBy('received_at').orderBy('id').execute();
      return { ...response, acks };
    });
  }
}
