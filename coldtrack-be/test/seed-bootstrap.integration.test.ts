import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parse } from 'dotenv';
import pg from 'pg';

const env = { ...(existsSync('../.env') ? parse(readFileSync('../.env')) : {}), ...process.env };
const demoCodes = ['CT-001', 'SIM-01', 'SIM-02', 'SIM-03', 'SIM-04'];
const seedMarker = 'coldtrack_step_1_8';
const credentialPath = resolve('.env.local');

function localStatus() {
  let status: { DB_URL?: string; API_URL?: string; SECRET_KEY?: string; PUBLISHABLE_KEY?: string };
  try {
    const output = execFileSync(process.execPath, [
      resolve('node_modules/supabase/dist/supabase.js'), 'status', '--workdir', '..', '--output', 'json',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 });
    status = JSON.parse(output) as typeof status;
  } catch {
    throw new Error('Could not read local Supabase status for DoAnTotNghiep');
  }
  const target = new URL(env.DATABASE_URL ?? '');
  if (!status.DB_URL || !status.API_URL || !status.SECRET_KEY || !status.PUBLISHABLE_KEY
      || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || target.port !== '54322'
      || target.pathname !== '/postgres' || target.port !== new URL(status.DB_URL).port
      || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(status.API_URL).hostname)) {
    throw new Error('Integration seed requires DATABASE_URL and Auth on the DoAnTotNghiep local stack');
  }
  return { api: status.API_URL, secret: status.SECRET_KEY, publishable: status.PUBLISHABLE_KEY };
}

function authClient(url: string, key: string) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10000) }) },
  });
}

function demoCredentials() {
  const values = parse(readFileSync(credentialPath));
  return Object.keys(values).filter(key => /^DEMO_(?:ADMIN|CUSTOMER_\d{2}|DRIVER_\d{2})_EMAIL$/.test(key)).sort()
    .map(key => ({ email: values[key], password: values[key.replace(/_EMAIL$/, '_PASSWORD')] }));
}

