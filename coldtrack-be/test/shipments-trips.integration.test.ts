import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import pg from 'pg';

const env = { ...(existsSync('../.env') ? parse(readFileSync('../.env')) : {}), ...process.env };

describe('shipments/trips migration (real PostgreSQL)', () => {
  const db = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 10000 });
  let connected = false;
  const users = { admin: randomUUID(), customer: randomUUID(), customer2: randomUUID(), driver: randomUUID(), driver2: randomUUID(), pending: randomUUID(), suspended: randomUUID() };
  const shipments = Array.from({ length: 4 }, () => randomUUID());
  const vehicles = [randomUUID(), randomUUID()];
  const devices = [randomUUID(), randomUUID()];
  const trips = [randomUUID(), randomUUID()];
  const boot = randomUUID();
  const tables = ['shipments', 'trips', 'delivery_proofs', 'device_sessions'];

  beforeAll(async () => {
    await db.connect();
    connected = true;
    await db.query('begin');
    // Local fixtures are fully rolled back, including auth.users. No seed data.
    for (const [name, id] of Object.entries(users)) {
      await db.query('insert into auth.users (id, email) values ($1, $2)', [id, `${id}@example.test`]);
      await db.query('set local role service_role');
      await db.query('insert into public.profiles (id) values ($1)', [id]);
      const role = name.startsWith('customer') ? 'customer' : name.startsWith('driver') ? 'driver' : 'admin';
      const status = ['pending', 'suspended'].includes(name) ? name : 'active';
      await db.query(`insert into public.account_access (user_id, role_id, status)
        select $1, id, $3 from public.roles where code = $2`, [id, role, status]);
      await db.query('reset role');
    }
    await db.query('set local role service_role');
    for (let i = 0; i < 2; i++) {
      await db.query('insert into public.vehicles (id, plate) values ($1, $2)', [vehicles[i], `TEST-${vehicles[i]}`]);
      await db.query('insert into public.devices (id, device_code) values ($1, $2)', [devices[i], `TEST-${devices[i]}`]);
    }
    for (let i = 0; i < shipments.length; i++) {
      await db.query(`insert into public.shipments (id, customer_id, product_type, temp_min, temp_max)
        values ($1, $2, 'test-only', -20, -18)`, [shipments[i], i === 1 ? users.customer2 : users.customer]);
    }
    await db.query('update public.shipments set deleted_at = now() where id = $1', [shipments[2]]);
    for (let i = 0; i < 2; i++) {
      await db.query(`insert into public.trips (id, shipment_id, vehicle_id, driver_id, device_id, status)
        values ($1, $2, $3, $4, $5, $6)`, [trips[i], shipments[i], vehicles[i], i === 0 ? users.driver : users.driver2, devices[i], i === 0 ? 'scheduled' : 'cancelled']);
      await db.query(`insert into public.delivery_proofs (trip_id, photo_path, received_at, created_by)
        values ($1, $2, now(), $3)`, [trips[i], `private/${trips[i]}.jpg`, users.admin]);
    }
    await db.query(`insert into public.device_sessions (device_id, boot_id, start_monotonic_ms)
      values ($1, $2, 100)`, [devices[0], boot]);
    await db.query('reset role');
  }, 20000);

  afterAll(async () => {
    if (connected) await db.query('rollback');
    await db.end();
  });

  async function isolated<T>(run: () => Promise<T>) {
    await db.query('savepoint shipment_test');
    try { return await run(); }
    finally {
      await db.query('rollback to savepoint shipment_test');
      await db.query('release savepoint shipment_test');
    }
  }
  async function rejected(sql: string, args: unknown[], code = '23514') {
    await expect(isolated(() => db.query(sql, args))).rejects.toMatchObject({ code });
  }
  async function asClient<T>(user: string | null, run: () => Promise<T>) {
    return isolated(async () => {
      await db.query(user ? 'set local role authenticated' : 'set local role anon');
      await db.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
        [user ?? '', JSON.stringify({ sub: user, role: user ? 'authenticated' : 'anon' })]);
      return run();
    });
  }
  const insertTrip = `insert into public.trips (shipment_id, vehicle_id, driver_id, device_id, status, departed_at)
    values ($1, $2, $3, $4, $5, $6)`;
  function candidate(status = 'scheduled') {
    return [shipments[1], vehicles[1], users.driver2, devices[1], status, status === 'in_transit' ? '2026-01-01T00:00:00Z' : null];
  }

  it('b: shipment status is constrained and defaults to draft', async () => {
    expect((await db.query('select status, version from public.shipments where id = $1', [shipments[0]])).rows[0]).toEqual({ status: 'draft', version: 1 });
    await rejected('update public.shipments set status = $1 where id = $2', ['invalid', shipments[0]]);
    for (const status of ['draft', 'pending_review', 'approved', 'rejected', 'scheduled', 'in_transit', 'completed', 'cancelled']) {
      await isolated(() => db.query('update public.shipments set status = $1, rejected_reason = $2 where id = $3', [status, 'test reason', shipments[0]]));
    }
  });
  it('c: enforces temperature bounds, width strictly > 1 and 0.5 degree steps', async () => {
    for (const [min, max] of [[-20,-20],[-18,-20],[-20,-19.5],[-20,-19],[-25.5,-23],[-16,-14.5],[-20.25,-18],[-20,-18.25]]) {
      await rejected('update public.shipments set temp_min = $1, temp_max = $2 where id = $3', [min, max, shipments[0]]);
    }
    for (const [min, max] of [[-25,-15],[-20.5,-19],[-20,-18]]) {
      await isolated(() => db.query('update public.shipments set temp_min = $1, temp_max = $2 where id = $3', [min, max, shipments[0]]));
    }
  });
  it('d: rejected shipments require a reason', async () => {
    for (const reason of [null, '', '   ']) {
      await rejected("update public.shipments set status = 'rejected', rejected_reason = $1 where id = $2", [reason, shipments[0]]);
    }
  });
  it('e: constrains trip status, manual-off budget and evaluation result', async () => {
    expect((await db.query('select status, manual_off_issued_seconds, result, version from public.trips where id = $1', [trips[0]])).rows[0])
      .toEqual({ status: 'scheduled', manual_off_issued_seconds: 0, result: null, version: 1 });
    await rejected("update public.trips set status = 'invalid' where id = $1", [trips[0]]);
    for (const seconds of [-1,1201]) await rejected('update public.trips set manual_off_issued_seconds = $1 where id = $2', [seconds,trips[0]]);
    for (const seconds of [0,1200]) await isolated(() => db.query('update public.trips set manual_off_issued_seconds = $1 where id = $2', [seconds,trips[0]]));
    for (const result of [null,'pending_evaluation','pass','fail']) await isolated(() => db.query('update public.trips set result = $1 where id = $2', [result,trips[0]]));
    await rejected("update public.trips set result = 'unknown' where id = $1", [trips[0]]);
  });
  it('f: separate partial indexes protect each live shipment, vehicle, driver and device', async () => {
    const occupied = [shipments[0], vehicles[0], users.driver, devices[0]];
    for (const status of ['scheduled', 'in_transit']) {
      for (let i = 0; i < occupied.length; i++) {
        const args = candidate(status);
        args[i] = occupied[i];
        await rejected(insertTrip, args, '23505');
      }
    }
    // Re-test with an existing in_transit trip, not just a scheduled trip.
    await isolated(async () => {
      await db.query("update public.trips set status = 'in_transit', departed_at = now() where id = $1", [trips[0]]);
      for (let i = 0; i < occupied.length; i++) {
        const args = candidate(); args[i] = occupied[i];
        await rejected(insertTrip, args, '23505');
      }
    });
  });
  it('f: completed and cancelled history do not block a new live trip', async () => {
    for (const status of ['cancelled','completed']) {
      await isolated(async () => {
        await db.query(`update public.trips set status = $1,
          departed_at = '2026-01-01T00:00:00Z', completed_at = '2026-01-01T01:00:00Z' where id = $2`, [status,trips[0]]);
        await db.query(insertTrip, [shipments[0],vehicles[0],users.driver,devices[0],'scheduled',null]);
      });
    }
    await isolated(() => db.query(insertTrip, candidate()));
  });
  it('g: requires departure/completion timestamps in the right order', async () => {
    await rejected("update public.trips set status = 'in_transit' where id = $1", [trips[0]]);
    await rejected("update public.trips set status = 'completed', departed_at = now() where id = $1", [trips[0]]);
    for (const completed of ['2026-01-01T00:00:00Z','2025-12-31T23:59:59Z']) {
      await rejected(`update public.trips set status = 'completed', departed_at = '2026-01-01T00:00:00Z', completed_at = $1 where id = $2`, [completed,trips[0]]);
    }
    await isolated(() => db.query(`update public.trips set status = 'completed', departed_at = '2026-01-01T00:00:00Z',
      completed_at = '2026-01-01T01:00:00Z' where id = $1`, [trips[0]]));
  });
  it('h: requires photo_path and one proof per trip', async () => {
    await rejected(`insert into public.delivery_proofs (trip_id, photo_path, received_at, created_by)
      values ($1, 'private/test.jpg', now(), $2)`, [trips[0], users.admin], '23505');
    await rejected('update public.delivery_proofs set photo_path = null where trip_id = $1', [trips[0]], '23502');
  });
  it.each(['different trips', 'the same trip'])('i: one boot permits two closed sessions on %s', async (scope) => {
    await isolated(async () => {
      let secondTrip = trips[0];
      if (scope === 'different trips') {
        secondTrip = trips[1];
        await db.query('update public.trips set device_id = $1 where id = $2', [devices[0], secondTrip]);
      }
      await db.query(`update public.device_sessions set trip_id = $1, ended_at = '2026-01-01T01:00:00Z',
        end_monotonic_ms = 200 where device_id = $2 and boot_id = $3`, [trips[0], devices[0], boot]);
      await db.query(`insert into public.device_sessions (device_id, boot_id, trip_id, started_at, ended_at,
        start_monotonic_ms, end_monotonic_ms)
        values ($1, $2, $3, '2026-01-01T01:00:00Z', '2026-01-01T02:00:00Z', 200, 300)`,
      [devices[0], boot, secondTrip]);
      const result = await db.query(`select trip_id from public.device_sessions
        where device_id = $1 and boot_id = $2 and ended_at is not null order by end_monotonic_ms`, [devices[0], boot]);
      expect(result.rows).toEqual([{ trip_id: trips[0] }, { trip_id: secondTrip }]);
    });
  });
  it('i: rejects a second open session for the device even with a different boot', async () => {
    await expect(isolated(() => db.query('insert into public.device_sessions (device_id, boot_id) values ($1, $2)',
      [devices[0], randomUUID()]))).rejects.toMatchObject({
      code: '23505', constraint: 'device_sessions_one_open_per_device_idx',
    });
  });
  it('i: permits a closed session beside an open session for the same device and boot', async () => {
    await isolated(async () => {
      await db.query(`insert into public.device_sessions (device_id, boot_id, trip_id, ended_at, end_monotonic_ms)
        values ($1, $2, $3, '2026-01-01T00:00:00Z', 100)`, [devices[0], boot, trips[0]]);
      const result = await db.query(`select ended_at is null as is_open from public.device_sessions
        where device_id = $1 and boot_id = $2 order by is_open`, [devices[0], boot]);
      expect(result.rows).toEqual([{ is_open: false }, { is_open: true }]);
    });
  });
  it('i: still rejects an end monotonic timestamp below its start', async () => {
    await rejected('update public.device_sessions set end_monotonic_ms = 99 where device_id = $1 and boot_id = $2', [devices[0], boot]);
  });
  it('i: permits a session without a trip', async () => {
    const result = await db.query('select trip_id from public.device_sessions where device_id = $1 and boot_id = $2', [devices[0], boot]);
    expect(result.rows).toEqual([{ trip_id: null }]);
  });
  it('j: reads only the allowed shipment/trip scope for active users', async () => {
    for (const [name,id] of Object.entries(users)) {
      await asClient(id, async () => {
        const shipmentRows = (await db.query('select id from public.shipments')).rows.map((r: { id: string }) => r.id).sort();
        const tripRows = (await db.query('select id from public.trips')).rows.map((r: { id: string }) => r.id).sort();
        const expectedShipments = name === 'admin' ? [shipments[0],shipments[1],shipments[3]]
          : name === 'customer' ? [shipments[0],shipments[3]] : name === 'customer2' ? [shipments[1]] : [];
        const expectedTrips = name === 'admin' ? trips : name === 'driver' ? [trips[0]] : name === 'driver2' ? [trips[1]] : [];
        expect(shipmentRows).toEqual([...expectedShipments].sort());
        expect(tripRows).toEqual([...expectedTrips].sort());
      });
    }
    for (const table of tables) await expect(asClient(null, () => db.query(`select * from public.${table}`))).rejects.toMatchObject({ code: '42501' });
  });
  it('j: proofs are visible only to admin and the assigned driver', async () => {
    for (const [name,id] of Object.entries(users)) await asClient(id, async () => {
      const rows = (await db.query('select trip_id from public.delivery_proofs')).rows.map((r: { trip_id: string }) => r.trip_id).sort();
      const expected = name === 'admin' ? trips : name === 'driver' ? [trips[0]] : name === 'driver2' ? [trips[1]] : [];
      expect(rows).toEqual([...expected].sort());
    });
  });
  it('k: even admin cannot read soft-deleted shipments', async () => {
    for (const id of [users.admin,users.customer]) await asClient(id, async () => {
      expect((await db.query('select id from public.shipments where id = $1', [shipments[2]])).rowCount).toBe(0);
    });
  });
  it('l: sessions cannot be read by any client', async () => {
    for (const id of [...Object.values(users),null]) await expect(asClient(id, () => db.query('select * from public.device_sessions'))).rejects.toMatchObject({ code: '42501' });
  });
  it('m: all four named tables have RLS, SELECT-only policies and no client writes', async () => {
    expect((await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = any($1) and c.relrowsecurity`, [tables])).rowCount).toBe(4);
    expect((await db.query(`select * from pg_policies where schemaname = 'public' and tablename = any($1) and cmd <> 'SELECT'`, [tables])).rowCount).toBe(0);
    for (const role of ['anon','authenticated']) for (const table of tables) {
      for (const privilege of ['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) {
        expect((await db.query('select has_table_privilege($1, $2, $3) as allowed', [role,`public.${table}`,privilege])).rows[0].allowed).toBe(false);
      }
      await expect(asClient(role === 'anon' ? null : users.admin, () => db.query(`delete from public.${table}`))).rejects.toMatchObject({ code: '42501' });
    }
  });
  it('has UTC timestamps and adds no automatic triggers', async () => {
    const times = await db.query(`select data_type from information_schema.columns where table_schema = 'public'
      and table_name = any($1) and column_name in ('created_at','updated_at','reviewed_at','deleted_at','departed_at','completed_at','received_at','started_at','ended_at')`, [tables]);
    expect(times.rowCount).toBe(13);
    expect(times.rows.every((r: { data_type: string }) => r.data_type === 'timestamp with time zone')).toBe(true);
    expect((await db.query(`select * from pg_trigger where tgrelid = any($1::regclass[]) and not tgisinternal`, [tables.map(t => `public.${t}`)])).rowCount).toBe(0);
    await isolated(async () => {
      await db.query(`update public.trips set status = 'completed', departed_at = '2026-01-01T00:00:00Z',
        completed_at = '2026-01-01T01:00:00Z' where id = $1`, [trips[0]]);
      expect((await db.query('select status from public.shipments where id = $1', [shipments[0]])).rows[0].status).toBe('draft');
      expect((await db.query('select result from public.trips where id = $1', [trips[0]])).rows[0].result).toBeNull();
    });
  });
});
