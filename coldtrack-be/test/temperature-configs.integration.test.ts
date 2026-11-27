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
import { setTimeout as delay } from 'node:timers/promises';
import { parse } from 'dotenv';
import { connectAsync, type MqttClient } from 'mqtt';
import pg from 'pg';
import { ApiModule, configureApi } from '../libs/api/api.module.js';
import { TripsModule } from '../apps/api/src/trips/trips.module.js';
import { TemperatureConfigsModule } from '../apps/api/src/temperature-configs/temperature-configs.module.js';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: resolve('..', '.env') }), ApiModule, TripsModule, TemperatureConfigsModule] })
class ConfigTestModule {}
type Fixture = { id: string; shipment: string; device: string; owner: string };
type Config = { id: string; device_id: string; trip_id: string; config_version_no: number; command_id: string; status: string; target_min: string; target_max: string };

describe('temperature configs 2.5 (real PostgreSQL/Auth; no command publishing)', () => {
  const env = { ...parse(readFileSync('../.env')), ...process.env };
  const db = new pg.Client({ connectionString: env.DATABASE_URL });
  let app: INestApplication | undefined;
  let base: string;
  let auth: SupabaseClient;
  let login: SupabaseClient;
  const prefix = `be25-${randomUUID().slice(0, 8)}`;
  const accounts: Record<string, { id: string; token: string }> = {};
  const fixtures: Fixture[] = [];
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
    auth = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    login = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    await db.connect();
    for (const [name, role] of [['admin', 'admin'], ['customer', 'customer'], ['other', 'driver']]) await account(name, role);
    Logger.overrideLogger(logger);
    app = await NestFactory.create(ConfigTestModule, { logger }); configureApi(app);
    await app.listen(0, '127.0.0.1'); base = `${await app.getUrl()}/api/v1`;
  }, 60000);

  afterAll(async () => {
    await app?.close(); Logger.overrideLogger(new Logger()); await db.end();
    // Committed append-only audit fixtures are cleared by the subsequent seed
    // reset in npm test; do not weaken permissions or delete audit rows.
  });

  function request(path: string, who = 'admin', method = 'GET', body?: unknown, key: string | null = randomUUID()) {
    return fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${accounts[who].token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'Idempotency-Key': key } : {}),
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  }
  async function error(response: Response, status: number, code: string) {
    expect(response.status).toBe(status);
    const result = await response.json() as { error: { code: string; message: string; details: unknown; request_id: string } };
    expect(Object.keys(result)).toEqual(['error']); expect(Object.keys(result.error).sort()).toEqual(['code', 'details', 'message', 'request_id']);
    expect(result.error.code).toBe(code); expect(typeof result.error.message).toBe('string');
    expect(result.error.request_id).toBe(response.headers.get('X-Request-Id')); expect(result.error.request_id).toBeTruthy();
    expect(JSON.stringify(result)).not.toMatch(/SQL|23505|23514|constraint|stack|temperature_config_versions|audit_logs/);
    if (code !== 'VERSION_CONFLICT') expect(result.error.details).toBeNull(); return result.error;
  }
  async function fixture(options: { device?: string; code?: string } = {}): Promise<Fixture> {
    const owner = `driver-${fixtures.length}`; await account(owner, 'driver');
    let device = options.device;
    if (!device && options.code) device = (await db.query('select id from public.devices where device_code=$1', [options.code])).rows[0]?.id;
    let vehicle: string;
    if (device) vehicle = (await db.query('select vehicle_id from public.devices where id=$1', [device])).rows[0].vehicle_id;
    else {
      vehicle = randomUUID(); device = randomUUID();
      await db.query('insert into public.vehicles(id,plate,temp_capacity_min,temp_capacity_max) values($1,$2,-25,-15)', [vehicle, `${prefix}-${vehicle}`]);
      await db.query('insert into public.devices(id,device_code,vehicle_id) values($1,$2,$3)', [device, options.code ?? `${prefix}-${device}`, vehicle]);
    }
    const shipment = randomUUID(); const id = randomUUID();
    await db.query("insert into public.shipments(id,customer_id,product_type,temp_min,temp_max,status) values($1,$2,$3,-20,-18,'scheduled')", [shipment, accounts.customer.id, prefix]);
    await db.query("insert into public.trips(id,shipment_id,vehicle_id,driver_id,device_id,status) values($1,$2,$3,$4,$5,'scheduled')", [id, shipment, vehicle, accounts[owner].id, device]);
    const result = { id, shipment, device: device!, owner }; fixtures.push(result); return result;
  }
  async function create(f: Fixture, extra: Record<string, unknown> = {}, key = randomUUID()) {
    const response = await request(`/trips/${f.id}/temperature-configs`, 'admin', 'POST', { version: 1, target_min: -20, target_max: -18, ...extra }, key);
    expect(response.status).toBe(201); return await response.json() as Config;
  }
  async function telemetry(f: Fixture, number: number | null, age = 0) {
    // SQL fixtures, not an ingest or ACK simulation.
    await db.query(`insert into public.device_latest_state(device_id,last_received_at,last_fresh_sample_at,config_version_no,updated_at)
      values($1,now(),clock_timestamp()-$3*interval '1 second',$2,now()) on conflict(device_id) do update set
      last_received_at=excluded.last_received_at,last_fresh_sample_at=excluded.last_fresh_sample_at,
      config_version_no=excluded.config_version_no,updated_at=excluded.updated_at`, [f.device, number, age]);
  }

  it('a: all 10 existing migrations are applied', async () => {
    expect((await db.query('select count(*)::int as n from supabase_migrations.schema_migrations')).rows[0].n).toBe(10);
  });
  it('b,c: first config, wire command, pending outbox and audits are committed together', async () => {
    const f = await fixture(); const config = await create(f);
    expect(config).toMatchObject({ device_id: f.device, trip_id: f.id, config_version_no: 1, status: 'approved' });
    const command = (await db.query('select * from public.device_commands where command_id=$1', [config.command_id])).rows[0];
    expect(command).toMatchObject({ config_version_id: config.id, device_id: f.device, trip_id: f.id, type: 'set_target_range', status: 'queued', issued_by: accounts.admin.id });
    expect(command.payload).toEqual({ schema_version: 1, command_id: config.command_id, type: 'set_target_range', config_version_no: 1,
      target_min: -20, target_max: -18, issued_at: command.issued_at.toISOString(), expires_at: command.expires_at.toISOString() });
    expect(command.expires_at.getTime() - command.issued_at.getTime()).toBe(30000);
    const outbox = (await db.query("select * from public.outbox_events where payload->>'command_id'=$1", [config.command_id])).rows[0];
    expect(outbox).toMatchObject({ topic: 'device_command.enqueued', status: 'pending', attempts: 0, payload: { command_id: config.command_id, device_id: f.device } });
    expect((await db.query("select id from public.audit_logs where entity_id=$1 and action='temperature_configs.create'", [config.id])).rowCount).toBe(1);
    expect((await db.query('select next_config_version_no from public.devices where id=$1', [f.device])).rows[0].next_config_version_no).toBe(2);
  });
  it('d: later config supersedes approved config and fails queued command', async () => {
    const f = await fixture(); const first = await create(f); const second = await create(f, { target_min: -22, target_max: -19 });
    expect([first.config_version_no, second.config_version_no]).toEqual([1, 2]);
    expect((await db.query('select status,version from public.temperature_config_versions where id=$1', [first.id])).rows[0]).toEqual({ status: 'superseded', version: 2 });
    expect((await db.query('select status,failure_reason from public.device_commands where command_id=$1', [first.command_id])).rows[0]).toEqual({ status: 'failed', failure_reason: 'superseded_command' });
  });
  it('e: device counter continues across trips', async () => {
    const firstTrip = await fixture(); const first = await create(firstTrip);
    await db.query("update public.trips set status='completed',departed_at=now()-interval '1 hour',completed_at=now() where id=$1", [firstTrip.id]);
    await db.query("update public.shipments set status='completed' where id=$1", [firstTrip.shipment]);
    const secondTrip = await fixture({ device: firstTrip.device }); const second = await create(secondTrip);
    expect([first.config_version_no, second.config_version_no]).toEqual([1, 2]);
  });
  it('f,k: concurrent same-version requests both succeed with distinct numbers; trip version stays unchanged', async () => {
    const f = await fixture();
    const responses = await Promise.all([
      request(`/trips/${f.id}/temperature-configs`, 'admin', 'POST', { version: 1, target_min: -20, target_max: -18 }),
      request(`/trips/${f.id}/temperature-configs`, 'admin', 'POST', { version: 1, target_min: -22, target_max: -19 }),
    ]);
    expect(responses.map(r => r.status)).toEqual([201, 201]);
    const configs = await Promise.all(responses.map(r => r.json() as Promise<Config>));
    expect(configs.map(c => c.config_version_no).sort()).toEqual([1, 2]);
    expect((await db.query('select version from public.trips where id=$1', [f.id])).rows[0].version).toBe(1);
    expect((await db.query('select config_version_no,status from public.temperature_config_versions where trip_id=$1 order by config_version_no', [f.id])).rows).toEqual([
      { config_version_no: 1, status: 'superseded' }, { config_version_no: 2, status: 'approved' },
    ]);
  });
  it('g: invalid ranges fail API validation', async () => {
    const f = await fixture();
    for (const [min, max] of [[-20, -18.5], [-25.5, -18], [-20, -14.5], [-20.25, -18]]) await error(await request(`/trips/${f.id}/temperature-configs`, 'admin', 'POST', { version: 1, target_min: min, target_max: max }), 400, 'VALIDATION_FAILED');
    expect((await db.query('select id from public.temperature_config_versions where trip_id=$1', [f.id])).rowCount).toBe(0);
    expect((await db.query('select next_config_version_no from public.devices where id=$1', [f.device])).rows[0].next_config_version_no).toBe(1);
  });
  it.each(['completed', 'cancelled'])('h: %s trip rejects configuration', async status => {
    const f = await fixture();
    await db.query("update public.trips set status=$2,departed_at=now()-interval '1 hour',completed_at=now() where id=$1", [f.id, status]);
    await error(await request(`/trips/${f.id}/temperature-configs`, 'admin', 'POST', { version: 1, target_min: -20, target_max: -18 }), 422, 'UNPROCESSABLE');
  });
  it('i: driver/customer cannot create a configuration', async () => {
    const f = await fixture();
    for (const who of [f.owner, 'customer']) await error(await request(`/trips/${f.id}/temperature-configs`, who, 'POST', { version: 1, target_min: -20, target_max: -18 }), 403, 'FORBIDDEN');
  });
  it('j: stale trip version fails before allocation', async () => {
    const f = await fixture(); await db.query('update public.trips set version=2 where id=$1', [f.id]);
    const result = await error(await request(`/trips/${f.id}/temperature-configs`, 'admin', 'POST', { version: 1, target_min: -20, target_max: -18 }), 409, 'VERSION_CONFLICT');
    expect(result.details).toEqual({ current_version: 2 });
    expect((await db.query('select next_config_version_no from public.devices where id=$1', [f.device])).rows[0].next_config_version_no).toBe(1);
  });
  it('l: depart pins latest non-superseded configuration and requires fresh matching telemetry, without ACK', async () => {
    const f = await fixture(); await create(f); const latest = await create(f);
    await telemetry(f, 1);
    await error(await request(`/trips/${f.id}/depart`, f.owner, 'POST', { version: 1 }), 422, 'UNPROCESSABLE');
    await telemetry(f, latest.config_version_no, 61);
    await error(await request(`/trips/${f.id}/depart`, f.owner, 'POST', { version: 1 }), 422, 'UNPROCESSABLE');
    await telemetry(f, latest.config_version_no);
    const response = await request(`/trips/${f.id}/depart`, f.owner, 'POST', { version: 1 }); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ departure_config_version_id: latest.id, status: 'in_transit' });
    expect((await db.query('select status from public.temperature_config_versions where id=$1', [latest.id])).rows[0].status).toBe('approved');
    expect((await db.query('select id from public.device_command_acks where device_id=$1', [f.device])).rowCount).toBe(0);
  });
  it('m: no configuration preserves depart behavior from 2.4', async () => {
    const f = await fixture(); await telemetry(f, null);
    const response = await request(`/trips/${f.id}/depart`, f.owner, 'POST', { version: 1 }); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ departure_config_version_id: null, status: 'in_transit' });
  });
  it('n: config list is visible to admin and assigned driver only', async () => {
    const f = await fixture(); const first = await create(f); const second = await create(f);
    for (const who of ['admin', f.owner]) {
      const response = await request(`/trips/${f.id}/temperature-configs`, who); expect(response.status).toBe(200);
      expect((await response.json() as Config[]).map(row => row.id)).toEqual([first.id, second.id]);
    }
    for (const who of ['other', 'customer']) await error(await request(`/trips/${f.id}/temperature-configs`, who), 404, 'NOT_FOUND');
  });
  it('o: command/ACK reader uses trip scope and the internal command FK correctly', async () => {
    const f = await fixture(); const config = await create(f);
    const internal = (await db.query('select id from public.device_commands where command_id=$1', [config.command_id])).rows[0].id;
    const ack = randomUUID();
    // Reader fixture only: this does not implement ACK ingest or change status.
    await db.query("insert into public.device_command_acks(ack_id,command_id,device_id,result,reason,retry_after_seconds,received_at) values($1,$2,$3,'rejected','min_switch_interval',20,now())", [ack, internal, f.device]);
    for (const who of ['admin', f.owner]) {
      const response = await request(`/device-commands/${config.command_id}`, who); expect(response.status).toBe(200);
      const body = await response.json(); expect(body).toMatchObject({ command_id: config.command_id, status: 'queued', failure_reason: null,
        acks: [{ ack_id: ack, result: 'rejected', reason: 'min_switch_interval', retry_after_seconds: 20 }] });
      expect(body.payload).toBeUndefined();
    }
    for (const who of ['other', 'customer']) await error(await request(`/device-commands/${config.command_id}`, who), 404, 'NOT_FOUND');
    await error(await request(`/device-commands/${randomUUID()}`), 404, 'NOT_FOUND');
  });
  it('p: idempotent replay creates exactly one config/command/outbox and does not consume another number', async () => {
    const f = await fixture(); const key = randomUUID(); const first = await create(f, {}, key); const replay = await create(f, {}, key);
    expect(replay).toEqual(first);
    expect((await db.query('select id from public.temperature_config_versions where trip_id=$1', [f.id])).rowCount).toBe(1);
    expect((await db.query('select id from public.device_commands where trip_id=$1', [f.id])).rowCount).toBe(1);
    expect((await db.query("select id from public.outbox_events where payload->>'command_id'=$1", [first.command_id])).rowCount).toBe(1);
    expect((await db.query('select next_config_version_no from public.devices where id=$1', [f.device])).rows[0].next_config_version_no).toBe(2);
  });
  it('sent configs are superseded; applied configs and acknowledged commands are retained', async () => {
    const f = await fixture(); const first = await create(f);
    await db.query("update public.temperature_config_versions set status='sent' where id=$1", [first.id]);
    await db.query("update public.device_commands set status='sent' where command_id=$1", [first.command_id]);
    const second = await create(f);
    expect((await db.query('select status from public.temperature_config_versions where id=$1', [first.id])).rows[0].status).toBe('superseded');
    expect((await db.query('select failure_reason from public.device_commands where command_id=$1', [first.command_id])).rows[0].failure_reason).toBe('superseded_command');
    await db.query("update public.temperature_config_versions set status='applied',applied_at=now() where id=$1", [second.id]);
    await db.query("update public.device_commands set status='acked_applied' where command_id=$1", [second.command_id]);
    await create(f);
    expect((await db.query('select status from public.temperature_config_versions where id=$1', [second.id])).rows[0].status).toBe('applied');
    expect((await db.query('select status from public.device_commands where command_id=$1', [second.command_id])).rows[0].status).toBe('acked_applied');
  });
  it('in_transit configuration is allowed without changing trip version or departure pin', async () => {
    const f = await fixture(); await telemetry(f, null);
    const started = await request(`/trips/${f.id}/depart`, f.owner, 'POST', { version: 1 }); expect(started.status).toBe(200);
    const before = await started.json(); await create(f, { version: before.version });
    expect((await db.query('select version,departure_config_version_id from public.trips where id=$1', [f.id])).rows[0]).toEqual({ version: before.version, departure_config_version_id: null });
  });
  it('a late audit failure rolls back supersession, allocation, new command and outbox', async () => {
    const f = await fixture(); const first = await create(f);
    const before = (await db.query('select count(*)::int as n from public.audit_logs where actor_id=$1', [accounts.admin.id])).rows[0].n;
    await db.query(`alter table public.audit_logs add constraint be25_atomic_failure check(entity_id <> '${f.device}' or action <> 'devices.allocate_config_version') not valid`);
    try { await error(await request(`/trips/${f.id}/temperature-configs`, 'admin', 'POST', { version: 1, target_min: -22, target_max: -19 }), 500, 'INTERNAL'); }
    finally { await db.query('alter table public.audit_logs drop constraint be25_atomic_failure'); }
    expect((await db.query('select config_version_no,status from public.temperature_config_versions where trip_id=$1', [f.id])).rows).toEqual([{ config_version_no: 1, status: 'approved' }]);
    expect((await db.query('select status,failure_reason from public.device_commands where trip_id=$1', [f.id])).rows).toEqual([{ status: 'queued', failure_reason: null }]);
    expect((await db.query("select id from public.outbox_events where payload->>'device_id'=$1", [f.device])).rowCount).toBe(1);
    expect((await db.query('select next_config_version_no from public.devices where id=$1', [f.device])).rows[0].next_config_version_no).toBe(2);
    expect((await db.query('select count(*)::int as n from public.audit_logs where actor_id=$1', [accounts.admin.id])).rows[0].n).toBe(before);
    expect((await create(f)).config_version_no).toBe(first.config_version_no + 1);
  });
  it('required key/version and extra fields use the standard error shape', async () => {
    const f = await fixture();
    await error(await request(`/trips/${f.id}/temperature-configs`, 'admin', 'POST', { version: 1, target_min: -20, target_max: -18 }, null), 400, 'IDEMPOTENCY_KEY_REQUIRED');
    await error(await request(`/trips/${f.id}/temperature-configs`, 'admin', 'POST', { target_min: -20, target_max: -18 }), 400, 'VALIDATION_FAILED');
    await error(await request(`/trips/${f.id}/temperature-configs`, 'admin', 'POST', { version: 1, target_min: -20, target_max: -18, device_id: randomUUID() }), 400, 'VALIDATION_FAILED');
  });
  it('r: real MQTT subscriber sees no publication; command and outbox remain queued/pending', async () => {
    const secret = parse(readFileSync('secrets/devices/SIM-01.env'));
    let observer: MqttClient | undefined; let f: Fixture | undefined;
    try {
      observer = await connectAsync('mqtts://127.0.0.1:8883', { username: 'SIM-01', password: secret.DEVICE_PASSWORD,
        ca: readFileSync('infra/mosquitto/certs/ca.crt'), rejectUnauthorized: true, reconnectPeriod: 0, connectTimeout: 3000, protocolVersion: 5 });
      const seen: string[] = []; observer.on('message', (_, payload) => seen.push(payload.toString()));
      const granted = await observer.subscribeAsync('devices/SIM-01/commands'); expect(granted[0].qos).toBeLessThan(128);
      f = await fixture({ code: 'SIM-01' }); const config = await create(f);
      await delay(300);
      expect(seen.some(message => message.includes(config.command_id))).toBe(false);
      expect((await db.query('select status from public.device_commands where command_id=$1', [config.command_id])).rows[0].status).toBe('queued');
      expect((await db.query("select status,attempts from public.outbox_events where payload->>'command_id'=$1", [config.command_id])).rows).toEqual([{ status: 'pending', attempts: 0 }]);
      expect((await db.query('select id from public.device_command_attempts where command_id=(select id from public.device_commands where command_id=$1)', [config.command_id])).rowCount).toBe(0);
    } finally {
      await observer?.endAsync(true);
      // Release the reused simulation device for standalone reruns of this suite.
      if (f) { await db.query("update public.trips set status='cancelled' where id=$1", [f.id]); await db.query("update public.shipments set status='cancelled' where id=$1", [f.shipment]); }
    }
  }, 15000);
  it('q: every write is audited with the correct admin actor and without tokens', async () => {
    const rows = (await db.query('select * from public.audit_logs where actor_id=$1', [accounts.admin.id])).rows;
    for (const [action, entity] of [['temperature_configs.create', 'temperature_config_versions'], ['temperature_configs.supersede', 'temperature_config_versions'],
      ['device_commands.create', 'device_commands'], ['device_commands.supersede', 'device_commands'], ['outbox_events.create', 'outbox_events'], ['devices.allocate_config_version', 'devices']]) {
      expect(rows.some(row => row.action === action && row.entity === entity)).toBe(true);
    }
    expect(rows.every(row => row.actor_id === accounts.admin.id)).toBe(true);
    const text = JSON.stringify(rows) + logs.join('\n');
    for (const account of Object.values(accounts)) expect(text).not.toContain(account.token);
    expect(JSON.stringify(rows.map(row => row.payload))).not.toMatch(/token|password/);
  });
});
