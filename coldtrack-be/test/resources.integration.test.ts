import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { randomBytes, randomUUID, pbkdf2Sync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import pg from 'pg';
import { hashMosquittoCredential, MOSQUITTO_HASH_ITERATIONS } from '../libs/credentials/mosquitto-hash.js';

const env = { ...(existsSync('../.env') ? parse(readFileSync('../.env')) : {}), ...process.env };

describe('resources migration (real PostgreSQL)', () => {
  const db = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 10000 });
  let connected = false;
  const tables = ['vehicles', 'devices', 'device_credentials', 'device_assignments'];
  const users = { admin: randomUUID(), customer: randomUUID(), driver: randomUUID(), pending: randomUUID(), suspended: randomUUID() };
  const vehicle = randomUUID();
  const secondVehicle = randomUUID();
  const device = randomUUID();
  const secondDevice = randomUUID();
  const password = randomBytes(24).toString('hex');
  let hash: string;

  beforeAll(async () => {
    hash = await hashMosquittoCredential(password);
    await db.connect();
    connected = true;
    await db.query('begin');
    // Local transactional auth fixtures only; no auth flow or persistent users.
    for (const [name, id] of Object.entries(users)) {
      await db.query('insert into auth.users (id, email) values ($1, $2)', [id, `${id}@example.test`]);
      await db.query('set local role service_role');
      await db.query('insert into public.profiles (id) values ($1)', [id]);
      await db.query(`insert into public.account_access (user_id, role_id, status)
        select $1, id, $3 from public.roles where code = $2`,
      [id, ['pending', 'suspended'].includes(name) ? 'admin' : name, ['pending', 'suspended'].includes(name) ? name : 'active']);
      await db.query('reset role');
    }
    await db.query('set local role service_role');
    await db.query('insert into public.vehicles (id, plate) values ($1, $2), ($3, $4)', [vehicle, `TEST-${vehicle}`, secondVehicle, `TEST-${secondVehicle}`]);
    await db.query('insert into public.devices (id, device_code) values ($1, $2), ($3, $4)', [device, `TEST-${device}`, secondDevice, `TEST-${secondDevice}`]);
    await db.query('insert into public.device_credentials (device_id, credential_hash, active) values ($1, $2, true)', [device, hash]);
    await db.query(`insert into public.device_assignments (device_id, vehicle_id, valid_from) values ($1, $2, '2026-01-01T00:00:00Z')`, [device, vehicle]);
    await db.query('reset role');
  }, 15000);

  afterAll(async () => {
    if (connected) await db.query('rollback');
    await db.end();
  });

  async function isolated<T>(run: () => Promise<T>) {
    await db.query('savepoint resource_test');
    try { return await run(); }
    finally {
      await db.query('rollback to savepoint resource_test');
      await db.query('release savepoint resource_test');
    }
  }
  async function rejected(sql: string, values: unknown[], code: string) {
    await expect(isolated(() => db.query(sql, values))).rejects.toMatchObject({ code });
  }
  async function asClient<T>(user: string | null, run: () => Promise<T>) {
    return isolated(async () => {
      await db.query(user ? 'set local role authenticated' : 'set local role anon');
      await db.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
        [user ?? '', JSON.stringify({ sub: user, role: user ? 'authenticated' : 'anon' })]);
      return run();
    });
  }

  it('b: rejects duplicate plates', async () => {
    await rejected('insert into public.vehicles (plate) values ($1)', [`TEST-${vehicle}`], '23505');
  });
  it('c: rejects duplicate device_code', async () => {
    await rejected('insert into public.devices (device_code) values ($1)', [`TEST-${device}`], '23505');
  });
  it('d: rejects two open devices per vehicle and allows reassignment after closing', async () => {
    await rejected('insert into public.device_assignments (device_id, vehicle_id, valid_from) values ($1, $2, now())', [secondDevice, vehicle], '23505');
    await isolated(async () => {
      await db.query(`update public.device_assignments set valid_to = '2026-01-02T00:00:00Z' where device_id = $1`, [device]);
      await db.query(`insert into public.device_assignments (device_id, vehicle_id, valid_from) values ($1, $2, '2026-01-02T00:00:00Z')`, [secondDevice, vehicle]);
    });
  });
  it('e: rejects two open assignments per device', async () => {
    await rejected('insert into public.device_assignments (device_id, vehicle_id, valid_from) values ($1, $2, now())', [device, secondVehicle], '23505');
  });
  it('f: rejects valid_to <= valid_from', async () => {
    for (const validTo of ['2026-01-01T00:00:00Z', '2025-12-31T00:00:00Z']) {
      await rejected(`insert into public.device_assignments (device_id, vehicle_id, valid_from, valid_to)
        values ($1, $2, '2026-01-01T00:00:00Z', $3)`, [secondDevice, secondVehicle, validTo], '23514');
    }
  });
  it('g: rejects two active credentials and permits revoked history', async () => {
    await rejected('insert into public.device_credentials (device_id, credential_hash, active) values ($1, $2, true)', [device, hash], '23505');
    await isolated(async () => {
      await db.query('insert into public.device_credentials (device_id, credential_hash, active, revoked_at) values ($1, $2, false, now())', [device, hash]);
      await db.query('update public.device_credentials set active = false, revoked_at = now() where device_id = $1', [device]);
      await db.query('insert into public.device_credentials (device_id, credential_hash, active) values ($1, $2, true)', [device, hash]);
    });
  });
  it('h: rejects reversed/equal temperature capacity, accepts null bounds', async () => {
    for (const min of [-15, -14]) {
      await rejected('insert into public.vehicles (plate, temp_capacity_min, temp_capacity_max) values ($1, $2, -15)', [randomUUID(), min], '23514');
    }
    await isolated(() => db.query('insert into public.vehicles (plate, temp_capacity_min) values ($1, -30)', [randomUUID()]));
  });
  it('i: enforces lifecycle statuses, defaults and config counter >= 1', async () => {
    expect((await db.query('select status, version from public.vehicles where id = $1', [vehicle])).rows[0]).toEqual({ status: 'active', version: 1 });
    expect((await db.query('select status, version, next_config_version_no, is_simulated, last_seen_at from public.devices where id = $1', [device])).rows[0])
      .toEqual({ status: 'active', version: 1, next_config_version_no: 1, is_simulated: false, last_seen_at: null });
    for (const status of ['maintenance', 'inactive']) await isolated(() => db.query('update public.vehicles set status = $1 where id = $2', [status, vehicle]));
    for (const status of ['disabled', 'retired']) await isolated(() => db.query('update public.devices set status = $1 where id = $2', [status, device]));
    for (const status of ['online', 'offline', 'unknown']) {
      await rejected('update public.vehicles set status = $1 where id = $2', [status, vehicle], '23514');
      await rejected('update public.devices set status = $1 where id = $2', [status, device], '23514');
    }
    await rejected('update public.devices set next_config_version_no = 0 where id = $1', [device], '23514');
    await isolated(() => db.query('update public.devices set next_config_version_no = 2 where id = $1', [device]));
  });
  it('j: only active admin reads resources; driver scope remains deferred', async () => {
    for (const [name, id] of Object.entries(users)) {
      await asClient(id, async () => {
        for (const table of ['vehicles', 'devices', 'device_assignments']) {
          const count = (await db.query(`select * from public.${table}`)).rowCount;
          expect((count ?? 0) > 0).toBe(name === 'admin');
        }
      });
    }
    for (const table of ['vehicles', 'devices', 'device_assignments']) {
      await expect(asClient(null, () => db.query(`select * from public.${table}`))).rejects.toMatchObject({ code: '42501' });
    }
  });
  it('k: no client can read credentials, even active admin', async () => {
    for (const id of [...Object.values(users), null]) {
      await expect(asClient(id, () => db.query('select credential_hash from public.device_credentials'))).rejects.toMatchObject({ code: '42501' });
    }
  });
  it('l: no direct client writes to any resource table', async () => {
    for (const role of ['anon', 'authenticated']) for (const table of tables) {
      for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
        expect((await db.query('select has_table_privilege($1, $2, $3) as allowed', [role, `public.${table}`, privilege])).rows[0].allowed).toBe(false);
      }
      const query = table === 'vehicles' ? 'update public.vehicles set version = version + 1'
        : table === 'devices' ? 'update public.devices set next_config_version_no = next_config_version_no + 1'
          : table === 'device_credentials' ? 'update public.device_credentials set active = false'
            : 'delete from public.device_assignments';
      await expect(asClient(role === 'anon' ? null : users.admin, () => db.query(query))).rejects.toMatchObject({ code: '42501' });
    }
  });
  it('m: exact credential schema has only hash storage; rejects plaintext', async () => {
    const columns = (await db.query(`select column_name from information_schema.columns where table_schema = 'public'
      and table_name = 'device_credentials' order by ordinal_position`)).rows.map((r: { column_name: string }) => r.column_name);
    expect(columns).toEqual(['id', 'device_id', 'credential_hash', 'active', 'revoked_at', 'provisioning_status', 'created_at']);
    await rejected('insert into public.device_credentials (device_id, credential_hash, active) values ($1, $2, false)', [device, password], '23514');
    expect((await db.query('select credential_hash from public.device_credentials where device_id = $1', [device])).rows[0].credential_hash).toBe(hash);
  });
  it('enables RLS on all four tables and uses timestamptz for every timestamp', async () => {
    const rls = await db.query(`select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = any($1)`, [tables]);
    expect(rls.rows).toHaveLength(4);
    expect(rls.rows.every((r: { relrowsecurity: boolean }) => r.relrowsecurity)).toBe(true);
    const timestamps = await db.query(`select data_type from information_schema.columns where table_schema = 'public'
      and table_name = any($1) and column_name in ('created_at','updated_at','last_seen_at','revoked_at','valid_from','valid_to')`, [tables]);
    expect(timestamps.rows).toHaveLength(9);
    expect(timestamps.rows.every((r: { data_type: string }) => r.data_type === 'timestamp with time zone')).toBe(true);
    expect((await db.query(`select column_name from information_schema.columns where table_schema = 'public'
      and table_name = 'devices' and column_name = 'connection_state'`)).rowCount).toBe(0);
  });
  it('hash matches native mosquitto_passwd PBKDF2 format and stores without alteration', async () => {
    const native = execFileSync('docker', ['run', '--rm', '-i', '--network', 'none', '--entrypoint', 'sh', 'eclipse-mosquitto:2', '-c',
      'set -eu; read -r password; mosquitto_passwd -H sha512-pbkdf2 -b -c /tmp/test-passwd fixture "$password" >/dev/null; cat /tmp/test-passwd'],
    { input: `${password}\n`, encoding: 'utf8', timeout: 20000, stdio: ['pipe', 'pipe', 'pipe'] }).trim().split(':')[1];
    for (const record of [hash, native]) {
      const [, algorithm, iterations, salt, digest] = record.split('$');
      expect(algorithm).toBe('7');
      expect(Number(iterations)).toBeGreaterThan(0);
      expect([12, 64]).toContain(Buffer.from(salt, 'base64').length);
      expect(pbkdf2Sync(password, Buffer.from(salt, 'base64'), Number(iterations), 64, 'sha512').toString('base64')).toBe(digest);
    }
    expect(hash.split('$')[2]).toBe(String(MOSQUITTO_HASH_ITERATIONS));
    // Prove Mosquitto accepts our stronger iteration count, even for image
    // versions whose mosquitto_passwd CLI does not expose the newer -I flag.
    const verified = execFileSync('docker', ['run', '--rm', '-i', '--network', 'none', '--entrypoint', 'sh', 'eclipse-mosquitto:2', '-c',
      'set -eu; read -r password; read -r record; printf "fixture:%s\\n" "$record" > /tmp/passwords; chmod 644 /tmp/passwords; '
      + 'printf "listener 1883 127.0.0.1\\nallow_anonymous false\\npassword_file /tmp/passwords\\n" > /tmp/test.conf; '
      + 'mosquitto -c /tmp/test.conf > /tmp/broker.log 2>&1 & broker=$!; trap "kill $broker 2>/dev/null || true" EXIT; '
      + 'sleep 2; mosquitto_sub -V mqttv311 -h 127.0.0.1 -u fixture -P "$password" -t test/hash -C 1 -W 5 > /tmp/message & sub=$!; '
      + 'sleep 2; mosquitto_pub -V mqttv311 -h 127.0.0.1 -u fixture -P "$password" -t test/hash -m verified; wait "$sub"; cat /tmp/message'],
    { input: `${password}\n${hash}\n`, encoding: 'utf8', timeout: 20000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    expect(verified).toBe('verified');
    await isolated(async () => {
      await db.query('insert into public.device_credentials (device_id, credential_hash, active) values ($1, $2, false)', [device, native]);
      expect((await db.query('select credential_hash from public.device_credentials where credential_hash = $1', [native])).rows[0].credential_hash).toBe(native);
    });
  }, 30000);
});
