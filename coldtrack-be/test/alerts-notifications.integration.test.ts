import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import pg from 'pg';

const env = { ...(existsSync('../.env') ? parse(readFileSync('../.env')) : {}), ...process.env };
const openedAt = '2026-01-01T00:00:00Z';
const later = '2026-01-01T00:01:00Z';

describe('alerts and system tables (real PostgreSQL)', () => {
  const db = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 10000 });
  let connected = false;
  const accounts = [
    { role: 'admin', status: 'active' },
    { role: 'driver', status: 'active' },
    { role: 'driver', status: 'active' },
    { role: 'customer', status: 'active' },
    { role: 'customer', status: 'active' },
    { role: 'admin', status: 'pending' },
    { role: 'admin', status: 'suspended' },
  ].map(account => ({ ...account, id: randomUUID(), notification: randomUUID() }));
  const [admin, driver, otherDriver, customer, otherCustomer] = accounts;
  const [own, other] = [[driver, customer], [otherDriver, otherCustomer]].map(([assigned, owner]) => ({
    driver: assigned.id,
    customer: owner.id,
    device: randomUUID(),
    vehicle: randomUUID(),
    shipment: randomUUID(),
    trip: randomUUID(),
    alert: randomUUID(),
  }));
  const privateTables = ['audit_logs', 'idempotency_requests', 'outbox_events'];
  const tables = ['alerts', 'alert_events', 'notifications', ...privateTables];
  const idempotencyKey = randomUUID();
  let auditId: string;
  let outboxId: string;

  const insertAlert = `insert into public.alerts (id, trip_id, device_id, type, opened_at)
    values ($1, $2, $3, $4, $5) returning status`;
  const insertNotification = `insert into public.notifications (id, user_id, type, title, body, payload)
    values ($1, $2, 'test', 'Test title', 'Test body', $3) returning payload`;
  const insertAudit = `insert into public.audit_logs (actor_id, action, entity, entity_id, created_at)
    values ($1, 'test.action', 'alert', $2, $3) returning id`;
  const insertIdempotency = `insert into public.idempotency_requests
    (user_id, idempotency_key, operation, payload_hash, created_at, expires_at)
    values ($1, $2, 'test.operation', 'test-hash', $3, $4)`;

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
      await db.query(insertNotification, [account.notification, account.id, {}]);
    }
    for (const fixture of [own, other]) {
      await db.query('insert into public.vehicles (id, plate) values ($1, $2)', [fixture.vehicle, `TEST-${fixture.vehicle}`]);
      await db.query('insert into public.devices (id, device_code) values ($1, $2)', [fixture.device, `TEST-${fixture.device}`]);
      await db.query(`insert into public.shipments (id, customer_id, product_type, temp_min, temp_max)
        values ($1, $2, 'test-only', -21, -19)`, [fixture.shipment, fixture.customer]);
      await db.query(`insert into public.trips (id, shipment_id, vehicle_id, driver_id, device_id)
        values ($1, $2, $3, $4, $5)`, [fixture.trip, fixture.shipment, fixture.vehicle, fixture.driver, fixture.device]);
    }
    await db.query(insertAlert, [own.alert, own.trip, own.device, 'temp_high', openedAt]);
    await db.query(insertAlert, [other.alert, other.trip, other.device, 'door_open', openedAt]);
    for (const fixture of [own, other]) {
      await db.query(`insert into public.alert_events (alert_id, event_type, created_at)
        values ($1, 'opened', $2)`, [fixture.alert, openedAt]);
    }
    const audit = await db.query<{ id: string }>(insertAudit, [admin.id, own.alert, openedAt]);
    auditId = audit.rows[0].id;
    await db.query(insertIdempotency, [admin.id, idempotencyKey, openedAt, later]);
    const outbox = await db.query<{ id: string }>(`insert into public.outbox_events (topic, payload)
      values ('test/topic', '{}') returning id`);
    outboxId = outbox.rows[0].id;
  }, 30000);

  afterAll(async () => {
    try {
      if (connected) await db.query('rollback');
    } finally {
      await db.end();
    }
  });

  async function isolated<T>(run: () => Promise<T>) {
    await db.query('savepoint alerts_test');
    try {
      return await run();
    } finally {
      await db.query('rollback to savepoint alerts_test');
      await db.query('release savepoint alerts_test');
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

  async function rejects(sql: string, args: unknown[], code = '23514', constraint?: string) {
    await expect(isolated(() => db.query(sql, args)))
      .rejects.toMatchObject(constraint ? { code, constraint } : { code });
  }

  it('b: enforces one unresolved alert of each type per trip', async () => {
    const duplicate = [randomUUID(), own.trip, own.device, 'temp_high', later];
    await rejects(insertAlert, duplicate, '23505', 'alerts_one_unresolved_per_trip_type_idx');
    await isolated(async () => {
      const created = await db.query(insertAlert, [randomUUID(), other.trip, other.device, 'temp_high', openedAt]);
      expect(created.rows).toEqual([{ status: 'open' }]);
      await db.query(`update public.alerts set status = 'acknowledged', acknowledged_at = $1,
        acknowledged_by = $2 where id = $3`, [later, driver.id, own.alert]);
      await rejects(insertAlert, duplicate, '23505', 'alerts_one_unresolved_per_trip_type_idx');
    });
  });

  it('c: permits a new alert of the same type after the previous alert is resolved', async () => {
    await isolated(async () => {
      await db.query(`update public.alerts set status = 'resolved', resolved_at = $1, resolved_by = $2,
        resolution_note = 'test resolution' where id = $3`, [later, admin.id, own.alert]);
      await db.query(insertAlert, [randomUUID(), own.trip, own.device, 'temp_high', later]);
      const rows = await db.query("select status from public.alerts where trip_id = $1 and type = 'temp_high' order by status", [own.trip]);
      expect(rows.rows).toEqual([{ status: 'open' }, { status: 'resolved' }]);
    });
  });

  it('d: requires a trip, a known alert type and a valid status', async () => {
    await rejects(insertAlert, [randomUUID(), own.trip, own.device, 'sensor_error', openedAt]);
    await rejects(insertAlert, [randomUUID(), null, own.device, 'connection_lost', openedAt], '23502');
    await rejects("update public.alerts set status = 'recovered' where id = $1", [own.alert]);
    await isolated(async () => {
      await db.query(insertAlert, [randomUUID(), own.trip, own.device, 'connection_lost', openedAt]);
      await db.query(insertAlert, [randomUUID(), own.trip, own.device, 'temp_low', openedAt]);
    });
  });

  it('e: requires acknowledgment and resolution metadata', async () => {
    const acknowledge = `update public.alerts set status = 'acknowledged', acknowledged_at = $1,
      acknowledged_by = $2 where id = $3`;
    await rejects(acknowledge, [later, null, own.alert], '23514', 'alerts_acknowledged_fields');
    await rejects(acknowledge, [null, driver.id, own.alert], '23514', 'alerts_acknowledged_fields');
    const resolve = `update public.alerts set status = 'resolved', resolved_at = $1, resolved_by = $2,
      resolution_note = $3 where id = $4`;
    for (const note of [null, '', ' \t\n']) {
      await rejects(resolve, [later, admin.id, note, own.alert], '23514', 'alerts_resolved_fields');
    }
    await rejects(resolve, [null, admin.id, 'test resolution', own.alert], '23514', 'alerts_resolved_fields');
    await rejects(resolve, [later, null, 'test resolution', own.alert], '23514', 'alerts_resolved_fields');
  });

  it('f: accepts system alert events without an actor and rejects unknown event types', async () => {
    const insert = `insert into public.alert_events (alert_id, event_type, actor_id, created_at)
      values ($1, $2, null, $3) returning actor_id, payload`;
    await rejects(insert, [own.alert, 'invalid', later]);
    await isolated(async () => {
      for (const type of ['opened', 'recovered', 'acknowledged', 'resolved', 'reopened', 'recurred']) {
        const event = await db.query(insert, [own.alert, type, later]);
        expect(event.rows).toEqual([{ actor_id: null, payload: {} }]);
      }
    });
  });

  it('g: rejects sensitive top-level notification keys and accepts an invalidation payload', async () => {
    for (const key of ['lat', 'lng', 'gps', 'phone']) {
      await rejects(insertNotification, [randomUUID(), customer.id, { [key]: null }], '23514', 'notifications_payload_no_sensitive_keys');
    }
    await isolated(async () => {
      const payload = { alert_id: own.alert };
      const result = await db.query(insertNotification, [randomUUID(), customer.id, payload]);
      expect(result.rows).toEqual([{ payload }]);
    });
  });

  it('h: audit logs allow inserts and block updates/deletes even for privileged roles', async () => {
    const update = "update public.audit_logs set action = 'changed' where id = $1";
    const remove = 'delete from public.audit_logs where id = $1';
    await rejects(update, [auditId], '42501');
    await rejects(remove, [auditId], '42501');
    await isolated(async () => {
      const inserted = await db.query(insertAudit, [null, own.alert, later]);
      expect(inserted.rowCount).toBe(1);
    });
    await isolated(async () => {
      await db.query('reset role');
      // The owner has SQL write privileges, so this verifies the trigger itself.
      for (const sql of [update, remove]) {
        await expect(isolated(() => db.query(sql, [auditId]))).rejects.toMatchObject({
          code: '42501', message: 'audit_logs is append-only',
        });
      }
    });
    for (const id of [admin.id, null]) {
      for (const sql of [update, remove]) {
        await expect(asClient(id, () => db.query(sql, [auditId]))).rejects.toMatchObject({ code: '42501' });
      }
    }
  });

  it('i: idempotency keys are unique per user and expire strictly after creation', async () => {
    await rejects(insertIdempotency, [admin.id, idempotencyKey, openedAt, later], '23505', 'idempotency_requests_user_key');
    await isolated(() => db.query(insertIdempotency, [customer.id, idempotencyKey, openedAt, later]));
    for (const expiry of [openedAt, '2025-12-31T23:59:59Z']) {
      await rejects(insertIdempotency, [admin.id, randomUUID(), openedAt, expiry], '23514', 'idempotency_requests_expiry');
    }
  });

  it('j: validates outbox status, timestamps, attempts and the pending index', async () => {
    const defaults = await db.query('select status, attempts, published_at from public.outbox_events where id = $1', [outboxId]);
    expect(defaults.rows).toEqual([{ status: 'pending', attempts: 0, published_at: null }]);
    await rejects("update public.outbox_events set status = 'published' where id = $1", [outboxId], '23514', 'outbox_events_published_time');
    await rejects("update public.outbox_events set status = 'sent' where id = $1", [outboxId]);
    await rejects('update public.outbox_events set attempts = -1 where id = $1', [outboxId]);
    await isolated(() => db.query("update public.outbox_events set status = 'published', published_at = $1 where id = $2", [later, outboxId]));
    const index = await db.query(`select pg_get_indexdef(i.indexrelid, 1, true) as key,
      pg_get_expr(i.indpred, i.indrelid) as predicate, i.indisvalid as valid
      from pg_index i where i.indexrelid = 'public.outbox_events_pending_available_at_idx'::regclass
      and i.indrelid = 'public.outbox_events'::regclass`);
    expect(index.rows).toEqual([{ key: 'available_at', predicate: "(status = 'pending'::text)", valid: true }]);
  });

  it('k: applies the same trip and shipment scope to alerts and alert events', async () => {
    const scopes = new Map([
      [admin.id, [own.alert, other.alert].sort()],
      [driver.id, [own.alert]], [otherDriver.id, [other.alert]],
      [customer.id, [own.alert]], [otherCustomer.id, [other.alert]],
    ]);
    for (const account of accounts) {
      await asClient(account.id, async () => {
        const expected = scopes.get(account.id) ?? [];
        const alerts = await db.query('select id from public.alerts order by id');
        const events = await db.query('select alert_id from public.alert_events order by alert_id');
        expect(alerts.rows).toEqual(expected.map(id => ({ id })));
        expect(events.rows).toEqual(expected.map(alert_id => ({ alert_id })));
        if (account.role === 'customer') {
          expect((await db.query('select id from public.trips')).rows).toEqual([]);
        }
      });
    }
    for (const table of ['alerts', 'alert_events']) {
      await expect(asClient(null, () => db.query(`select * from public.${table}`))).rejects.toMatchObject({ code: '42501' });
    }
  });

  it('l: active users see only their own notification, including admins', async () => {
    for (const account of accounts) {
      await asClient(account.id, async () => {
        const result = await db.query('select id, user_id from public.notifications');
        expect(result.rows).toEqual(account.status === 'active' ? [{ id: account.notification, user_id: account.id }] : []);
      });
    }
    await expect(asClient(null, () => db.query('select * from public.notifications'))).rejects.toMatchObject({ code: '42501' });
  });

  it('m: system tables are readable by service_role only among the application roles', async () => {
    for (const table of privateTables) {
      expect((await db.query(`select * from public.${table}`)).rowCount).toBe(1);
      for (const id of [...accounts.map(account => account.id), null]) {
        await expect(asClient(id, () => db.query(`select * from public.${table}`))).rejects.toMatchObject({ code: '42501' });
      }
    }
  });

  it('n: enables RLS on all six tables and revokes direct client writes', async () => {
    const rls = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = any($1) and c.relrowsecurity`, [tables]);
    expect(rls.rowCount).toBe(tables.length);
    const grants = await db.query(`select r.role, t.table_name, p.privilege
      from unnest(array['anon', 'authenticated']) r(role)
      cross join unnest($1::text[]) t(table_name)
      cross join unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p(privilege)
      where has_table_privilege(r.role, 'public.' || t.table_name, p.privilege)`, [tables]);
    expect(grants.rowCount).toBe(0);
    for (const table of tables) {
      for (const id of [admin.id, null]) {
        await expect(asClient(id, () => db.query(`delete from public.${table} where false`))).rejects.toMatchObject({ code: '42501' });
      }
    }
  });
});
