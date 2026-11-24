import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import pg from 'pg';

const env = { ...(existsSync('../.env') ? parse(readFileSync('../.env')) : {}), ...process.env };
const minute = '2026-01-01T00:00:00Z';
const laterMinute = '2026-01-01T00:01:00Z';

describe('telemetry migration (real PostgreSQL)', () => {
  const db = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 10000 });
  let connected = false;
  const accounts = [
    { name: 'admin', role: 'admin', status: 'active' },
    { name: 'driver', role: 'driver', status: 'active' },
    { name: 'otherDriver', role: 'driver', status: 'active' },
    { name: 'customer', role: 'customer', status: 'active' },
    { name: 'pending', role: 'admin', status: 'pending' },
    { name: 'suspended', role: 'admin', status: 'suspended' },
  ].map(account => ({ ...account, id: randomUUID() }));
  const [admin, driver, otherDriver, customer] = accounts;
  const fixtures = [driver, otherDriver].map(owner => ({
    owner: owner.id,
    device: randomUUID(),
    vehicle: randomUUID(),
    shipment: randomUUID(),
    trip: randomUUID(),
    boot: randomUUID(),
    message: randomUUID(),
    event: randomUUID(),
  }));
  const [own, other] = fixtures;
  const unassignedDevice = randomUUID();
  const tablesWithTrips = ['telemetry_readings', 'device_events', 'telemetry_rollups_minute'];
  const tables = [...tablesWithTrips, 'device_latest_state'];
  const insertReading = `insert into public.telemetry_readings
    (message_id, device_id, trip_id, boot_id, sequence_no, monotonic_ms, time_source, time_quality, received_at)
    values ($1, $2, $3, $4, $5, 100, 'unknown', 'unknown', $6)`;
  const insertEvent = `insert into public.device_events (event_id, device_id, trip_id, type, received_at)
    values ($1, $2, $3, $4, $5)`;
  const insertRollup = `insert into public.telemetry_rollups_minute
    (device_id, trip_id, config_version_id, minute_utc, window_seconds, covered_seconds, missing_seconds,
     sample_count, valid_sample_count, temp_min, temp_avg, temp_max)
    values ($1, $2, $3, $4, 60, 40, 20, 3, 2, -21, -20, -19)`;

  beforeAll(async () => {
    await db.connect();
    connected = true;
    await db.query('begin');
    for (const account of accounts) {
      await db.query('insert into auth.users (id, email) values ($1, $2)', [account.id, `${account.id}@example.test`]);
    }
    await db.query('set local role service_role');
    for (const account of accounts) {
      await db.query('insert into public.profiles (id) values ($1)', [account.id]);
      await db.query(`insert into public.account_access (user_id, role_id, status)
        select $1, id, $3 from public.roles where code = $2`, [account.id, account.role, account.status]);
    }
    for (const fixture of fixtures) {
      await db.query('insert into public.vehicles (id, plate) values ($1, $2)', [fixture.vehicle, `TEST-${fixture.vehicle}`]);
      await db.query('insert into public.devices (id, device_code) values ($1, $2)', [fixture.device, `TEST-${fixture.device}`]);
      await db.query(`insert into public.shipments (id, customer_id, product_type, temp_min, temp_max)
        values ($1, $2, 'test-only', -20, -18)`, [fixture.shipment, customer.id]);
      await db.query(`insert into public.trips (id, shipment_id, vehicle_id, driver_id, device_id)
        values ($1, $2, $3, $4, $5)`, [fixture.trip, fixture.shipment, fixture.vehicle, fixture.owner, fixture.device]);
      await db.query(insertReading, [fixture.message, fixture.device, fixture.trip, fixture.boot, 1, minute]);
      await db.query(insertEvent, [fixture.event, fixture.device, fixture.trip, 'test-event', minute]);
      await db.query(insertRollup, [fixture.device, fixture.trip, null, minute]);
      await db.query(`insert into public.device_latest_state (device_id, active_boot_id, last_sequence_no, updated_at)
        values ($1, $2, 1, $3)`, [fixture.device, fixture.boot, minute]);
    }
    await db.query('insert into public.devices (id, device_code) values ($1, $2)', [unassignedDevice, `TEST-${unassignedDevice}`]);
    await db.query(insertReading, [randomUUID(), unassignedDevice, null, randomUUID(), 1, minute]);
    await db.query(insertEvent, [randomUUID(), unassignedDevice, null, 'test-event', minute]);
    await db.query(insertRollup, [unassignedDevice, null, null, minute]);
  }, 30000);

  afterAll(async () => {
    try {
      if (connected) await db.query('rollback');
    } finally {
      await db.end();
    }
  });

  async function isolated<T>(run: () => Promise<T>) {
    await db.query('savepoint telemetry_test');
    try {
      return await run();
    } finally {
      await db.query('rollback to savepoint telemetry_test');
      await db.query('release savepoint telemetry_test');
    }
  }

  async function asClient<T>(id: string | null, run: () => Promise<T>) {
    return isolated(async () => {
      const role = id ? 'authenticated' : 'anon';
      await db.query(`set local role ${role}`);
      await db.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
        [id ?? '', JSON.stringify({ sub: id, role })]);
      return run();
    });
  }

  async function rejectsCheck(sql: string, args: unknown[]) {
    await expect(isolated(() => db.query(sql, args))).rejects.toMatchObject({ code: '23514' });
  }

  it('b: rejects duplicate message_id even with a different sequence', async () => {
    await expect(isolated(() => db.query(insertReading, [own.message, own.device, own.trip, own.boot, 2, minute])))
      .rejects.toMatchObject({ code: '23505', constraint: 'telemetry_readings_message_id_key' });
  });

  it('c: enforces sequence uniqueness per device and boot', async () => {
    await expect(isolated(() => db.query(insertReading, [randomUUID(), own.device, own.trip, own.boot, 1, minute])))
      .rejects.toMatchObject({ code: '23505', constraint: 'telemetry_readings_device_boot_sequence_key' });
    await isolated(async () => {
      await db.query(insertReading, [randomUUID(), own.device, own.trip, own.boot, 2, minute]);
      await db.query(insertReading, [randomUUID(), own.device, own.trip, randomUUID(), 1, minute]);
    });
  });

  it('d: rejects unknown source with good quality, permits unknown quality with a timestamp', async () => {
    await rejectsCheck("update public.telemetry_readings set time_quality = 'good' where message_id = $1", [own.message]);
    await isolated(() => db.query('update public.telemetry_readings set measured_at_device = $1 where message_id = $2', [minute, own.message]));
  });

  it('preserves out-of-range temperatures and accepts the ingest flag', async () => {
    await isolated(async () => {
      const initial = await db.query('select out_of_range from public.telemetry_readings where message_id = $1', [own.message]);
      expect(initial.rows[0].out_of_range).toBe(false);
      const result = await db.query(`update public.telemetry_readings set temperature_c = -31, out_of_range = true
        where message_id = $1 returning temperature_c, out_of_range`, [own.message]);
      expect(result.rows[0]).toEqual({ temperature_c: '-31', out_of_range: true });
    });
  });

  it('e: enforces manual and auto deadline rules on readings and latest state', async () => {
    for (const [table, column, id] of [
      ['telemetry_readings', 'message_id', own.message],
      ['device_latest_state', 'device_id', own.device],
    ]) {
      const update = `update public.${table} set control_mode = $1, manual_expires_at = $2 where ${column} = $3`;
      await rejectsCheck(update, ['manual', null, id]);
      await rejectsCheck(update, ['auto', laterMinute, id]);
      await isolated(async () => {
        await db.query(update, ['manual', laterMinute, id]);
        await db.query(update, ['auto', null, id]);
      });
    }
  });

  it('f: enforces latitude and longitude bounds, including boundary values', async () => {
    for (const [lat, lng] of [[-90.1, 0], [90.1, 0], [0, -180.1], [0, 180.1]]) {
      await rejectsCheck('update public.telemetry_readings set lat = $1, lng = $2 where message_id = $3', [lat, lng, own.message]);
      await rejectsCheck('update public.device_latest_state set lat = $1, lng = $2 where device_id = $3', [lat, lng, own.device]);
    }
    await isolated(() => db.query('update public.telemetry_readings set lat = -90, lng = 180 where message_id = $1', [own.message]));
  });

  it('g: latest state has one row per device and service_role can update it', async () => {
    await expect(isolated(() => db.query('insert into public.device_latest_state (device_id, updated_at) values ($1, $2)', [own.device, minute])))
      .rejects.toMatchObject({ code: '23505', constraint: 'device_latest_state_pkey' });
    await isolated(async () => {
      const updated = await db.query(`update public.device_latest_state set last_sequence_no = 2, updated_at = $1
        where device_id = $2 returning last_sequence_no`, [laterMinute, own.device]);
      expect(updated.rows).toEqual([{ last_sequence_no: '2' }]);
    });
  });

  it('h: rejects duplicate event_id and empty event types', async () => {
    await expect(isolated(() => db.query(insertEvent, [own.event, other.device, other.trip, 'test-event', minute])))
      .rejects.toMatchObject({ code: '23505', constraint: 'device_events_event_id_key' });
    for (const type of ['', ' \t\n']) {
      await rejectsCheck(insertEvent, [randomUUID(), own.device, own.trip, type, minute]);
    }
  });

  it('i: rejects duplicate rollup keys even when trip or config is null', async () => {
    await isolated(async () => {
      const versions = await db.query<{ id: string }>(`insert into public.temperature_config_versions
        (device_id, config_version_no, target_min, target_max, status, issued_by, issued_at)
        values ($1, 1, -21, -19, 'approved', $2, $3), ($1, 2, -20, -18, 'approved', $2, $3)
        returning id`, [own.device, admin.id, minute]);
      const [config, nextConfig] = versions.rows.map(row => row.id);
      for (const [trip, version] of [[own.trip, config], [own.trip, null], [null, config], [null, null]]) {
        const key = [own.device, trip, version, laterMinute];
        await db.query(insertRollup, key);
        await expect(isolated(() => db.query(insertRollup, key)))
          .rejects.toMatchObject({ code: '23505', constraint: 'telemetry_rollups_minute_key' });
      }
      await db.query(insertRollup, [own.device, own.trip, config, minute]);
      await db.query(insertRollup, [own.device, own.trip, nextConfig, minute]);
    });
  });

  it('j: validates minute alignment, coverage, sample counts and temperature order', async () => {
    const values = [own.device, minute];
    for (const assignment of [
      "minute_utc = '2026-01-01T00:00:00.001Z'", 'missing_seconds = 19',
      'window_seconds = 61, covered_seconds = 41', 'window_seconds = 30, covered_seconds = -1, missing_seconds = 31',
      'window_seconds = 30, covered_seconds = 31, missing_seconds = -1', 'door_open_seconds = 61',
      'valid_sample_count = 4', 'temp_min = -18, temp_avg = null', 'temp_avg = -18', 'temp_avg = -22',
    ]) {
      await rejectsCheck(`update public.telemetry_rollups_minute set ${assignment} where device_id = $1 and minute_utc = $2`, values);
    }
    await isolated(() => db.query(`update public.telemetry_rollups_minute set window_seconds = 0,
      covered_seconds = 0, missing_seconds = 0, sample_count = 0, valid_sample_count = 0,
      temp_min = null, temp_avg = null, temp_max = null where device_id = $1 and minute_utc = $2`, values));
  });

  it('k: admin sees all telemetry, drivers see only their trips, other clients see none', async () => {
    for (const account of accounts) {
      await asClient(account.id, async () => {
        const latest = await db.query('select device_id from public.device_latest_state order by device_id');
        const expectedLatest = account === admin ? [own.device, other.device].sort() : [];
        expect(latest.rows).toEqual(expectedLatest.map(device_id => ({ device_id })));
        for (const table of tablesWithTrips) {
          const result = await db.query(`select trip_id from public.${table} order by trip_id nulls last`);
          let expected: (string | null)[] = [];
          if (account === admin) expected = [...[own.trip, other.trip].sort(), null];
          if (account === driver) expected = [own.trip];
          if (account === otherDriver) expected = [other.trip];
          expect(result.rows).toEqual(expected.map(trip_id => ({ trip_id })));
        }
      });
    }
    for (const table of tables) {
      await expect(asClient(null, () => db.query(`select * from public.${table}`))).rejects.toMatchObject({ code: '42501' });
    }
  });

  it('l: enables RLS on all four tables and revokes client writes', async () => {
    const secured = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = any($1) and c.relrowsecurity`, [tables]);
    expect(secured.rowCount).toBe(4);
    const writeGrants = await db.query(`select r.role, t.table_name, p.privilege
      from unnest(array['anon', 'authenticated']) r(role)
      cross join unnest($1::text[]) t(table_name)
      cross join unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p(privilege)
      where has_table_privilege(r.role, 'public.' || t.table_name, p.privilege)`, [tables]);
    expect(writeGrants.rowCount).toBe(0);
    for (const table of tables) {
      for (const id of [admin.id, null]) {
        await expect(asClient(id, () => db.query(`delete from public.${table} where false`))).rejects.toMatchObject({ code: '42501' });
      }
    }
  });

  it('m: limits relational columns to the specified device, trip and measurement fields', async () => {
    const expected: Record<string, string> = {
      telemetry_readings: 'id message_id device_id trip_id session_id boot_id sequence_no monotonic_ms measured_at_device time_source time_quality received_at is_backfill temperature_c humidity_pct out_of_range door_open gps_fix lat lng sensor_status config_version_no relay_state control_mode manual_expires_at',
      device_latest_state: 'device_id active_boot_id last_sequence_no last_received_at last_fresh_sample_at temperature_c humidity_pct door_open gps_fix lat lng relay_state control_mode manual_expires_at config_version_no updated_at',
      device_events: 'id event_id device_id trip_id type measured_at received_at payload',
      telemetry_rollups_minute: 'id device_id trip_id config_version_id minute_utc window_seconds covered_seconds missing_seconds sample_count valid_sample_count temp_min temp_max temp_avg humidity_avg door_open_seconds',
    };
    const columns = await db.query<{ table_name: string; column_name: string; data_type: string; is_identity: string }>(`
      select table_name, column_name, data_type, is_identity from information_schema.columns
      where table_schema = 'public' and table_name = any($1)`, [tables]);
    for (const [table, fields] of Object.entries(expected)) {
      const actual = columns.rows.filter(row => row.table_name === table);
      expect(actual.map(row => row.column_name).sort()).toEqual(fields.split(' ').sort());
      for (const field of actual.filter(row => row.column_name.endsWith('_at') || row.column_name === 'minute_utc')) {
        expect(field.data_type).toBe('timestamp with time zone');
      }
      if (table !== 'device_latest_state') {
        expect(actual.find(row => row.column_name === 'id')).toMatchObject({ data_type: 'bigint', is_identity: 'YES' });
      }
    }
  });
});
