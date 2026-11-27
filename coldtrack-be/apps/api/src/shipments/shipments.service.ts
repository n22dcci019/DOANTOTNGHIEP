import { Inject, Injectable } from '@nestjs/common';
import { sql, type Selectable, type Transaction } from 'kysely';
import { asService } from '../../../../libs/api/auth.js';
import { ApiError, assertVersion, type ApiRequest } from '../../../../libs/api/errors.js';
import { DATABASE, type Database } from '../../../../libs/database/database.module.js';
import type { DB, Shipments } from '../../../../libs/database/schema.js';
import type { AssignShipmentDto, CreateShipmentDto, RejectShipmentDto, ShipmentVersionDto, UpdateShipmentDto } from './shipments.dto.js';

type Principal = NonNullable<ApiRequest['principal']>;
type Shipment = Selectable<Shipments>;
const isUnique = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';

@Injectable()
export class ShipmentsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  private requireRole(principal: Principal, roles: string[]) {
    if (!roles.includes(principal.roleCode)) throw new ApiError('FORBIDDEN');
  }

  private validateRange(min: number, max: number) {
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < -25 || max > -15 ||
        max - min < 2 || !Number.isInteger(min * 2) || !Number.isInteger(max * 2)) {
      throw new ApiError('VALIDATION_FAILED');
    }
  }

  private async transaction<T>(run: (tx: Transaction<DB>) => Promise<T>): Promise<T> {
    try { return await asService(this.db, run); }
    catch (error) {
      if (isUnique(error)) throw new ApiError('CONFLICT');
      throw error;
    }
  }

  private audit(tx: Transaction<DB>, action: string, entity: string, id: string, actor: string, payload: Record<string, string | number>) {
    return tx.insertInto('audit_logs').values({
      action, entity, entity_id: id, actor_id: actor, payload, created_at: new Date(),
    }).execute();
  }

  private async locked(tx: Transaction<DB>, id: string, principal: Principal, version: number): Promise<Shipment> {
    let query = tx.selectFrom('shipments').selectAll().where('id', '=', id).where('deleted_at', 'is', null);
    if (principal.roleCode === 'customer') query = query.where('customer_id', '=', principal.userId);
    const shipment = await query.forUpdate().executeTakeFirst();
    // Scope is evaluated before version/status, so another customer's rows always
    // look identical to a nonexistent row.
    if (!shipment) throw new ApiError('NOT_FOUND');
    assertVersion(shipment, version);
    return shipment;
  }

  private requireStatus(shipment: Shipment, allowed: string[]) {
    if (!allowed.includes(shipment.status)) throw new ApiError('UNPROCESSABLE');
  }

  async create(principal: Principal, body: CreateShipmentDto) {
    this.requireRole(principal, ['customer']);
    this.validateRange(body.temp_min, body.temp_max);
    return this.transaction(async tx => {
      // Create has no existing entity version; DB initializes it to 1. All
      // subsequent writes require the version the caller read.
      const shipment = await tx.insertInto('shipments').values({
        customer_id: principal.userId, product_type: body.product_type,
        temp_min: body.temp_min, temp_max: body.temp_max, warehouse_notes: body.warehouse_notes,
        status: 'draft',
      }).returningAll().executeTakeFirstOrThrow();
      await this.audit(tx, 'shipments.create', 'shipments', shipment.id, principal.userId, { status: 'draft', version: shipment.version });
      return shipment;
    });
  }

  async list(principal: Principal) {
    if (!['admin', 'customer'].includes(principal.roleCode)) throw new ApiError('NOT_FOUND');
    return asService(this.db, tx => {
      let query = tx.selectFrom('shipments').selectAll().where('deleted_at', 'is', null);
      if (principal.roleCode === 'customer') query = query.where('customer_id', '=', principal.userId);
      return query.orderBy('created_at').orderBy('id').execute();
    });
  }

  async get(principal: Principal, id: string) {
    if (!['admin', 'customer'].includes(principal.roleCode)) throw new ApiError('NOT_FOUND');
    return asService(this.db, async tx => {
      let query = tx.selectFrom('shipments').selectAll().where('id', '=', id).where('deleted_at', 'is', null);
      if (principal.roleCode === 'customer') query = query.where('customer_id', '=', principal.userId);
      const shipment = await query.executeTakeFirst();
      if (!shipment) throw new ApiError('NOT_FOUND');
      return shipment;
    });
  }

  async update(principal: Principal, id: string, body: UpdateShipmentDto) {
    this.requireRole(principal, ['customer']);
    return this.transaction(async tx => {
      const shipment = await this.locked(tx, id, principal, body.version);
      this.requireStatus(shipment, ['draft', 'pending_review']);
      this.validateRange(body.temp_min ?? Number(shipment.temp_min), body.temp_max ?? Number(shipment.temp_max));
      const updated = await tx.updateTable('shipments').set({
        ...(body.product_type !== undefined ? { product_type: body.product_type } : {}),
        ...(body.temp_min !== undefined ? { temp_min: body.temp_min } : {}),
        ...(body.temp_max !== undefined ? { temp_max: body.temp_max } : {}),
        ...(body.warehouse_notes !== undefined ? { warehouse_notes: body.warehouse_notes } : {}),
        version: sql<number>`version + 1`, updated_at: new Date(),
      }).where('id', '=', id).where('version', '=', body.version).returningAll().executeTakeFirstOrThrow();
      await this.audit(tx, 'shipments.update', 'shipments', id, principal.userId, { version: updated.version });
      return updated;
    });
  }

  async transition(principal: Principal, id: string, action: 'submit' | 'approve' | 'reject', body: ShipmentVersionDto | RejectShipmentDto) {
    this.requireRole(principal, action === 'submit' ? ['customer'] : ['admin']);
    return this.transaction(async tx => {
      const shipment = await this.locked(tx, id, principal, body.version);
      this.requireStatus(shipment, action === 'submit' ? ['draft'] : ['pending_review']);
      const status = { submit: 'pending_review', approve: 'approved', reject: 'rejected' }[action];
      const updated = await tx.updateTable('shipments').set({
        status, version: sql<number>`version + 1`, updated_at: new Date(),
        ...(action !== 'submit' ? { reviewed_by: principal.userId, reviewed_at: new Date() } : {}),
        ...(action === 'reject' ? { rejected_reason: (body as RejectShipmentDto).rejected_reason } : {}),
      }).where('id', '=', id).where('version', '=', body.version).returningAll().executeTakeFirstOrThrow();
      await this.audit(tx, `shipments.${action}`, 'shipments', id, principal.userId, { status, version: updated.version });
      return updated;
    });
  }

  async assign(principal: Principal, id: string, body: AssignShipmentDto) {
    this.requireRole(principal, ['admin']);
    return this.transaction(async tx => {
      const shipment = await this.locked(tx, id, principal, body.version);
      this.requireStatus(shipment, ['approved']);
      // Lock resources in the same order for every assignment. Checks and insert
      // share this transaction; the existing partial unique indexes are the last
      // line of defense against an overlapping scheduled/in_transit trip.
      const vehicle = await tx.selectFrom('vehicles').selectAll().where('id', '=', body.vehicle_id).forUpdate().executeTakeFirst();
      const driver = await tx.selectFrom('account_access as a').innerJoin('roles as r', 'r.id', 'a.role_id')
        .select(['a.status', 'r.code']).where('a.user_id', '=', body.driver_id).forUpdate('a').executeTakeFirst();
      const device = await tx.selectFrom('devices').selectAll().where('id', '=', body.device_id).forUpdate().executeTakeFirst();
      if (!vehicle || !driver || !device) throw new ApiError('NOT_FOUND');
      if (vehicle.status !== 'active' || driver.status !== 'active' || driver.code !== 'driver' || device.status !== 'active') {
        throw new ApiError('UNPROCESSABLE');
      }
      if (vehicle.temp_capacity_min === null || vehicle.temp_capacity_max === null ||
          Number(vehicle.temp_capacity_min) > Number(shipment.temp_min) || Number(vehicle.temp_capacity_max) < Number(shipment.temp_max)) {
        throw new ApiError('UNPROCESSABLE');
      }
      const busy = await tx.selectFrom('trips').select('id').where('status', 'in', ['scheduled', 'in_transit'])
        .where(eb => eb.or([
          eb('vehicle_id', '=', body.vehicle_id), eb('driver_id', '=', body.driver_id),
          eb('device_id', '=', body.device_id), eb('shipment_id', '=', id),
        ])).executeTakeFirst();
      if (busy) throw new ApiError('CONFLICT');
      const trip = await tx.insertInto('trips').values({
        shipment_id: id, vehicle_id: body.vehicle_id, driver_id: body.driver_id, device_id: body.device_id, status: 'scheduled',
      }).returningAll().executeTakeFirstOrThrow();
      const updated = await tx.updateTable('shipments').set({
        status: 'scheduled', version: sql<number>`version + 1`, updated_at: new Date(),
      }).where('id', '=', id).where('version', '=', body.version).returningAll().executeTakeFirstOrThrow();
      await this.audit(tx, 'trips.create', 'trips', trip.id, principal.userId, { shipment_id: id, status: 'scheduled', version: trip.version });
      await this.audit(tx, 'shipments.assign', 'shipments', id, principal.userId, { trip_id: trip.id, status: 'scheduled', version: updated.version });
      return { ...updated, trip };
    });
  }

  async cancel(principal: Principal, id: string, body: ShipmentVersionDto) {
    this.requireRole(principal, ['customer', 'admin']);
    return this.transaction(async tx => {
      const shipment = await this.locked(tx, id, principal, body.version);
      this.requireStatus(shipment, principal.roleCode === 'admin' ? ['draft', 'pending_review', 'approved', 'scheduled'] : ['draft', 'pending_review']);
      if (shipment.status === 'scheduled') {
        const trip = await tx.selectFrom('trips').selectAll().where('shipment_id', '=', id)
          .where('status', '=', 'scheduled').forUpdate().executeTakeFirst();
        if (!trip) throw new ApiError('UNPROCESSABLE');
        await tx.updateTable('trips').set({ status: 'cancelled', version: sql<number>`version + 1`, updated_at: new Date() })
          .where('id', '=', trip.id).execute();
        await this.audit(tx, 'trips.cancel', 'trips', trip.id, principal.userId, { shipment_id: id, status: 'cancelled', version: trip.version + 1 });
      }
      const updated = await tx.updateTable('shipments').set({
        status: 'cancelled', version: sql<number>`version + 1`, updated_at: new Date(),
      }).where('id', '=', id).where('version', '=', body.version).returningAll().executeTakeFirstOrThrow();
      await this.audit(tx, 'shipments.cancel', 'shipments', id, principal.userId, { status: 'cancelled', version: updated.version });
      return updated;
    });
  }
}