describe('demo seed and server bootstrap (real PostgreSQL and Auth)', () => {
  const db = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 10000 });
  let status: ReturnType<typeof localStatus>;
  let operator: SupabaseClient;

  function seed() {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/seed-demo.ts'], {
      env: { ...process.env, DATABASE_URL: env.DATABASE_URL, SUPABASE_URL: status.api, SUPABASE_SECRET_KEY: status.secret },
      stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000,
    });
    if (result.status !== 0) {
      throw new Error(`Demo seed subprocess failed (${result.status ?? result.error?.name ?? 'unknown'})`);
    }
  }

  beforeAll(async () => {
    status = localStatus();
    operator = authClient(status.api, status.secret);
    await db.connect();
    seed();
  }, 90000);

  afterAll(async () => {
    await db.end();
  });

  async function seedState() {
    const users = (await db.query(`select u.id, u.email, r.code as role, a.status, a.activated_by,
      p.full_name, p.phone, p.email as profile_email
      from auth.users u join public.profiles p on p.id = u.id
      join public.account_access a on a.user_id = u.id join public.roles r on r.id = a.role_id
      where u.raw_app_meta_data->>'coldtrack_seed' = $1 order by u.email`, [seedMarker])).rows;
    const vehicles = (await db.query("select id, plate, status, temp_capacity_min, temp_capacity_max, payload_kg from public.vehicles where plate like 'DEMO-%' order by plate")).rows;
    const devices = (await db.query('select id, device_code, vehicle_id, is_simulated, status from public.devices where device_code = any($1::text[]) order by device_code', [demoCodes])).rows;
    const assignments = (await db.query(`select a.id, a.device_id, a.vehicle_id, a.valid_from
      from public.device_assignments a join public.devices d on d.id = a.device_id
      join public.vehicles v on v.id = a.vehicle_id where a.valid_to is null
      and (d.device_code = any($1::text[]) or v.plate like 'DEMO-%') order by d.device_code`, [demoCodes])).rows;
    return { users, vehicles, devices, assignments };
  }

  async function signIn(credential: { email: string; password: string }) {
    const client = authClient(status.api, status.publishable);
    const { data, error } = await client.auth.signInWithPassword(credential);
    if (error || !data.user || !data.session) throw new Error('Demo login with locally stored credentials failed');
    return { id: data.user.id, client };
  }

  it('b: seeds nine active accounts and five matching vehicles, devices and open assignments', async () => {
    const { users, vehicles, devices, assignments } = await seedState();
    expect(users).toHaveLength(9);
    expect(users.map(user => user.role).sort()).toEqual(['admin', ...Array(3).fill('customer'), ...Array(5).fill('driver')]);
    const admin = users.find(user => user.role === 'admin');
    for (const user of users) {
      expect(user).toMatchObject({ status: 'active', activated_by: admin?.id, profile_email: user.email });
      expect(Boolean(user.full_name && user.phone)).toBe(true);
    }
    expect(vehicles.map(vehicle => vehicle.plate)).toEqual(demoCodes.map(code => `DEMO-${code}`));
    expect(vehicles.every(vehicle => vehicle.status === 'active' && Number(vehicle.temp_capacity_min) < Number(vehicle.temp_capacity_max)
      && Number(vehicle.payload_kg) > 0)).toBe(true);
    expect(devices.map(device => ({ code: device.device_code, is_simulated: device.is_simulated, status: device.status })))
      .toEqual(demoCodes.map(code => ({ code, is_simulated: code.startsWith('SIM-'), status: 'active' })));
    expect(assignments).toHaveLength(5);
    expect((await db.query(`select count(*)::int as count from public.device_credentials c
      join public.devices d on d.id = c.device_id where d.device_code = any($1::text[])`, [demoCodes])).rows[0].count).toBe(0);
    expect((await db.query(`select
      (select count(*) from public.shipments s join auth.users u on u.id = s.customer_id
        where u.raw_app_meta_data->>'coldtrack_seed' = $1)::int as shipments,
      (select count(*) from public.trips t join public.devices d on d.id = t.device_id
        where d.device_code = any($2::text[]))::int as trips,
      (select count(*) from public.telemetry_readings r join public.devices d on d.id = r.device_id
        where d.device_code = any($2::text[]))::int as telemetry`, [seedMarker, demoCodes])).rows)
      .toEqual([{ shipments: 0, trips: 0, telemetry: 0 }]);
  });

  it('c: each open assignment matches both the intended vehicle and the device vehicle_id', async () => {
    const { vehicles, devices, assignments } = await seedState();
    expect(new Set(assignments.map(row => row.vehicle_id)).size).toBe(5);
    expect(new Set(assignments.map(row => row.device_id)).size).toBe(5);
    for (const device of devices) {
      const vehicle = vehicles.find(row => row.plate === `DEMO-${device.device_code}`);
      expect(device.vehicle_id).toBe(vehicle?.id);
      expect(assignments.filter(row => row.device_id === device.id)).toEqual([
        expect.objectContaining({ vehicle_id: vehicle?.id }),
      ]);
    }
  });

  it('d/e: second seed preserves row identity, counts and credentials that already authenticate', async () => {
    const before = await seedState();
    const credentials = demoCredentials();
    expect(credentials).toHaveLength(9);
    const adminEmail = before.users.find(user => user.role === 'admin')?.email;
    const credential = credentials.find(entry => entry.email === adminEmail);
    if (!credential?.password) throw new Error('Expected a demo admin password in ignored .env.local');
    const prior = await signIn(credential);
    seed();
    expect(await seedState()).toEqual(before);
    expect(JSON.stringify(demoCredentials()) === JSON.stringify(credentials)).toBe(true);
    const after = await signIn(credential);
    expect(after.id).toBe(prior.id);
  }, 90000);

  it('f: public schema has no password columns and database rows contain hashes rather than demo plaintext', async () => {
    const publicPasswordColumns = await db.query(`select table_name, column_name from information_schema.columns
      where table_schema = 'public' and column_name ~* '(password|passwd|plaintext)'`);
    expect(publicPasswordColumns.rowCount).toBe(0);
    const auth = await db.query<{ document: string; hashed: boolean }>(`select to_jsonb(u)::text as document,
      coalesce(u.encrypted_password like '$2%', false) as hashed from auth.users u
      where u.raw_app_meta_data->>'coldtrack_seed' = $1`, [seedMarker]);
    expect(auth.rowCount).toBe(9);
    expect(auth.rows.every(row => row.hashed)).toBe(true);
    const passwords = demoCredentials().map(entry => entry.password);
    expect(passwords.length === 9 && passwords.every(password => /^[0-9a-f]{48}$/.test(password))).toBe(true);
    const application = JSON.stringify(await seedState());
    expect(passwords.some(password => application.includes(password) || auth.rows.some(row => row.document.includes(password)))).toBe(false);
  });

  it('g: Git ignores the local credential file and its temporary replacement', () => {
    const ignored = execFileSync('git', ['check-ignore', '--', '.env.local', '.env.local.seed-check'], { encoding: 'utf8' });
    expect(ignored.trim().split(/\r?\n/).sort()).toEqual(['.env.local', '.env.local.seed-check']);
    expect(execFileSync('git', ['ls-files', '--', '.env.local'], { encoding: 'utf8' }).trim()).toBe('');
  });

  it('h: a real public signup cannot bootstrap admin, even with crafted user metadata', async () => {
    const client = authClient(status.api, status.publishable);
    const { data, error } = await client.auth.signUp({
      email: `signup-${randomUUID()}@example.test`, password: randomBytes(24).toString('hex'),
      options: { data: { role: 'admin', coldtrack_seed: seedMarker } },
    });
    if (error || !data.user || !data.session) throw new Error('Expected local public signup to create a regular Auth session');
    try {
      const result = await db.query(`select exists(select 1 from public.account_access where user_id = $1) as has_access,
        exists(select 1 from auth.users where id = $1 and raw_app_meta_data->>'coldtrack_seed' = $2) as has_server_marker`,
      [data.user.id, seedMarker]);
      expect(result.rows).toEqual([{ has_access: false, has_server_marker: false }]);
      const insert = await client.from('account_access').insert({ user_id: data.user.id, status: 'active', role_id: randomUUID() });
      expect(insert.error?.code).toBe('42501');
    } finally {
      const removed = await operator.auth.admin.deleteUser(data.user.id);
      expect(Boolean(removed.error)).toBe(false);
    }
  }, 30000);

  it('i: seeded users can log in and inactive ones cannot read business rows', async () => {
    const credentials = demoCredentials();
    const { users } = await seedState();
    expect(credentials).toHaveLength(9);
    for (const credential of credentials) {
      const signedIn = await signIn(credential);
      expect(signedIn.id).toBe(users.find(user => user.email === credential.email)?.id);
    }
    const admin = users.find(user => user.role === 'admin');
    await db.query('begin');
    try {
      for (const accessStatus of ['active', 'pending', 'suspended']) {
        await db.query('reset role');
        await db.query('update public.account_access set status = $1 where user_id = $2', [accessStatus, admin.id]);
        await db.query('set local role authenticated');
        await db.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
          [admin.id, JSON.stringify({ sub: admin.id, role: 'authenticated' })]);
        for (const table of ['vehicles', 'devices', 'device_assignments']) {
          const result = await db.query(`select id from public.${table}`);
          expect(result.rows.length >= 5).toBe(accessStatus === 'active');
          if (accessStatus !== 'active') expect(result.rowCount).toBe(0);
        }
      }
    } finally {
      await db.query('rollback');
    }
  }, 60000);

  it('k: active demo admin still cannot read device_credentials from the client', async () => {
    const { users } = await seedState();
    const email = users.find(user => user.role === 'admin')?.email;
    const credential = demoCredentials().find(entry => entry.email === email);
    if (!credential) throw new Error('Expected demo admin credentials');
    const signedIn = await signIn(credential);
    const result = await signedIn.client.from('device_credentials').select('id');
    expect(result.error?.code).toBe('42501');
  }, 15000);
});
