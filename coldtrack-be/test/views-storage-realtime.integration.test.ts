import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'dotenv';
import pg from 'pg';

const env = { ...(existsSync('../.env') ? parse(readFileSync('../.env')) : {}), ...process.env };
const departedAt = '2026-01-01T00:00:00Z';
const completedAt = '2026-01-01T01:00:00Z';
const bucket = 'delivery-proofs';
const viewNames = ['customer_shipments_view', 'customer_trips_view', 'driver_trips_view'];
const summaryFields = ['trip_id', 'shipment_id', 'status', 'departed_at', 'completed_at', 'total_duration_seconds', 'total_distance_km'];
const driverFields = ['trip_id', 'status', 'departed_at', 'completed_at', 'driver_notes', 'plate', 'product_type', 'temp_min', 'temp_max', 'warehouse_notes'];

describe('scoped views, private Storage and Realtime publication (real Supabase)', () => {
  const db = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 10000 });
  let connected = false;
  const accounts = [
    { role: 'admin', status: 'active' },
    { role: 'customer', status: 'active' },
    { role: 'customer', status: 'active' },
    { role: 'driver', status: 'active' },
    { role: 'driver', status: 'active' },
    { role: 'driver', status: 'pending' },
    { role: 'driver', status: 'suspended' },
    { role: 'customer', status: 'pending' },
    { role: 'customer', status: 'suspended' },
  ].map(account => ({ ...account, id: randomUUID(), notification: randomUUID() }));
  const [admin, customer, otherCustomer, driver, otherDriver, pendingDriver, suspendedDriver, pendingCustomer, suspendedCustomer] = accounts;
  const fixtures = [
    { owner: customer, assigned: driver, status: 'in_transit' },
    { owner: customer, assigned: driver, status: 'completed' },
    { owner: customer, assigned: driver, status: 'completed' },
    { owner: otherCustomer, assigned: otherDriver, status: 'in_transit' },
  ].map(fixture => ({ ...fixture, trip: randomUUID(), shipment: randomUUID(), vehicle: randomUUID(), device: randomUUID(), boot: randomUUID() }));
  const [live, completed, noGps, other] = fixtures;
  const liveAlert = randomUUID();
  const otherAlert = randomUUID();
  const storageFixture = `proofs/${live.trip}/${randomUUID()}.jpg`;
  const summaryQuery = 'select * from private.customer_trip_summary($1)';
  const liveQuery = 'select * from private.customer_live_gps($1)';
  const driverQuery = 'select * from private.driver_trips()';

  async function addPoints(fixture: typeof live, points: [string, number, number, boolean][]) {
    for (const [index, [measured, lat, lng, fix]] of points.entries()) {
      await db.query(`insert into public.telemetry_readings
        (message_id, device_id, trip_id, boot_id, sequence_no, monotonic_ms, measured_at_device, received_at,
         time_source, time_quality, gps_fix, lat, lng)
        values ($1, $2, $3, $4, $5, $5, $6, $6, 'gps', 'good', $7, $8, $9)`,
      [randomUUID(), fixture.device, fixture.trip, fixture.boot, index + 1, measured, fix, lat, lng]);
    }
  }

  beforeAll(async () => {
    await db.connect();
    connected = true;
    await db.query('begin');
    for (const account of accounts) {
      await db.query('insert into auth.users (id, email) values ($1, $2)', [account.id, `${account.id}@example.test`]);
    }
    await db.query('set local role service_role');
    for (const account of accounts) {
      await db.query('insert into public.profiles (id, full_name, phone) values ($1, $2, $3)', [account.id, 'Test profile', '000000']);
      await db.query(`insert into public.account_access (user_id, role_id, status)
        select $1, id, $3 from public.roles where code = $2`, [account.id, account.role, account.status]);
      await db.query(`insert into public.notifications (id, user_id, type, title, body)
        values ($1, $2, 'test', 'Test notification', 'Test body')`, [account.notification, account.id]);
    }
    for (const fixture of fixtures) {
      await db.query('insert into public.vehicles (id, plate) values ($1, $2)', [fixture.vehicle, `TEST-${fixture.vehicle}`]);
      await db.query('insert into public.devices (id, device_code) values ($1, $2)', [fixture.device, `TEST-${fixture.device}`]);
      await db.query(`insert into public.shipments (id, customer_id, product_type, temp_min, temp_max, warehouse_notes)
        values ($1, $2, 'test-only', -21, -19, 'Warehouse instruction')`, [fixture.shipment, fixture.owner.id]);
      await db.query(`insert into public.trips
        (id, shipment_id, vehicle_id, driver_id, device_id, status, departed_at, completed_at, driver_notes)
        values ($1, $2, $3, $4, $5, $6, $7, $8, 'Driver note')`,
      [fixture.trip, fixture.shipment, fixture.vehicle, fixture.assigned.id, fixture.device, fixture.status,
        departedAt, fixture.status === 'completed' ? completedAt : null]);
    }
    await addPoints(completed, [
      ['2026-01-01T00:20:00Z', 1, 1, true],
      ['2026-01-01T00:00:00Z', 0, 0, true],
      ['2026-01-01T00:10:00Z', 0, 1, true],
      ['2026-01-01T00:15:00Z', 25, 50, false],
    ]);
    await addPoints(noGps, [['2026-01-01T00:10:00Z', 10, 10, false]]);
    await addPoints(live, [
      ['2026-01-01T00:20:00Z', 10, 20, true],
      ['2026-01-01T00:10:00Z', 11, 21, true],
      ['2026-01-01T00:30:00Z', 12, 22, false],
    ]);
    await addPoints(other, [['2026-01-01T00:10:00Z', 30, 40, true]]);
    for (const [id, fixture] of [[liveAlert, live], [otherAlert, other]] as const) {
      await db.query(`insert into public.alerts (id, trip_id, device_id, type, opened_at)
        values ($1, $2, $3, 'temp_high', $4)`, [id, fixture.trip, fixture.device, departedAt]);
    }
    await db.query('reset role');
    await db.query('insert into storage.objects (bucket_id, name) values ($1, $2)', [bucket, storageFixture]);
  }, 30000);

  afterAll(async () => {
    try {
      if (connected) await db.query('rollback');
    } finally {
      await db.end();
    }
  });

  async function isolated<T>(run: () => Promise<T>) {
    await db.query('savepoint views_test');
    try {
      return await run();
    } finally {
      await db.query('rollback to savepoint views_test');
      await db.query('release savepoint views_test');
    }
  }

  async function asClient<T>(id: string | null, run: () => Promise<T>, callPrivate = false) {
    return isolated(async () => {
      // Only for direct SQL function tests. The grant rolls back with this savepoint.
      if (callPrivate) await db.query('grant usage on schema private to authenticated, anon');
      const role = id ? 'authenticated' : 'anon';
      await db.query(`set local role ${role}`);
      await db.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
        [id ?? '', JSON.stringify({ sub: id, role })]);
      return run();
    });
  }

  it('b: rejects another customer’s trip through both summary paths while preserving base-table RLS', async () => {
    await asClient(customer.id, async () => {
      expect((await db.query(summaryQuery, [other.trip])).rows).toEqual([]);
      expect((await db.query(summaryQuery, [live.trip])).rows).toHaveLength(1);
    }, true);
    await asClient(customer.id, async () => {
      expect((await db.query('select trip_id from public.customer_trips_view where trip_id = $1', [other.trip])).rows).toEqual([]);
      expect((await db.query('select id from public.trips')).rows).toEqual([]);
      expect((await db.query('select id from public.telemetry_readings')).rows).toEqual([]);
    });
  });

  it('c: customer shipment view shows only caller-owned rows and its six approved columns', async () => {
    const result = await asClient(customer.id, () => db.query('select * from public.customer_shipments_view order by id'));
    expect(result.fields.map(field => field.name)).toEqual(['id', 'product_type', 'temp_min', 'temp_max', 'status', 'created_at']);
    expect(result.rows.map(row => row.id)).toEqual([live.shipment, completed.shipment, noGps.shipment].sort());
    expect((await asClient(admin.id, () => db.query('select * from public.customer_shipments_view'))).rows).toEqual([]);
  });

  it('d: trip summary exposes only the approved columns and duration only after completion', async () => {
    const result = await asClient(customer.id, () => db.query('select * from public.customer_trips_view order by trip_id'));
    expect(result.fields.map(field => field.name)).toEqual(summaryFields);
    expect(result.rows.map(row => row.trip_id)).toEqual([live.trip, completed.trip, noGps.trip].sort());
    expect(result.rows.find(row => row.trip_id === live.trip)).toMatchObject({ total_duration_seconds: null, total_distance_km: null });
    const direct = await asClient(customer.id, () => db.query(summaryQuery, [completed.trip]), true);
    expect(direct.fields.map(field => field.name)).toEqual(summaryFields);
    expect(direct.rows).toEqual([expect.objectContaining({ trip_id: completed.trip, total_duration_seconds: '3600.000000' })]);
  });

  it('e: sums chronologically adjacent GPS fixes within 0.1% and returns null without a fix', async () => {
    const result = await asClient(customer.id, () => db.query('select trip_id, total_distance_km from public.customer_trips_view'));
    // Two one-degree great-circle arcs, one on the equator and one on a meridian.
    const expectedKm = 222.39016;
    const distance = result.rows.find(row => row.trip_id === completed.trip)?.total_distance_km;
    expect(typeof distance).toBe('number');
    expect(Math.abs(distance - expectedKm) / expectedKm).toBeLessThanOrEqual(0.001);
    expect(result.rows.find(row => row.trip_id === noGps.trip)?.total_distance_km).toBeNull();
  });

  it('f: returns the latest valid fix only for the caller’s in-transit trip', async () => {
    const result = await asClient(customer.id, () => db.query(liveQuery, [live.trip]), true);
    expect(result.rows).toEqual([{ trip_id: live.trip, lat: '10', lng: '20', measured_at_device: new Date('2026-01-01T00:20:00Z') }]);
    for (const [caller, trip] of [[customer.id, completed.trip], [customer.id, other.trip], [otherCustomer.id, live.trip]]) {
      expect((await asClient(caller, () => db.query(liveQuery, [trip]), true)).rows).toEqual([]);
    }
    for (const status of ['scheduled', 'cancelled']) {
      await isolated(async () => {
        await db.query('update public.trips set status = $1, departed_at = null where id = $2', [status, live.trip]);
        expect((await asClient(customer.id, () => db.query(liveQuery, [live.trip]), true)).rows).toEqual([]);
      });
    }
  });

  it('g: driver reads assigned trips with the approved shipment fields and no customer fields', async () => {
    const result = await asClient(driver.id, () => db.query('select * from public.driver_trips_view order by trip_id'));
    expect(result.fields.map(field => field.name)).toEqual(driverFields);
    expect(result.rows.map(row => row.trip_id)).toEqual([live.trip, completed.trip, noGps.trip].sort());
    expect(result.rows.find(row => row.trip_id === live.trip)).toMatchObject({
      plate: `TEST-${live.vehicle}`, product_type: 'test-only', temp_min: '-21', temp_max: '-19',
      warehouse_notes: 'Warehouse instruction', driver_notes: 'Driver note',
    });
    const direct = await asClient(otherDriver.id, () => db.query(driverQuery), true);
    expect(direct.fields.map(field => field.name)).toEqual(driverFields);
    expect(direct.rows.map(row => row.trip_id)).toEqual([other.trip]);
  });

  it('h: inactive drivers receive zero rows from all three functions even when assigned the trip', async () => {
    for (const account of [pendingDriver, suspendedDriver]) {
      await isolated(async () => {
        await db.query('update public.trips set driver_id = $1 where id = $2', [account.id, live.trip]);
        await asClient(account.id, async () => {
          expect((await db.query(summaryQuery, [live.trip])).rows).toEqual([]);
          expect((await db.query(liveQuery, [live.trip])).rows).toEqual([]);
          expect((await db.query(driverQuery)).rows).toEqual([]);
        }, true);
      });
    }
  });

  it('i: inactive customers receive zero rows even for a shipment they own', async () => {
    for (const account of [pendingCustomer, suspendedCustomer]) {
      await isolated(async () => {
        await db.query('update public.shipments set customer_id = $1 where id = $2', [account.id, live.shipment]);
        await asClient(account.id, async () => {
          expect((await db.query(summaryQuery, [live.trip])).rows).toEqual([]);
          expect((await db.query(liveQuery, [live.trip])).rows).toEqual([]);
        }, true);
        expect((await asClient(account.id, () => db.query('select * from public.customer_trips_view'))).rows).toEqual([]);
      });
    }
  });

  it('j: anonymous sessions cannot select the views or execute the new functions', async () => {
    for (const view of viewNames) {
      await expect(asClient(null, () => db.query(`select * from public.${view}`))).rejects.toMatchObject({ code: '42501' });
    }
    for (const sql of [summaryQuery, liveQuery]) {
      await expect(asClient(null, () => db.query(sql, [live.trip]), true)).rejects.toMatchObject({ code: '42501' });
    }
    await expect(asClient(null, () => db.query(driverQuery), true)).rejects.toMatchObject({ code: '42501' });
  });

  it('k: grants authenticated EXECUTE only for the three new routines and preserves private schema isolation', async () => {
    const permissions = await db.query(`select p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
      exists(select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' order by p.proname`);
    expect(permissions.rows).toEqual([
      { proname: 'customer_live_gps', authenticated: true, anon: false, public: false },
      { proname: 'customer_owns_alert_trip', authenticated: true, anon: false, public: false },
      { proname: 'customer_trip_summary', authenticated: true, anon: false, public: false },
      { proname: 'driver_trips', authenticated: true, anon: false, public: false },
      { proname: 'reject_audit_log_mutation', authenticated: false, anon: false, public: false },
    ]);
    // The existing policy helper only runs through the alerts policy.
    const schema = await db.query("select has_schema_privilege('authenticated', 'private', 'USAGE') as client_usage");
    expect(schema.rows).toEqual([{ client_usage: false }]);
    await expect(asClient(customer.id, () => db.query('select private.customer_owns_alert_trip($1)', [live.trip])))
      .rejects.toMatchObject({ code: '42501' });
  });

  it('l: uses SECURITY DEFINER with a fixed search path and security_invoker on each view', async () => {
    const functions = await db.query(`select p.proname, p.prosecdef, p.proconfig from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private'
      and p.proname in ('customer_trip_summary', 'customer_live_gps', 'driver_trips')`);
    expect(functions.rows).toHaveLength(3);
    for (const row of functions.rows) {
      expect(row.prosecdef).toBe(true);
      expect(row.proconfig).toContain('search_path=""');
    }
    const views = await db.query(`select c.reloptions from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'v' and c.relname = any($1)`, [viewNames]);
    expect(views.rows).toHaveLength(viewNames.length);
    for (const row of views.rows) expect(row.reloptions).toContain('security_invoker=true');
  });

  it('m: delivery-proofs is private', async () => {
    expect((await db.query('select public from storage.buckets where id = $1', [bucket])).rows).toEqual([{ public: false }]);
  });

  it('n: anonymous and authenticated clients cannot select, insert, update or delete proof objects', async () => {
    const filter = 'where bucket_id = $1 and name = $2';
    const commands = [
      `select name from storage.objects ${filter}`,
      `update storage.objects set metadata = '{}'::jsonb ${filter} returning id`,
      `delete from storage.objects ${filter} returning id`,
    ];
    expect((await db.query(`select id from storage.objects ${filter}`, [bucket, storageFixture])).rowCount).toBe(1);
    for (const caller of [null, admin.id, driver.id, customer.id]) {
      for (const sql of commands) {
        try {
          const result = await asClient(caller, () => db.query(sql, [bucket, storageFixture]));
          expect(result.rowCount).toBe(0);
        } catch (error) {
          expect(error).toMatchObject({ code: '42501' });
        }
      }
      await expect(asClient(caller, () => db.query('insert into storage.objects (bucket_id, name) values ($1, $2)',
        [bucket, `proofs/${live.trip}/${randomUUID()}.jpg`]))).rejects.toMatchObject({ code: '42501' });
    }
  });

  it('o: service role signs a real private object and the signed URL serves its bytes', async () => {
    let status: { API_URL?: string; SECRET_KEY?: string };
    try {
      const output = execFileSync(process.execPath, [
        resolve('node_modules/supabase/dist/supabase.js'), 'status', '--workdir', '..', '--output', 'json',
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 });
      status = JSON.parse(output) as typeof status;
    } catch {
      throw new Error('Unable to read API_URL and SECRET_KEY from local Supabase status');
    }
    if (!status.API_URL || !status.SECRET_KEY || !['localhost', '127.0.0.1'].includes(new URL(status.API_URL).hostname)) {
      throw new Error('Supabase status must provide a loopback API_URL and SECRET_KEY');
    }
    const client = createClient(status.API_URL, status.SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(8000) }) },
    });
    const storage = client.storage.from(bucket);
    const path = `proofs/${randomUUID()}/${randomUUID()}.jpg`;
    const bytes = Buffer.from('temporary proof integration fixture');
    const upload = await storage.upload(path, bytes, { contentType: 'application/octet-stream' });
    if (upload.error) throw new Error(`Storage upload failed: ${upload.error.message}`);
    let cleanupError: string | undefined;
    try {
      const signed = await storage.createSignedUrl(path, 60);
      if (signed.error || !signed.data.signedUrl) throw new Error(`Storage signing failed: ${signed.error?.message}`);
      const publicResponse = await fetch(`${status.API_URL}/storage/v1/object/public/${bucket}/${path}`, { signal: AbortSignal.timeout(8000) });
      expect(publicResponse.ok).toBe(false);
      const response = await fetch(signed.data.signedUrl, { signal: AbortSignal.timeout(8000) });
      expect(response.status).toBe(200);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    } finally {
      const removed = await storage.remove([path]);
      cleanupError = removed.error?.message;
    }
    if (cleanupError) throw new Error(`Storage fixture cleanup failed: ${cleanupError}`);
  }, 60000);

  it('p: publishes exactly alerts and notifications, with RLS-compatible change types', async () => {
    const tables = await db.query(`select schemaname, tablename from pg_publication_tables
      where pubname = 'supabase_realtime' order by schemaname, tablename`);
    expect(tables.rows).toEqual([
      { schemaname: 'public', tablename: 'alerts' },
      { schemaname: 'public', tablename: 'notifications' },
    ]);
    const publication = await db.query(`select pubinsert, pubupdate, pubdelete, pubtruncate from pg_publication
      where pubname = 'supabase_realtime'`);
    expect(publication.rows).toEqual([{ pubinsert: true, pubupdate: true, pubdelete: false, pubtruncate: false }]);
  });

  it('q: keeps notification and alert reads scoped under RLS with publication enabled', async () => {
    const scope = new Map([
      [admin.id, [liveAlert, otherAlert].sort()], [customer.id, [liveAlert]], [driver.id, [liveAlert]],
      [otherCustomer.id, [otherAlert]], [otherDriver.id, [otherAlert]],
    ]);
    for (const account of accounts) {
      await asClient(account.id, async () => {
        const rls = await db.query("select row_security_active('public.notifications') as notifications, row_security_active('public.alerts') as alerts");
        expect(rls.rows).toEqual([{ notifications: true, alerts: true }]);
        const notifications = await db.query('select id from public.notifications');
        expect(notifications.rows).toEqual(account.status === 'active' ? [{ id: account.notification }] : []);
        const alerts = await db.query('select id from public.alerts order by id');
        expect(alerts.rows).toEqual((scope.get(account.id) ?? []).map(id => ({ id })));
      });
    }
  });
});
