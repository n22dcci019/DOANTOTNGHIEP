import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sql, type Transaction } from 'kysely';
import { randomUUID } from 'node:crypto';
import { asService } from '../../../../libs/api/auth.js';
import { ApiError, assertVersion, type ApiRequest } from '../../../../libs/api/errors.js';
import { proofFormat } from '../../../../libs/api/proof-upload.js';
import { DATABASE, type Database } from '../../../../libs/database/database.module.js';
import type { DB } from '../../../../libs/database/schema.js';
import type { TripNotesDto, TripProofDto, TripVersionDto } from './trips.dto.js';

type Principal = NonNullable<ApiRequest['principal']>;

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);
  private storageClient?: SupabaseClient;
  constructor(@Inject(DATABASE) private readonly db: Database, private readonly config: ConfigService) {}

  private storage() {
    return (this.storageClient ??= createClient(this.config.getOrThrow<string>('SUPABASE_URL'),
      this.config.get<string>('SUPABASE_SECRET_KEY') || this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'), {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15000) }) },
      })).storage.from('delivery-proofs');
  }

  private driver(principal: Principal) {
    if (principal.roleCode !== 'driver') throw new ApiError('FORBIDDEN');
  }

  private async locked(tx: Transaction<DB>, principal: Principal, id: string) {
    const scoped = await tx.selectFrom('trips').select('shipment_id').where('id', '=', id)
      .where('driver_id', '=', principal.userId).executeTakeFirst();
    if (!scoped) throw new ApiError('NOT_FOUND');
    // Same parent -> trip lock order as shipments.cancel, avoiding cross-action deadlocks.
    const shipment = await tx.selectFrom('shipments').selectAll().where('id', '=', scoped.shipment_id)
      .where('deleted_at', 'is', null).forUpdate().executeTakeFirst();
    const trip = await tx.selectFrom('trips').selectAll().where('id', '=', id).where('shipment_id', '=', scoped.shipment_id)
      .where('driver_id', '=', principal.userId).forUpdate().executeTakeFirst();
    if (!shipment || !trip) throw new ApiError('NOT_FOUND');
    return { trip, shipment };
  }

  private audit(tx: Transaction<DB>, action: string, entity: string, id: string, actor: string, payload: Record<string, string | number>) {
    return tx.insertInto('audit_logs').values({ action, entity, entity_id: id, actor_id: actor, payload, created_at: new Date() }).execute();
  }

  async list(principal: Principal) {
    if (!['admin', 'driver'].includes(principal.roleCode)) throw new ApiError('NOT_FOUND');
    return asService(this.db, tx => {
      let query = tx.selectFrom('trips').selectAll();
      if (principal.roleCode === 'driver') query = query.where('driver_id', '=', principal.userId);
      return query.orderBy('created_at').orderBy('id').execute();
    });
  }

  async get(principal: Principal, id: string) {
    if (!['admin', 'driver'].includes(principal.roleCode)) throw new ApiError('NOT_FOUND');
    return asService(this.db, async tx => {
      let query = tx.selectFrom('trips').selectAll().where('id', '=', id);
      if (principal.roleCode === 'driver') query = query.where('driver_id', '=', principal.userId);
      const trip = await query.executeTakeFirst();
      if (!trip) throw new ApiError('NOT_FOUND');
      return trip;
    });
  }

  async depart(principal: Principal, id: string, body: TripVersionDto) {
    this.driver(principal);
    return asService(this.db, async tx => {
      const { trip, shipment } = await this.locked(tx, principal, id);
      // State precedes version here so concurrent depart requests yield 200/422,
      // as required. A stale version on a still-scheduled trip yields 409.
      if (trip.status !== 'scheduled' || shipment.status !== 'scheduled') throw new ApiError('UNPROCESSABLE');
      assertVersion(trip, body.version);
      const fresh = await tx.selectFrom('device_latest_state').select('device_id').where('device_id', '=', trip.device_id)
        .where('last_fresh_sample_at', '>=', sql<Date>`clock_timestamp() - interval '60 seconds'`)
        .where('last_fresh_sample_at', '<=', sql<Date>`clock_timestamp()`).executeTakeFirst();
      if (!fresh) throw new ApiError('UNPROCESSABLE');
      // TODO(BE-2.5): resolve this trip's approved configuration and verify the
      // telemetry config_version_no. 2.4 exercises trips without a configuration;
      // no ACK applied requirement is introduced here.
      const updated = await tx.updateTable('trips').set({ status: 'in_transit', departed_at: sql<Date>`clock_timestamp()`,
        version: sql<number>`version + 1`, updated_at: new Date() }).where('id', '=', id).returningAll().executeTakeFirstOrThrow();
      await tx.updateTable('shipments').set({ status: 'in_transit', version: sql<number>`version + 1`, updated_at: new Date() })
        .where('id', '=', shipment.id).execute();
      await this.audit(tx, 'trips.depart', 'trips', id, principal.userId, { version: updated.version, status: 'in_transit' });
      await this.audit(tx, 'shipments.depart', 'shipments', shipment.id, principal.userId, { trip_id: id, version: shipment.version + 1, status: 'in_transit' });
      return updated;
    });
  }

  async complete(principal: Principal, id: string, body: TripVersionDto) {
    this.driver(principal);
    return asService(this.db, async tx => {
      const { trip, shipment } = await this.locked(tx, principal, id);
      if (trip.status !== 'in_transit' || shipment.status !== 'in_transit') throw new ApiError('UNPROCESSABLE');
      assertVersion(trip, body.version);
      const proof = await tx.selectFrom('delivery_proofs').select('id').where('trip_id', '=', id).executeTakeFirst();
      if (!proof) throw new ApiError('UNPROCESSABLE');
      const updated = await tx.updateTable('trips').set({ status: 'completed', completed_at: sql<Date>`clock_timestamp()`,
        result: 'pending_evaluation', version: sql<number>`version + 1`, updated_at: new Date() })
        .where('id', '=', id).returningAll().executeTakeFirstOrThrow();
      await tx.updateTable('shipments').set({ status: 'completed', version: sql<number>`version + 1`, updated_at: new Date() })
        .where('id', '=', shipment.id).execute();
      await this.audit(tx, 'trips.complete', 'trips', id, principal.userId, { version: updated.version, status: 'completed', result: 'pending_evaluation' });
      await this.audit(tx, 'shipments.complete', 'shipments', shipment.id, principal.userId, { trip_id: id, version: shipment.version + 1, status: 'completed' });
      return updated;
    });
  }

  async notes(principal: Principal, id: string, body: TripNotesDto) {
    this.driver(principal);
    return asService(this.db, async tx => {
      const { trip, shipment } = await this.locked(tx, principal, id);
      if (!['scheduled', 'in_transit'].includes(trip.status) || shipment.status !== trip.status) throw new ApiError('UNPROCESSABLE');
      assertVersion(trip, body.version);
      const updated = await tx.updateTable('trips').set({ driver_notes: body.driver_notes, version: sql<number>`version + 1`, updated_at: new Date() })
        .where('id', '=', id).returningAll().executeTakeFirstOrThrow();
      await this.audit(tx, 'trips.update_notes', 'trips', id, principal.userId, { version: updated.version });
      return updated;
    });
  }

  async proof(principal: Principal, id: string, body: TripProofDto, file: Express.Multer.File, requestId: string) {
    this.driver(principal);
    const format = proofFormat(file);
    const path = `proofs/${id}/${randomUUID()}.${format.ext}`;
    let uploaded = false;
    try {
      return await asService(this.db, async tx => {
        const { trip, shipment } = await this.locked(tx, principal, id);
        if (trip.status !== 'in_transit' || shipment.status !== 'in_transit') throw new ApiError('UNPROCESSABLE');
        const duplicate = await tx.selectFrom('delivery_proofs').select('id').where('trip_id', '=', id).executeTakeFirst();
        if (duplicate) throw new ApiError('CONFLICT');
        assertVersion(trip, body.version);
        const result = await this.storage().upload(path, file.buffer, { contentType: format.mime, upsert: false });
        if (result.error) {
          this.logger.error(`[${requestId}] Proof Storage upload failed`);
          throw new ApiError('INTERNAL');
        }
        uploaded = true;
        const proof = await tx.insertInto('delivery_proofs').values({ trip_id: id, photo_path: path,
          signed_by: body.signed_by, received_at: new Date(), created_by: principal.userId }).returningAll().executeTakeFirstOrThrow();
        await tx.updateTable('trips').set({ version: sql<number>`version + 1`, updated_at: new Date() }).where('id', '=', id).execute();
        await this.audit(tx, 'delivery_proofs.create', 'delivery_proofs', proof.id, principal.userId, { trip_id: id });
        await this.audit(tx, 'trips.proof', 'trips', id, principal.userId, { proof_id: proof.id, version: trip.version + 1 });
        return { ...proof, trip_version: trip.version + 1 };
      });
    } catch (error) {
      if (uploaded) {
        try {
          const result = await this.storage().remove([path]);
          if (result.error) throw result.error;
        } catch {
          this.logger.error(`[${requestId}] Proof Storage compensation failed; manual cleanup required path=${path}`);
          throw new ApiError('INTERNAL');
        }
      }
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') throw new ApiError('CONFLICT');
      throw error;
    }
  }
}
