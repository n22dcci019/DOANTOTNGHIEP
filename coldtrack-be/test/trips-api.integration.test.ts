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
import { TripsModule } from '../apps/api/src/trips/trips.module.js';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: resolve('..', '.env') }), ApiModule, TripsModule] })
class TripsTestModule {}

type Trip = { id: string; shipment_id: string; device_id: string; driver_id: string; status: string; version: number;
  departed_at: string | null; completed_at: string | null; result: string | null; driver_notes: string | null };
type Fixture = { id: string; shipment_id: string; device_id: string; owner: string };
type Proof = { id: string; photo_path: string; trip_id: string; trip_version: number; created_by: string };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0ioAAAAASUVORK5CYII=', 'base64');
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EB//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EB//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EB//2Q==', 'base64');

describe('trips API 2.4 (real PostgreSQL, Auth and private Storage; SQL telemetry fixtures)', () => {
  const env = { ...parse(readFileSync('../.env')), ...process.env };
  const db = new pg.Client({ connectionString: env.DATABASE_URL });
  let app: INestApplication | undefined;
  let base: string;
  let auth: SupabaseClient;
  let login: SupabaseClient;
  let url: string;
  let anonKey: string;
  const prefix = `be24-${randomUUID().slice(0, 8)}`;
  const accounts: Record<string, { id: string; token: string }> = {};
  const fixtures: Fixture[] = [];
  const objects = new Set<string>();
  const logs: string[] = [];
  const logger = { log: () => undefined, debug: () => undefined, verbose: () => undefined,
    warn: (value: unknown) => logs.push(String(value)), error: (value: unknown) => logs.push(String(value)) };

  async function account(name: string, role: string) {
    const email = `${prefix}-${randomUUID().slice(0, 8)}@example.test`; const password = `Test-${randomUUID()}!`;
    const created = await auth.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error('Auth fixture creation failed');
    const id = created.data.user.id;
    await db.query('insert into public.profiles(id,full_name,email) values($1,$2,$3)', [id, name, email]);
    await db.query("insert into public.account_access(user_id,role_id,status) select $1,id,'active' from public.roles where code=$2", [id, role]);
    const result = await login.auth.signInWithPassword({ email, password });
    if (result.error || !result.data.session) throw new Error('Auth fixture login failed');
    accounts[name] = { id, token: result.data.session.access_token };
  }

  beforeAll(async () => {
    const status = JSON.parse(execFileSync(process.execPath, [resolve('node_modules/supabase/dist/supabase.js'),
      'status', '--workdir', '..', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })) as {
        API_URL: string; SERVICE_ROLE_KEY: string; ANON_KEY: string;
      };
    url = status.API_URL; anonKey = status.ANON_KEY;
    auth = createClient(url, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    login = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    await db.connect();
    await account('admin', 'admin'); await account('customer', 'customer'); await account('other', 'driver');
    Logger.overrideLogger(logger);
    app = await NestFactory.create(TripsTestModule, { logger }); configureApi(app);
    await app.listen(0, '127.0.0.1'); base = `${await app.getUrl()}/api/v1`;
  }, 60000);

  afterAll(async () => {
    // Storage bytes are outside the test DB reset. Remove successful test objects
    // through the service API; retain committed append-only audit fixtures until
    // npm test's subsequent seed reset clears the DB without weakening policy.
    if (objects.size) {
      const removed = await auth.storage.from('delivery-proofs').remove([...objects]);
      if (removed.error) throw new Error('Storage fixture cleanup failed');
    }
    await app?.close(); Logger.overrideLogger(new Logger()); await db.end();
  }, 30000);

  function request(path: string, who: string, method = 'GET', body?: unknown, key: string | null = randomUUID()) {
    return fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${accounts[who].token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'Idempotency-Key': key } : {}),
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  }
  async function error(response: Response, status: number, code: string) {
    expect(response.status).toBe(status);
    const body = await response.json() as { error: { code: string; message: string; details: unknown; request_id: string } };
    expect(Object.keys(body)).toEqual(['error']); expect(Object.keys(body.error).sort()).toEqual(['code', 'details', 'message', 'request_id']);
    expect(body.error.code).toBe(code); expect(typeof body.error.message).toBe('string');
    expect(body.error.request_id).toBe(response.headers.get('X-Request-Id')); expect(body.error.request_id).toBeTruthy();
    expect(JSON.stringify(body)).not.toMatch(/SQL|23505|23514|constraint|stack|delivery_proofs|audit_logs/);
    if (code !== 'VERSION_CONFLICT') expect(body.error.details).toBeNull();
    return body.error;
  }
  async function fixture(): Promise<Fixture> {
    const owner = `driver-${fixtures.length}`; await account(owner, 'driver');
    const shipment = randomUUID(); const vehicle = randomUUID(); const device = randomUUID(); const id = randomUUID();
    await db.query('insert into public.vehicles(id,plate,temp_capacity_min,temp_capacity_max) values($1,$2,-25,-15)', [vehicle, `${prefix}-${vehicle}`]);
    await db.query('insert into public.devices(id,device_code,vehicle_id) values($1,$2,$3)', [device, `${prefix}-${device}`, vehicle]);
    await db.query('insert into public.device_assignments(device_id,vehicle_id,valid_from) values($1,$2,now())', [device, vehicle]);
    await db.query("insert into public.shipments(id,customer_id,product_type,temp_min,temp_max,status) values($1,$2,$3,-20,-18,'scheduled')", [shipment, accounts.customer.id, prefix]);
    await db.query("insert into public.trips(id,shipment_id,vehicle_id,driver_id,device_id,status) values($1,$2,$3,$4,$5,'scheduled')", [id, shipment, vehicle, accounts[owner].id, device]);
    const value = { id, shipment_id: shipment, device_id: device, owner }; fixtures.push(value); return value;
  }
  async function telemetry(f: Fixture, age = 0) {
    // Synthetic sensor data inserted into PostgreSQL: no MQTT/ingest path is
    // exercised here. Ingest transport and attribution are tested in BE-3.1.
    const boot = randomUUID();
    const stamp = (await db.query<{ stamp: Date }>("select clock_timestamp() - $1 * interval '1 second' as stamp", [age])).rows[0].stamp;
    await db.query(`insert into public.telemetry_readings(message_id,device_id,trip_id,boot_id,sequence_no,monotonic_ms,
      measured_at_device,time_source,time_quality,received_at,is_backfill,temperature_c)
      values($1,$2,$3,$4,1,1,$5,'ntp','good',now(),false,-19)`, [randomUUID(), f.device_id, f.id, boot, stamp]);
    await db.query(`insert into public.device_latest_state(device_id,active_boot_id,last_sequence_no,last_fresh_sample_at,last_received_at,temperature_c,updated_at)
      values($1,$2,1,$3,now(),-19,now()) on conflict(device_id) do update set
      last_fresh_sample_at=excluded.last_fresh_sample_at,last_received_at=excluded.last_received_at,updated_at=excluded.updated_at`, [f.device_id, boot, stamp]);
  }
  async function get(f: Fixture) {
    const response = await request(`/trips/${f.id}`, f.owner); expect(response.status).toBe(200); return await response.json() as Trip;
  }
  async function depart(f: Fixture) {
    const before = await get(f); await telemetry(f);
    const response = await request(`/trips/${f.id}/depart`, f.owner, 'POST', { version: before.version });
    expect(response.status).toBe(200); return await response.json() as Trip;
  }
  function upload(f: Fixture, version: number, bytes = PNG, mime = 'image/png', key = randomUUID(), who = f.owner) {
    const form = new FormData(); form.set('version', String(version)); form.set('signed_by', 'Receiver');
    form.set('file', new Blob([Uint8Array.from(bytes)], { type: mime }), mime === 'image/jpeg' ? 'proof.jpg' : 'proof.png');
    return fetch(`${base}/trips/${f.id}/proof`, { method: 'POST', headers: {
      Authorization: `Bearer ${accounts[who].token}`, 'Idempotency-Key': key,
    }, body: form });
  }
  async function proof(f: Fixture, version: number, bytes = PNG, mime = 'image/png', key = randomUUID()) {
    const response = await upload(f, version, bytes, mime, key); expect(response.status).toBe(201);
    const result = await response.json() as Proof; objects.add(result.photo_path); return result;
  }

  it('a: uses the existing 10 migrations and private delivery-proofs bucket', async () => {
    expect((await db.query('select count(*)::int as n from supabase_migrations.schema_migrations')).rows[0].n).toBe(10);
    expect((await db.query("select public from storage.buckets where id='delivery-proofs'")).rows[0].public).toBe(false);
  });
  it('b: assigned driver departs with fresh telemetry; both rows and versions change', async () => {
    const f = await fixture(); const trip = await depart(f);
    expect(trip).toMatchObject({ status: 'in_transit', version: 2 }); expect(trip.departed_at).toBeTruthy();
    expect((await db.query('select status,version from public.shipments where id=$1', [f.shipment_id])).rows[0]).toEqual({ status: 'in_transit', version: 2 });
  });
  it('c: stale sample or absent freshness is rejected despite recent receipt', async () => {
    const f = await fixture();
    await error(await request(`/trips/${f.id}/depart`, f.owner, 'POST', { version: 1 }), 422, 'UNPROCESSABLE');
    await telemetry(f, 61);
    await error(await request(`/trips/${f.id}/depart`, f.owner, 'POST', { version: 1 }), 422, 'UNPROCESSABLE');
    await db.query('update public.device_latest_state set last_fresh_sample_at=null,last_received_at=now() where device_id=$1', [f.device_id]);
    await error(await request(`/trips/${f.id}/depart`, f.owner, 'POST', { version: 1 }), 422, 'UNPROCESSABLE');
  });
  it('d: another driver gets 404; customer/admin cannot depart (403)', async () => {
    const f = await fixture(); await telemetry(f);
    await error(await request(`/trips/${f.id}/depart`, 'other', 'POST', { version: 1 }), 404, 'NOT_FOUND');
    for (const who of ['customer', 'admin']) await error(await request(`/trips/${f.id}/depart`, who, 'POST', { version: 1 }), 403, 'FORBIDDEN');
  });
  it('e: depart rejects non-scheduled trip or mismatched shipment state', async () => {
    const f = await fixture(); await depart(f);
    await error(await request(`/trips/${f.id}/depart`, f.owner, 'POST', { version: 2 }), 422, 'UNPROCESSABLE');
    const other = await fixture(); await telemetry(other);
    await db.query("update public.shipments set status='approved' where id=$1", [other.shipment_id]);
    await error(await request(`/trips/${other.id}/depart`, other.owner, 'POST', { version: 1 }), 422, 'UNPROCESSABLE');
  });
  it('f: complete needs proof; completion sets pending_evaluation and synchronizes shipment', async () => {
    const f = await fixture(); const started = await depart(f);
    await error(await request(`/trips/${f.id}/complete`, f.owner, 'POST', { version: started.version }), 422, 'UNPROCESSABLE');
    const saved = await proof(f, started.version);
    const response = await request(`/trips/${f.id}/complete`, f.owner, 'POST', { version: saved.trip_version }); expect(response.status).toBe(200);
    const result = await response.json() as Trip;
    expect(result).toMatchObject({ status: 'completed', result: 'pending_evaluation' });
    expect(new Date(result.completed_at!).getTime()).toBeGreaterThan(new Date(result.departed_at!).getTime());
    expect((await db.query('select status,version from public.shipments where id=$1', [f.shipment_id])).rows[0]).toEqual({ status: 'completed', version: 3 });
  });
  it('g: JPEG/PNG bytes reach real private Storage at the expected path', async () => {
    for (const [bytes, mime, ext] of [[JPEG, 'image/jpeg', 'jpg'], [PNG, 'image/png', 'png']] as const) {
      const f = await fixture(); const started = await depart(f); const saved = await proof(f, started.version, bytes, mime);
      expect(saved.photo_path).toMatch(new RegExp(`^proofs/${f.id}/[0-9a-f-]{36}\\.${ext}$`));
      expect(saved.created_by).toBe(accounts[f.owner].id);
      const downloaded = await auth.storage.from('delivery-proofs').download(saved.photo_path); expect(downloaded.error).toBeNull();
      expect(Buffer.from(await downloaded.data!.arrayBuffer())).toEqual(bytes);
    }
  }, 15000);
  it('g2: rejects fake images, MIME mismatch and files over 5 MB', async () => {
    const f = await fixture(); const started = await depart(f);
    await error(await upload(f, started.version, Buffer.from('not a JPEG image'), 'image/jpeg'), 400, 'VALIDATION_FAILED');
    await error(await upload(f, started.version, JPEG, 'image/png'), 400, 'VALIDATION_FAILED');
    await error(await upload(f, started.version, PNG, 'image/gif'), 400, 'VALIDATION_FAILED');
    await error(await upload(f, started.version, Buffer.alloc(5 * 1024 * 1024 + 1, 255), 'image/jpeg'), 400, 'VALIDATION_FAILED');
    expect((await db.query('select id from public.delivery_proofs where trip_id=$1', [f.id])).rowCount).toBe(0);
    // The limit is inclusive: the same PNG with padding at exactly 5 MB passes.
    const boundary = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 - PNG.length)]);
    expect((await proof(f, started.version, boundary)).trip_version).toBe(started.version + 1);
  }, 15000);
  it('h: a second proof gets CONFLICT, leaving one row and one object', async () => {
    const f = await fixture(); const started = await depart(f); await proof(f, started.version);
    await error(await upload(f, started.version), 409, 'CONFLICT');
    expect((await db.query('select id from public.delivery_proofs where trip_id=$1', [f.id])).rowCount).toBe(1);
    const list = await auth.storage.from('delivery-proofs').list(`proofs/${f.id}`); expect(list.error).toBeNull(); expect(list.data).toHaveLength(1);
  });
  it('i: anonymous and authenticated clients cannot read private proof objects directly', async () => {
    const f = await fixture(); const saved = await proof(f, (await depart(f)).version);
    for (const who of [null, f.owner, 'admin', 'customer']) {
      const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false },
        ...(who ? { global: { headers: { Authorization: `Bearer ${accounts[who].token}` } } } : {}) });
      const result = await client.storage.from('delivery-proofs').download(saved.photo_path); expect(result.error).not.toBeNull(); expect(result.data).toBeNull();
    }
    const publicUrl = auth.storage.from('delivery-proofs').getPublicUrl(saved.photo_path).data.publicUrl;
    expect((await fetch(publicUrl)).ok).toBe(false);
  });
  it('j: notes update scheduled/in_transit, enforce version, reject completed trips', async () => {
    const f = await fixture();
    const first = await request(`/trips/${f.id}/notes`, f.owner, 'PATCH', { version: 1, driver_notes: 'Before departure' }); expect(first.status).toBe(200);
    const started = await depart(f);
    const second = await request(`/trips/${f.id}/notes`, f.owner, 'PATCH', { version: started.version, driver_notes: 'On route' }); expect(second.status).toBe(200);
    const current = await second.json() as Trip; expect(current.driver_notes).toBe('On route');
    const stale = await error(await request(`/trips/${f.id}/notes`, f.owner, 'PATCH', { version: started.version, driver_notes: 'Stale' }), 409, 'VERSION_CONFLICT');
    expect(stale.details).toEqual({ current_version: current.version });
    const saved = await proof(f, current.version);
    const completed = await request(`/trips/${f.id}/complete`, f.owner, 'POST', { version: saved.trip_version }); expect(completed.status).toBe(200);
    const final = await completed.json() as Trip;
    await error(await request(`/trips/${f.id}/notes`, f.owner, 'PATCH', { version: final.version, driver_notes: 'Too late' }), 422, 'UNPROCESSABLE');
  }, 15000);
  it('k: driver GET is scoped; admin GET sees all trips; customer uses views', async () => {
    const f = await fixture();
    const own = await request('/trips', f.owner); expect(own.status).toBe(200);
    expect((await own.json() as Trip[]).map(row => row.id)).toEqual([f.id]);
    await error(await request(`/trips/${f.id}`, 'other'), 404, 'NOT_FOUND');
    const all = await request('/trips', 'admin'); expect(all.status).toBe(200); expect((await all.json() as Trip[]).some(row => row.id === f.id)).toBe(true);
    expect((await request(`/trips/${f.id}`, 'admin')).status).toBe(200);
    await error(await request('/trips', 'customer'), 404, 'NOT_FOUND');
  });
  it('l: concurrent depart yields exactly one 200 and one 422', async () => {
    const f = await fixture(); await telemetry(f);
    const responses = await Promise.all([request(`/trips/${f.id}/depart`, f.owner, 'POST', { version: 1 }), request(`/trips/${f.id}/depart`, f.owner, 'POST', { version: 1 })]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 422]);
    await error(responses.find(r => r.status === 422)!, 422, 'UNPROCESSABLE');
    expect((await get(f)).version).toBe(2);
    expect((await db.query("select id from public.audit_logs where entity_id=$1 and action='trips.depart'", [f.id])).rowCount).toBe(1);
  });
  it('m: depart replay returns the original response with one version change and audit', async () => {
    const f = await fixture(); await telemetry(f); const key = randomUUID();
    const first = await request(`/trips/${f.id}/depart`, f.owner, 'POST', { version: 1 }, key); expect(first.status).toBe(200); const saved = await first.json();
    const replay = await request(`/trips/${f.id}/depart`, f.owner, 'POST', { version: 1 }, key); expect(replay.status).toBe(200); expect(await replay.json()).toEqual(saved);
    expect((await get(f)).version).toBe(2);
    expect((await db.query("select id from public.audit_logs where entity_id=$1 and action='trips.depart'", [f.id])).rowCount).toBe(1);
  });
  it('multipart replay hashes the actual file bytes, ignoring random boundaries', async () => {
    const f = await fixture(); const started = await depart(f); const key = randomUUID();
    const saved = await proof(f, started.version, PNG, 'image/png', key);
    const replay = await upload(f, started.version, PNG, 'image/png', key); expect(replay.status).toBe(201); expect(await replay.json()).toEqual(saved);
    await error(await upload(f, started.version, JPEG, 'image/jpeg', key), 409, 'IDEMPOTENCY_KEY_REUSED');
    expect((await db.query('select id from public.delivery_proofs where trip_id=$1', [f.id])).rowCount).toBe(1);
  });
  it('n: audit entity/actor matches each write and contains no photo bytes or tokens', async () => {
    const tripIds = fixtures.map(f => f.id);
    const rows = (await db.query(`select * from public.audit_logs where entity_id=any($1::text[]) or payload->>'trip_id'=any($1::text[])
      or entity_id in(select id::text from public.delivery_proofs where trip_id=any($1::uuid[]))`, [tripIds])).rows;
    for (const [action, entity] of [['trips.depart', 'trips'], ['trips.complete', 'trips'], ['trips.update_notes', 'trips'], ['trips.proof', 'trips'],
      ['delivery_proofs.create', 'delivery_proofs'], ['shipments.depart', 'shipments'], ['shipments.complete', 'shipments']]) expect(rows.some(row => row.action === action && row.entity === entity)).toBe(true);
    for (const row of rows) {
      expect(fixtures.some(f => accounts[f.owner].id === row.actor_id)).toBe(true);
      expect(JSON.stringify(row.payload)).not.toMatch(/buffer|bytes|token|signed_by/);
    }
    const text = JSON.stringify(rows) + logs.join('\n');
    expect(text).not.toContain(PNG.toString('base64')); expect(text).not.toContain(JPEG.toString('base64'));
    for (const value of Object.values(accounts)) expect(text).not.toContain(value.token);
  });
  it('o: standard validation/key/version failures and scope checks apply to every mutation', async () => {
    const f = await fixture(); await telemetry(f);
    await error(await request(`/trips/${f.id}/depart`, f.owner, 'POST', {}), 400, 'VALIDATION_FAILED');
    await error(await request(`/trips/${f.id}/depart`, f.owner, 'POST', { version: 1 }, null), 400, 'IDEMPOTENCY_KEY_REQUIRED');
    const stale = await error(await request(`/trips/${f.id}/depart`, f.owner, 'POST', { version: 99 }), 409, 'VERSION_CONFLICT'); expect(stale.details).toEqual({ current_version: 1 });
    await error(await request(`/trips/${f.id}/notes`, f.owner, 'PATCH', { version: 1, driver_notes: 'Allowed', status: 'completed' }), 400, 'VALIDATION_FAILED');
    await error(await request(`/trips/${f.id}/notes`, 'other', 'PATCH', { version: 1, driver_notes: 'Not mine' }), 404, 'NOT_FOUND');
    await error(await request(`/trips/${f.id}/complete`, 'other', 'POST', { version: 1 }), 404, 'NOT_FOUND');
    await error(await upload(f, 1, PNG, 'image/png', randomUUID(), 'other'), 404, 'NOT_FOUND');
    await error(await upload(f, 1), 422, 'UNPROCESSABLE');
  });
  it('depart rollback leaves both statuses, dates and versions intact after DB failure', async () => {
    const f = await fixture(); await telemetry(f);
    await db.query(`alter table public.shipments add constraint be24_depart_failure check(id <> '${f.shipment_id}'::uuid or status <> 'in_transit') not valid`);
    try { await error(await request(`/trips/${f.id}/depart`, f.owner, 'POST', { version: 1 }), 500, 'INTERNAL'); }
    finally { await db.query('alter table public.shipments drop constraint be24_depart_failure'); }
    expect((await db.query('select status,version,departed_at from public.trips where id=$1', [f.id])).rows[0]).toEqual({ status: 'scheduled', version: 1, departed_at: null });
    expect((await db.query('select status,version from public.shipments where id=$1', [f.shipment_id])).rows[0]).toEqual({ status: 'scheduled', version: 1 });
    expect((await db.query("select id from public.audit_logs where entity_id=$1 and action='trips.depart'", [f.id])).rowCount).toBe(0);
  });
  it('complete rollback preserves the existing proof and does not set a result', async () => {
    const f = await fixture(); const saved = await proof(f, (await depart(f)).version);
    await db.query(`alter table public.shipments add constraint be24_complete_failure check(id <> '${f.shipment_id}'::uuid or status <> 'completed') not valid`);
    try { await error(await request(`/trips/${f.id}/complete`, f.owner, 'POST', { version: saved.trip_version }), 500, 'INTERNAL'); }
    finally { await db.query('alter table public.shipments drop constraint be24_complete_failure'); }
    expect((await db.query('select status,version,completed_at,result from public.trips where id=$1', [f.id])).rows[0]).toEqual({ status: 'in_transit', version: saved.trip_version, completed_at: null, result: null });
    expect((await db.query('select status from public.shipments where id=$1', [f.shipment_id])).rows[0].status).toBe('in_transit');
    expect((await db.query('select id from public.delivery_proofs where trip_id=$1', [f.id])).rowCount).toBe(1);
  });
  it('proof DB failure compensates real Storage upload; same-key retry succeeds', async () => {
    const f = await fixture(); const started = await depart(f); const key = randomUUID();
    await db.query(`alter table public.audit_logs add constraint be24_proof_failure check(entity <> 'delivery_proofs' or actor_id <> '${accounts[f.owner].id}'::uuid) not valid`);
    try { await error(await upload(f, started.version, PNG, 'image/png', key), 500, 'INTERNAL'); }
    finally { await db.query('alter table public.audit_logs drop constraint be24_proof_failure'); }
    expect((await db.query('select id from public.delivery_proofs where trip_id=$1', [f.id])).rowCount).toBe(0);
    expect((await get(f)).version).toBe(started.version);
    const list = await auth.storage.from('delivery-proofs').list(`proofs/${f.id}`); expect(list.error).toBeNull(); expect(list.data).toHaveLength(0);
    expect((await proof(f, started.version, PNG, 'image/png', key)).trip_version).toBe(started.version + 1);
  });
});
