import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Logger, Module, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import pg from 'pg';
import { ApiModule, configureApi } from '../libs/api/api.module.js';
import { ShipmentsModule } from '../apps/api/src/shipments/shipments.module.js';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: resolve('..', '.env') }), ApiModule, ShipmentsModule] })
class ShipmentTestModule {}

type Shipment = { id: string; customer_id: string; product_type: string; temp_min: string; temp_max: string;
  status: string; version: number; rejected_reason?: string; trip?: { id: string; version: number; status: string; vehicle_id: string; driver_id: string; device_id: string } };
type Resources = { vehicle_id: string; driver_id: string; device_id: string };

describe('shipments API 2.3 (real PostgreSQL and Supabase Auth)', () => {
  const env = { ...parse(readFileSync('../.env')), ...process.env };
  const db = new pg.Client({ connectionString: env.DATABASE_URL });
  let app: INestApplication | undefined;
  let base: string;
  let auth: SupabaseClient;
  let login: SupabaseClient;
  const accounts: Record<string, { id: string; token: string }> = {};
  const ids = new Set<string>();
  const prefix = `be23-${randomUUID().slice(0, 8)}`;
  const logger = { log: () => undefined, debug: () => undefined, verbose: () => undefined, warn: () => undefined, error: () => undefined };

  async function account(name: string, role: string, authenticate = false) {
    const email = `${prefix}-${randomUUID().slice(0, 8)}@example.test`; const password = `Test-${randomUUID()}!`;
    const created = await auth.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error('Auth fixture creation failed');
    const id = created.data.user.id;
    await db.query('insert into public.profiles(id,full_name,email) values($1,$2,$3)', [id, name, email]);
    await db.query("insert into public.account_access(user_id,role_id,status) select $1,id,'active' from public.roles where code=$2", [id, role]);
    let token = '';
    if (authenticate) {
      const session = await login.auth.signInWithPassword({ email, password });
      if (session.error || !session.data.session) throw new Error('Auth fixture login failed');
      token = session.data.session.access_token;
    }
    return { id, token };
  }

  beforeAll(async () => {
    const status = JSON.parse(execFileSync(process.execPath, [resolve('node_modules/supabase/dist/supabase.js'),
      'status', '--workdir', '..', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })) as {
        API_URL: string; SERVICE_ROLE_KEY: string; ANON_KEY: string;
      };
    auth = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    login = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    await db.connect();
    for (const [name, role] of [['admin', 'admin'], ['a', 'customer'], ['b', 'customer'], ['driver', 'driver']]) accounts[name] = await account(name, role, true);
    Logger.overrideLogger(logger);
    app = await NestFactory.create(ShipmentTestModule, { logger }); configureApi(app);
    await app.listen(0, '127.0.0.1'); base = `${await app.getUrl()}/api/v1`;
  }, 60000);

  afterAll(async () => {
    await app?.close(); Logger.overrideLogger(new Logger()); await db.end();
    // Successful API writes commit append-only audits. Run this suite after the
    // isolated baseline suites and before test:seed resets DB; never delete audit
    // history or weaken FK/permissions merely to clean up fixtures.
  });

  function request(path: string, who = 'a', method = 'GET', body?: unknown, key: string | null = randomUUID()) {
    return fetch(`${base}${path}`, { method, headers: {
      Authorization: `Bearer ${accounts[who].token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  }
  async function error(response: Response, status: number, code: string) {
    expect(response.status).toBe(status);
    const body = await response.json() as { error: { code: string; message: string; details: unknown; request_id: string } };
    expect(Object.keys(body)).toEqual(['error']);
    expect(Object.keys(body.error).sort()).toEqual(['code', 'details', 'message', 'request_id']);
    expect(body.error.code).toBe(code); expect(typeof body.error.message).toBe('string');
    expect(body.error.request_id).toBe(response.headers.get('X-Request-Id')); expect(body.error.request_id).toBeTruthy();
    expect(JSON.stringify(body)).not.toMatch(/SQL|23505|23514|constraint|stack|trips_one_live|audit_logs/);
    if (code !== 'VERSION_CONFLICT') expect(body.error.details).toBeNull();
    return body.error;
  }
  async function create(who = 'a', extra: Record<string, unknown> = {}) {
    const response = await request('/shipments', who, 'POST', { product_type: prefix, temp_min: -20, temp_max: -18, ...extra });
    expect(response.status).toBe(201); const shipment = await response.json() as Shipment; ids.add(shipment.id); return shipment;
  }
  async function move(shipment: Shipment, action: string, who = 'admin', extra: Record<string, unknown> = {}) {
    const response = await request(`/shipments/${shipment.id}/${action}`, who, 'POST', { version: shipment.version, ...extra });
    expect(response.status).toBe(200); return await response.json() as Shipment;
  }
  async function pending(who = 'a') { return move(await create(who), 'submit', who); }
  async function approved(who = 'a') { return move(await pending(who), 'approve'); }
  async function resources(driverId?: string): Promise<Resources> {
    const vehicle = randomUUID(); const device = randomUUID();
    const driver = driverId ?? (await account('fixture driver', 'driver')).id;
    await db.query('insert into public.vehicles(id,plate,temp_capacity_min,temp_capacity_max) values($1,$2,-25,-15)', [vehicle, `${prefix}-${randomUUID()}`]);
    await db.query('insert into public.devices(id,device_code,vehicle_id) values($1,$2,$3)', [device, `${prefix}-${randomUUID()}`, vehicle]);
    await db.query('insert into public.device_assignments(device_id,vehicle_id,valid_from) values($1,$2,now())', [device, vehicle]);
    return { vehicle_id: vehicle, driver_id: driver, device_id: device };
  }

  it('a: the same 10 migrations supply all shipment/trip constraints', async () => {
    expect((await db.query('select count(*)::int as n from supabase_migrations.schema_migrations')).rows[0].n).toBe(10);
    const indexes = await db.query("select indexname from pg_indexes where indexname like 'trips_one_live_%'");
    expect(indexes.rows.map(r => r.indexname).sort()).toEqual(['trips_one_live_device', 'trips_one_live_driver', 'trips_one_live_shipment', 'trips_one_live_vehicle']);
  });
  it('b: customer creates draft/version 1 and cannot choose its customer_id', async () => {
    const shipment = await create('a', { customer_id: accounts.b.id });
    expect(shipment).toMatchObject({ status: 'draft', version: 1, customer_id: accounts.a.id });
    expect((await db.query('select customer_id from public.shipments where id=$1', [shipment.id])).rows[0].customer_id).toBe(accounts.a.id);
  });
  it('c: invalid width, boundaries and quarter-degree values fail validation', async () => {
    for (const [min, max] of [[-20, -18.5], [-25.5, -18], [-20, -14.5], [-20.25, -18]]) {
      await error(await request('/shipments', 'a', 'POST', { product_type: prefix, temp_min: min, temp_max: max }), 400, 'VALIDATION_FAILED');
    }
  });
  it('d: customer edits draft/pending_review; approved/scheduled/rejected edits return 422', async () => {
    let shipment = await create();
    let response = await request(`/shipments/${shipment.id}`, 'a', 'PATCH', { version: shipment.version, warehouse_notes: 'Draft updated' });
    expect(response.status).toBe(200); shipment = await response.json() as Shipment;
    shipment = await move(shipment, 'submit', 'a');
    response = await request(`/shipments/${shipment.id}`, 'a', 'PATCH', { version: shipment.version, product_type: `${prefix} pending` });
    expect(response.status).toBe(200); shipment = await response.json() as Shipment;
    shipment = await move(shipment, 'approve');
    await error(await request(`/shipments/${shipment.id}`, 'a', 'PATCH', { version: shipment.version, warehouse_notes: 'Denied' }), 422, 'UNPROCESSABLE');
    shipment = await move(shipment, 'assign', 'admin', await resources());
    await error(await request(`/shipments/${shipment.id}`, 'a', 'PATCH', { version: shipment.version, warehouse_notes: 'Denied' }), 422, 'UNPROCESSABLE');
    const rejected = await move(await pending(), 'reject', 'admin', { rejected_reason: 'Not accepted' });
    await error(await request(`/shipments/${rejected.id}`, 'a', 'PATCH', { version: rejected.version, warehouse_notes: 'Denied' }), 422, 'UNPROCESSABLE');
  }, 15000);
  it('e: stale versions on update/approve/reject/assign report exact current_version', async () => {
    const draft = await create();
    const updated = await request(`/shipments/${draft.id}`, 'a', 'PATCH', { version: draft.version, warehouse_notes: 'v2' }); expect(updated.status).toBe(200);
    const stalePatch = await error(await request(`/shipments/${draft.id}`, 'a', 'PATCH', { version: draft.version, warehouse_notes: 'Stale' }), 409, 'VERSION_CONFLICT');
    expect(stalePatch.details).toEqual({ current_version: 2 });
    const review = await pending();
    for (const action of ['approve', 'reject']) {
      const result = await error(await request(`/shipments/${review.id}/${action}`, 'admin', 'POST', { version: review.version - 1, ...(action === 'reject' ? { rejected_reason: 'Stale' } : {}) }), 409, 'VERSION_CONFLICT');
      expect(result.details).toEqual({ current_version: review.version });
    }
    const ready = await move(review, 'approve');
    const result = await error(await request(`/shipments/${ready.id}/assign`, 'admin', 'POST', { version: ready.version - 1, ...await resources() }), 409, 'VERSION_CONFLICT');
    expect(result.details).toEqual({ current_version: ready.version });
  }, 15000);
  it('f: submit accepts draft only and increments version', async () => {
    const draft = await create(); const review = await move(draft, 'submit', 'a');
    expect(review).toMatchObject({ status: 'pending_review', version: draft.version + 1 });
    await error(await request(`/shipments/${review.id}/submit`, 'a', 'POST', { version: review.version }), 422, 'UNPROCESSABLE');
  });
  it('g: customer cancels draft/pending_review but cannot cancel approved', async () => {
    for (const shipment of [await create(), await pending()]) expect(await move(shipment, 'cancel', 'a')).toMatchObject({ status: 'cancelled' });
    const shipment = await approved();
    await error(await request(`/shipments/${shipment.id}/cancel`, 'a', 'POST', { version: shipment.version }), 422, 'UNPROCESSABLE');
  });
  it('h: customer A cannot read/edit/cancel customer B shipment; collection is scoped', async () => {
    const shipment = await create('b');
    await error(await request(`/shipments/${shipment.id}`), 404, 'NOT_FOUND');
    await error(await request(`/shipments/${shipment.id}`, 'a', 'PATCH', { version: shipment.version, warehouse_notes: 'Not mine' }), 404, 'NOT_FOUND');
    await error(await request(`/shipments/${shipment.id}/cancel`, 'a', 'POST', { version: shipment.version }), 404, 'NOT_FOUND');
    const collection = await request('/shipments'); expect(collection.status).toBe(200); const own = await collection.json() as Shipment[];
    expect(own.every(row => row.customer_id === accounts.a.id)).toBe(true); expect(own.some(row => row.id === shipment.id)).toBe(false);
    const all = await request('/shipments', 'admin'); expect(all.status).toBe(200);
    expect((await all.json() as Shipment[]).some(row => row.id === shipment.id)).toBe(true);
  });
  it('i: admin approves pending_review only, recording reviewer', async () => {
    const draft = await create();
    await error(await request(`/shipments/${draft.id}/approve`, 'admin', 'POST', { version: draft.version }), 422, 'UNPROCESSABLE');
    const shipment = await move(await move(draft, 'submit', 'a'), 'approve');
    expect(shipment.status).toBe('approved');
    expect((await db.query('select reviewed_by,reviewed_at from public.shipments where id=$1', [shipment.id])).rows[0]).toMatchObject({ reviewed_by: accounts.admin.id, reviewed_at: expect.any(Date) });
  });
  it('j: rejection needs a nonblank reason and rejected is terminal', async () => {
    const review = await pending();
    for (const body of [{ version: review.version }, { version: review.version, rejected_reason: '   ' }]) await error(await request(`/shipments/${review.id}/reject`, 'admin', 'POST', body), 400, 'VALIDATION_FAILED');
    const rejected = await move(review, 'reject', 'admin', { rejected_reason: '  Capacity unavailable  ' });
    expect(rejected).toMatchObject({ status: 'rejected', rejected_reason: 'Capacity unavailable' });
    for (const [action, who] of [['submit', 'a'], ['approve', 'admin'], ['reject', 'admin'], ['cancel', 'a'], ['cancel', 'admin']]) {
      await error(await request(`/shipments/${rejected.id}/${action}`, who, 'POST', { version: rejected.version, ...(action === 'reject' ? { rejected_reason: 'Again' } : {}) }), 422, 'UNPROCESSABLE');
    }
    await error(await request(`/shipments/${rejected.id}/assign`, 'admin', 'POST', { version: rejected.version, ...await resources() }), 422, 'UNPROCESSABLE');
  }, 15000);
  it('k: insufficient vehicle range returns 422; adequate capacity schedules shipment and trip', async () => {
    const shipment = await approved(); const resource = await resources();
    for (const [min, max] of [[-19, -15], [-25, -19]]) {
      await db.query('update public.vehicles set temp_capacity_min=$1,temp_capacity_max=$2 where id=$3', [min, max, resource.vehicle_id]);
      await error(await request(`/shipments/${shipment.id}/assign`, 'admin', 'POST', { version: shipment.version, ...resource }), 422, 'UNPROCESSABLE');
    }
    await db.query('update public.vehicles set temp_capacity_min=-25,temp_capacity_max=-15 where id=$1', [resource.vehicle_id]);
    const scheduled = await move(shipment, 'assign', 'admin', resource);
    expect(scheduled.status).toBe('scheduled'); expect(scheduled.trip).toMatchObject({ ...resource, status: 'scheduled', version: 1 });
    expect((await db.query('select shipment_id,status,vehicle_id,driver_id,device_id from public.trips where id=$1', [scheduled.trip!.id])).rows[0]).toEqual({ shipment_id: shipment.id, status: 'scheduled', ...resource });
  });
  it('l: inactive vehicle/driver/device and wrong driver role are rejected', async () => {
    const shipment = await approved(); const resource = await resources();
    for (const [table, field, id, inactive, active] of [
      ['vehicles', 'id', resource.vehicle_id, 'maintenance', 'active'],
      ['account_access', 'user_id', resource.driver_id, 'suspended', 'active'],
      ['devices', 'id', resource.device_id, 'disabled', 'active'],
    ]) {
      await db.query(`update public.${table} set status=$1 where ${field}=$2`, [inactive, id]);
      try { await error(await request(`/shipments/${shipment.id}/assign`, 'admin', 'POST', { version: shipment.version, ...resource }), 422, 'UNPROCESSABLE'); }
      finally { await db.query(`update public.${table} set status=$1 where ${field}=$2`, [active, id]); }
    }
    await error(await request(`/shipments/${shipment.id}/assign`, 'admin', 'POST', { version: shipment.version, ...resource, driver_id: accounts.b.id }), 422, 'UNPROCESSABLE');
  });
  it('m: scheduled/in_transit conflicts on vehicle, driver or device return 409 and leave no partial trip', async () => {
    for (const field of ['vehicle_id', 'driver_id', 'device_id'] as const) {
      const first = await approved(); const r1 = await resources(); await move(first, 'assign', 'admin', r1);
      if (field === 'driver_id') {
        await db.query("update public.trips set status='in_transit',departed_at=now() where shipment_id=$1", [first.id]);
        await db.query("update public.shipments set status='in_transit' where id=$1", [first.id]);
      }
      const second = await approved(); const r2 = await resources();
      await error(await request(`/shipments/${second.id}/assign`, 'admin', 'POST', { version: second.version, ...r2, [field]: r1[field] }), 409, 'CONFLICT');
      expect((await db.query('select id from public.trips where shipment_id=$1', [second.id])).rowCount).toBe(0);
      expect((await db.query('select status,version from public.shipments where id=$1', [second.id])).rows[0]).toEqual({ status: 'approved', version: second.version });
    }
  }, 20000);
  it('n: admin cancels scheduled shipment and its trip atomically; approved cancellation creates no trip', async () => {
    const scheduled = await move(await approved(), 'assign', 'admin', await resources());
    expect(await move(scheduled, 'cancel')).toMatchObject({ status: 'cancelled', version: scheduled.version + 1 });
    expect((await db.query('select status,version from public.trips where id=$1', [scheduled.trip!.id])).rows[0]).toEqual({ status: 'cancelled', version: scheduled.trip!.version + 1 });
    const ready = await approved(); expect(await move(ready, 'cancel')).toMatchObject({ status: 'cancelled' });
    expect((await db.query('select id from public.trips where shipment_id=$1', [ready.id])).rowCount).toBe(0);
  });
  it('o: two assignments competing for the same vehicle yield one success', async () => {
    const first = await approved(); const second = await approved(); const resource = await resources();
    const otherDriver = await account('other concurrent driver', 'driver');
    const responses = await Promise.all([
      request(`/shipments/${first.id}/assign`, 'admin', 'POST', { version: first.version, ...resource }),
      request(`/shipments/${second.id}/assign`, 'admin', 'POST', { version: second.version, ...resource, driver_id: otherDriver.id }),
    ]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    await error(responses.find(r => r.status === 409)!, 409, 'CONFLICT');
    expect((await db.query("select id from public.trips where vehicle_id=$1 and status in ('scheduled','in_transit')", [resource.vehicle_id])).rowCount).toBe(1);
  }, 15000);
  it('p: create and PATCH replays preserve response and execute one write/audit', async () => {
    const key = randomUUID(); const body = { product_type: `${prefix}-replay`, temp_min: -20, temp_max: -18 };
    const first = await request('/shipments', 'a', 'POST', body, key); expect(first.status).toBe(201); const saved = await first.json() as Shipment; ids.add(saved.id);
    const second = await request('/shipments', 'a', 'POST', body, key); expect(second.status).toBe(201); expect(await second.json()).toEqual(saved);
    expect((await db.query('select id from public.shipments where product_type=$1', [body.product_type])).rowCount).toBe(1);
    const patchKey = randomUUID(); const patch = { version: saved.version, warehouse_notes: 'Replay once' };
    const p1 = await request(`/shipments/${saved.id}`, 'a', 'PATCH', patch, patchKey); expect(p1.status).toBe(200); const updated = await p1.json();
    const p2 = await request(`/shipments/${saved.id}`, 'a', 'PATCH', patch, patchKey); expect(p2.status).toBe(200); expect(await p2.json()).toEqual(updated);
    expect((await db.query('select version from public.shipments where id=$1', [saved.id])).rows[0].version).toBe(2);
    for (const action of ['shipments.create', 'shipments.update']) expect((await db.query('select id from public.audit_logs where entity_id=$1 and action=$2', [saved.id, action])).rowCount).toBe(1);
  });
  it('q: driver cannot access direct shipment API or SQL rows even on an assigned trip', async () => {
    const scheduled = await move(await approved(), 'assign', 'admin', await resources(accounts.driver.id));
    await error(await request('/shipments', 'driver'), 404, 'NOT_FOUND');
    await error(await request(`/shipments/${scheduled.id}`, 'driver'), 404, 'NOT_FOUND');
    await db.query('begin');
    try {
      await db.query('set local role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)", [accounts.driver.id, JSON.stringify({ sub: accounts.driver.id, role: 'authenticated' })]);
      expect((await db.query('select id from public.shipments')).rowCount).toBe(0);
    } finally { await db.query('rollback'); }
  });
  it('r: all successful shipment/trip writes have correctly scoped audits', async () => {
    const rows = (await db.query(`select * from public.audit_logs where entity_id=any($1::text[])
      or entity_id in (select id::text from public.trips where shipment_id=any($1::uuid[]))`, [[...ids]])).rows;
    for (const action of ['shipments.create', 'shipments.update', 'shipments.submit', 'shipments.approve', 'shipments.reject', 'shipments.assign', 'shipments.cancel', 'trips.create', 'trips.cancel']) {
      expect(rows.some(row => row.action === action && row.entity === (action.startsWith('trips.') ? 'trips' : 'shipments'))).toBe(true);
    }
    for (const row of rows) {
      expect([accounts.admin.id, accounts.a.id, accounts.b.id]).toContain(row.actor_id);
      if (['shipments.approve', 'shipments.reject', 'shipments.assign', 'trips.create', 'trips.cancel'].includes(row.action)) expect(row.actor_id).toBe(accounts.admin.id);
      expect(JSON.stringify(row.payload)).not.toMatch(/token|password|@example\.test/);
    }
  });
  it('s: mutations require key/version and reject free status/customer reassignment', async () => {
    const shipment = await create();
    await error(await request('/shipments', 'a', 'POST', { product_type: prefix, temp_min: -20, temp_max: -18 }, null), 400, 'IDEMPOTENCY_KEY_REQUIRED');
    await error(await request(`/shipments/${shipment.id}`, 'a', 'PATCH', { warehouse_notes: 'No version' }), 400, 'VALIDATION_FAILED');
    for (const extra of [{ status: 'approved' }, { customer_id: accounts.b.id }]) await error(await request(`/shipments/${shipment.id}`, 'a', 'PATCH', { version: shipment.version, ...extra }), 400, 'VALIDATION_FAILED');
    await error(await request('/shipments', 'admin', 'POST', { product_type: prefix, temp_min: -20, temp_max: -18 }), 403, 'FORBIDDEN');
    await error(await request(`/shipments/${shipment.id}/approve`, 'a', 'POST', { version: shipment.version }), 403, 'FORBIDDEN');
    await error(await request(`/shipments/${randomUUID()}`), 404, 'NOT_FOUND');
  });
  it('partial PATCH validates the merged temperature range', async () => {
    const shipment = await create();
    await error(await request(`/shipments/${shipment.id}`, 'a', 'PATCH', { version: shipment.version, temp_min: -19 }), 400, 'VALIDATION_FAILED');
    expect((await db.query('select temp_min,version from public.shipments where id=$1', [shipment.id])).rows[0]).toEqual({ temp_min: '-20', version: shipment.version });
  });
  it('cancel failure after trip UPDATE rolls back both rows and both audits', async () => {
    const scheduled = await move(await approved(), 'assign', 'admin', await resources());
    const auditBefore = (await db.query('select count(*)::int as n from public.audit_logs where entity_id=any($1::text[])', [[scheduled.id, scheduled.trip!.id]])).rows[0].n;
    await db.query(`alter table public.shipments add constraint be23_cancel_failure check (id <> '${scheduled.id}'::uuid or status <> 'cancelled') not valid`);
    try { await error(await request(`/shipments/${scheduled.id}/cancel`, 'admin', 'POST', { version: scheduled.version }), 500, 'INTERNAL'); }
    finally { await db.query('alter table public.shipments drop constraint be23_cancel_failure'); }
    expect((await db.query('select status,version from public.shipments where id=$1', [scheduled.id])).rows[0]).toEqual({ status: 'scheduled', version: scheduled.version });
    expect((await db.query('select status,version from public.trips where id=$1', [scheduled.trip!.id])).rows[0]).toEqual({ status: 'scheduled', version: scheduled.trip!.version });
    expect((await db.query('select count(*)::int as n from public.audit_logs where entity_id=any($1::text[])', [[scheduled.id, scheduled.trip!.id]])).rows[0].n).toBe(auditBefore);
    expect((await move(scheduled, 'cancel')).status).toBe('cancelled');
  });
  it('assignment audit failure rolls back shipment, new trip and trip audit', async () => {
    const shipment = await approved(); const resource = await resources();
    await db.query(`alter table public.audit_logs add constraint be23_assign_failure check (entity_id <> '${shipment.id}' or action <> 'shipments.assign') not valid`);
    try { await error(await request(`/shipments/${shipment.id}/assign`, 'admin', 'POST', { version: shipment.version, ...resource }), 500, 'INTERNAL'); }
    finally { await db.query('alter table public.audit_logs drop constraint be23_assign_failure'); }
    expect((await db.query('select status,version from public.shipments where id=$1', [shipment.id])).rows[0]).toEqual({ status: 'approved', version: shipment.version });
    expect((await db.query('select id from public.trips where shipment_id=$1', [shipment.id])).rowCount).toBe(0);
    expect((await db.query("select id from public.audit_logs where payload->>'shipment_id'=$1 and action='trips.create'", [shipment.id])).rowCount).toBe(0);
    expect((await move(shipment, 'assign', 'admin', resource)).status).toBe('scheduled');
  });
});
