import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import pg from 'pg';

const env = { ...(existsSync('../.env') ? parse(readFileSync('../.env')) : {}), ...process.env };
const issuedAt = '2026-01-01T00:00:00Z';
const expiresAt = '2026-01-01T00:00:30Z';

describe('config, commands and ACK migration (real PostgreSQL)', () => {
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
  const [own, other] = [driver, otherDriver].map(owner => ({
    owner: owner.id,
    device: randomUUID(),
    vehicle: randomUUID(),
    shipment: randomUUID(),
    trip: randomUUID(),
    config: randomUUID(),
    command: randomUUID(),
  }));
  const unscopedCommand = randomUUID();
  const ack = randomUUID();
  const privateTables = ['device_command_attempts', 'device_command_acks'];
  const tables = ['temperature_config_versions', 'device_commands', ...privateTables];
  let ownCommandId: string;
  let otherCommandId: string;

  const insertConfig = `insert into public.temperature_config_versions
    (id, device_id, trip_id, config_version_no, target_min, target_max, status, issued_by, issued_at)
    values ($1, $2, $3, $4, -20.5, -19, 'approved', $5, $6)`;
  const insertManual = `insert into public.device_commands
    (command_id, device_id, trip_id, type, payload, state, duration_seconds, issued_at, expires_at, status, issued_by)
    values ($1, $2, $3, 'set_relay_manual', '{}', 'on', 600, $4, $5, $6, $7) returning id`;
  const insertAck = `insert into public.device_command_acks
    (ack_id, command_id, device_id, result, reason, retry_after_seconds, received_at)
    values ($1, $2, $3, $4, $5, $6, $7)`;

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
    for (const fixture of [own, other]) {
      await db.query('insert into public.vehicles (id, plate) values ($1, $2)', [fixture.vehicle, `TEST-${fixture.vehicle}`]);
      await db.query('insert into public.devices (id, device_code) values ($1, $2)', [fixture.device, `TEST-${fixture.device}`]);
      await db.query(`insert into public.shipments (id, customer_id, product_type, temp_min, temp_max)
        values ($1, $2, 'test-only', -21, -19)`, [fixture.shipment, customer.id]);
      await db.query(`insert into public.trips (id, shipment_id, vehicle_id, driver_id, device_id)
        values ($1, $2, $3, $4, $5)`, [fixture.trip, fixture.shipment, fixture.vehicle, fixture.owner, fixture.device]);
    }
    await db.query(insertConfig, [own.config, own.device, own.trip, 1, admin.id, issuedAt]);
    const first = await db.query<{ id: string }>(insertManual, [own.command, own.device, own.trip, issuedAt, expiresAt, 'queued', admin.id]);
    const second = await db.query<{ id: string }>(insertManual, [other.command, other.device, other.trip, issuedAt, expiresAt, 'sent', admin.id]);
    ownCommandId = first.rows[0].id;
    otherCommandId = second.rows[0].id;
    await db.query(`insert into public.device_commands
      (command_id, device_id, type, payload, config_version_id, issued_at, expires_at, status, issued_by)
      values ($1, $2, 'set_target_range', '{}', $3, $4, $5, 'acked_applied', $6)`,
    [unscopedCommand, own.device, own.config, issuedAt, expiresAt, admin.id]);
    await db.query('insert into public.device_command_attempts (command_id, attempt_no) values ($1, 1)', [ownCommandId]);
    await db.query(insertAck, [ack, ownCommandId, own.device, 'rejected', 'min_switch_interval', 20, expiresAt]);
    await db.query(`insert into public.telemetry_rollups_minute
      (device_id, trip_id, minute_utc, window_seconds, covered_seconds, missing_seconds, sample_count, valid_sample_count)
      values ($1, $2, $3, 60, 0, 60, 0, 0)`, [own.device, own.trip, issuedAt]);
  }, 30000);

  afterAll(async () => {
    try {
      if (connected) await db.query('rollback');
    } finally {
      await db.end();
    }
  });

  async function isolated<T>(run: () => Promise<T>) {
    await db.query('savepoint config_commands_test');
    try {
      return await run();
    } finally {
      await db.query('rollback to savepoint config_commands_test');
      await db.query('release savepoint config_commands_test');
    }
  }

  async function rejects(sql: string, args: unknown[], code = '23514', constraint?: string) {
    await expect(isolated(() => db.query(sql, args)))
      .rejects.toMatchObject(constraint ? { code, constraint } : { code });
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

  it('b: configuration version is positive and unique per device', async () => {
    await rejects(insertConfig, [randomUUID(), own.device, own.trip, 1, admin.id, issuedAt], '23505', 'temperature_config_versions_device_version_key');
    await rejects(insertConfig, [randomUUID(), own.device, own.trip, 0, admin.id, issuedAt]);
    await isolated(async () => {
      await db.query(insertConfig, [other.config, other.device, other.trip, 1, admin.id, issuedAt]);
      // Multiple versions may share a status on the same device.
      await db.query(insertConfig, [randomUUID(), own.device, own.trip, 2, admin.id, issuedAt]);
    });
  });

  it('c: enforces temperature boundaries, width and half-degree steps', async () => {
    const update = 'update public.temperature_config_versions set target_min = $1, target_max = $2 where id = $3';
    for (const [min, max] of [[-19, -20], [-20, -20], [-20, -19.5], [-20, -19], [-25.5, -22], [-20, -14.5], [-20.25, -18], [-20, -18.25]]) {
      await rejects(update, [min, max, own.config], '23514', 'temperature_config_versions_range');
    }
    for (const [min, max] of [[-25, -15], [-20.5, -19]]) {
      await isolated(() => db.query(update, [min, max, own.config]));
    }
  });

  it('d: failed configuration requires a reason and applied requires its timestamp', async () => {
    const update = 'update public.temperature_config_versions set status = $1, failure_reason = $2, applied_at = $3 where id = $4';
    await rejects(update, ['failed', null, null, own.config], '23514', 'temperature_config_versions_failed_reason');
    await rejects(update, ['applied', null, null, own.config], '23514', 'temperature_config_versions_applied_time');
    await rejects(update, ['queued', null, null, own.config]);
    await isolated(async () => {
      await db.query(update, ['failed', 'test delivery error', null, own.config]);
      await db.query(update, ['applied', null, expiresAt, own.config]);
    });
  });

  it('e: command UUID is unique and its expiry must be exactly 30 seconds after issuance', async () => {
    await rejects('update public.device_commands set command_id = $1 where id = $2', [own.command, otherCommandId], '23505', 'device_commands_command_id_key');
    for (const invalid of ['2026-01-01T00:00:29Z', '2026-01-01T00:00:30.001Z']) {
      await rejects('update public.device_commands set expires_at = $1 where id = $2', [invalid, ownCommandId], '23514', 'device_commands_expiry');
    }
  });

  it('f: relay commands need a trip, state and duration, and forbid a config reference', async () => {
    for (const field of ['trip_id', 'state', 'duration_seconds']) {
      await rejects(`update public.device_commands set ${field} = null where id = $1`, [ownCommandId], '23514', 'device_commands_type_fields');
    }
    for (const duration of [0, 1801]) {
      await rejects('update public.device_commands set duration_seconds = $1 where id = $2', [duration, ownCommandId]);
    }
    await rejects('update public.device_commands set config_version_id = $1 where id = $2', [own.config, ownCommandId], '23514', 'device_commands_type_fields');
    for (const duration of [1, 1800]) {
      await isolated(() => db.query('update public.device_commands set duration_seconds = $1 where id = $2', [duration, ownCommandId]));
    }
  });

  it('g: target-range commands require config and forbid state and duration', async () => {
    for (const assignment of ['config_version_id = null', "state = 'off'", 'duration_seconds = 600']) {
      await rejects(`update public.device_commands set ${assignment} where command_id = $1`, [unscopedCommand], '23514', 'device_commands_type_fields');
    }
  });

  it('h: unfinished commands reserve their device until terminal status', async () => {
    for (const status of ['queued', 'sent']) {
      for (const fixture of [own, other]) {
        await rejects(insertManual, [randomUUID(), fixture.device, fixture.trip, issuedAt, expiresAt, status, admin.id],
          '23505', 'device_commands_one_unfinished_per_device_idx');
      }
    }
    await isolated(async () => {
      await db.query("update public.device_commands set status = 'acked_applied' where id = $1", [ownCommandId]);
      await db.query(insertManual, [randomUUID(), own.device, own.trip, issuedAt, expiresAt, 'queued', admin.id]);
    });
  });

  it('i: command status and failure reason are restricted, including excluding guard reasons', async () => {
    await rejects("update public.device_commands set status = 'applied' where id = $1", [ownCommandId]);
    for (const reason of ['invalid', 'min_switch_interval']) {
      await rejects('update public.device_commands set failure_reason = $1 where id = $2', [reason, ownCommandId]);
    }
    for (const reason of [null, 'expired', 'publish_failed', 'device_failed', 'superseded_command', 'internal_error']) {
      await isolated(() => db.query('update public.device_commands set failure_reason = $1 where id = $2', [reason, ownCommandId]));
    }
  });

  it('j: allows only distinct attempt numbers 1 through 3 for each command', async () => {
    const insert = 'insert into public.device_command_attempts (command_id, attempt_no) values ($1, $2)';
    for (const number of [0, 4]) await rejects(insert, [ownCommandId, number]);
    await rejects(insert, [ownCommandId, 1], '23505', 'device_command_attempts_command_attempt_key');
    await isolated(async () => {
      await db.query(insert, [ownCommandId, 2]);
      await db.query(insert, [ownCommandId, 3]);
      await db.query(insert, [otherCommandId, 1]);
    });
  });

  it('k: ACK IDs are unique per device and multiple ACKs can remain in command history', async () => {
    await rejects(insertAck, [ack, ownCommandId, own.device, 'applied', null, null, expiresAt], '23505', 'device_command_acks_device_ack_key');
    await rejects(insertAck, [randomUUID(), ownCommandId, own.device, 'sent', null, null, expiresAt]);
    await rejects(insertAck, [randomUUID(), ownCommandId, own.device, 'rejected', 'min_switch_interval', -1, expiresAt]);
    await isolated(async () => {
      await db.query(insertAck, [ack, otherCommandId, other.device, 'failed', null, null, expiresAt]);
      await db.query(insertAck, [randomUUID(), ownCommandId, own.device, 'applied', null, 0, '2026-01-01T00:00:45Z']);
      const history = await db.query('select result, reason, retry_after_seconds from public.device_command_acks where command_id = $1 order by received_at', [ownCommandId]);
      expect(history.rows).toEqual([
        { result: 'rejected', reason: 'min_switch_interval', retry_after_seconds: 20 },
        { result: 'applied', reason: null, retry_after_seconds: 0 },
      ]);
      const stored = await db.query('select status, failure_reason from public.device_commands where id = $1', [ownCommandId]);
      expect(stored.rows).toEqual([{ status: 'queued', failure_reason: null }]);
    });
  });

  it('l: both late foreign keys reject missing configs and accept valid configs', async () => {
    const updateTrip = 'update public.trips set departure_config_version_id = $1 where id = $2';
    const updateRollup = 'update public.telemetry_rollups_minute set config_version_id = $1 where trip_id = $2';
    const missing = randomUUID();
    await rejects(updateTrip, [missing, own.trip], '23503', 'trips_departure_config_version_fk');
    await rejects(updateRollup, [missing, own.trip], '23503', 'telemetry_rollups_minute_config_version_fk');
    await isolated(async () => {
      expect((await db.query(updateTrip, [own.config, own.trip])).rowCount).toBe(1);
      expect((await db.query(updateRollup, [own.config, own.trip])).rowCount).toBe(1);
    });
  });

  it('m: scopes config and command reads, and hides attempts and ACKs from all clients', async () => {
    for (const account of accounts) {
      await asClient(account.id, async () => {
        const configs = await db.query('select id from public.temperature_config_versions');
        expect(configs.rows).toEqual(account === admin ? [{ id: own.config }] : []);
        const commands = await db.query('select command_id from public.device_commands order by command_id');
        const expected = account === admin ? [own.command, other.command, unscopedCommand].sort()
          : account === driver ? [own.command] : account === otherDriver ? [other.command] : [];
        expect(commands.rows).toEqual(expected.map(command_id => ({ command_id })));
      });
      for (const table of privateTables) {
        await expect(asClient(account.id, () => db.query(`select * from public.${table}`))).rejects.toMatchObject({ code: '42501' });
      }
    }
    for (const table of tables) {
      await expect(asClient(null, () => db.query(`select * from public.${table}`))).rejects.toMatchObject({ code: '42501' });
    }
  });

  it('n: RLS is enabled and neither SQL client role can write to any new table', async () => {
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
