import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';

const env = {
  ...(existsSync('../.env') ? parse(readFileSync('../.env')) : {}),
  ...process.env,
};

describe('baseline accounts RLS (real PostgreSQL)', () => {
  const db = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 10000 });
  let connected = false;
  const users: Record<'admin' | 'customer' | 'driver' | 'pending' | 'suspended' | 'missing', string> = {
    admin: randomUUID(), customer: randomUUID(), driver: randomUUID(),
    pending: randomUUID(), suspended: randomUUID(), missing: randomUUID(),
  };
  const tables = ['roles', 'permissions', 'role_permissions', 'profiles', 'account_access'];
  let auth: SupabaseClient | undefined;
  const createdAuthUsers: string[] = [];

  beforeAll(async () => {
    await db.connect();
    connected = true;
    await db.query('begin');
    // Auth owns auth.users: provision fixtures through its service-role Admin API,
    // never grant extra SQL access on auth.users just to make a test pass.
    let key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
      const output = execFileSync(process.execPath, [
        resolve('node_modules/supabase/dist/supabase.js'), 'status', '--workdir', '..', '--output', 'json',
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 });
      key = (JSON.parse(output) as { SERVICE_ROLE_KEY?: string }).SERVICE_ROLE_KEY;
    }
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for Auth Admin test fixtures');
    auth = createClient(env.SUPABASE_URL ?? 'http://127.0.0.1:54321', key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    for (const [name, id] of Object.entries(users)) {
      const result = await auth.auth.admin.createUser({ email: `${id}@example.test`, email_confirm: true });
      if (result.error || !result.data.user) throw new Error(`Auth fixture creation failed: ${result.error?.message}`);
      const userId = result.data.user.id;
      users[name as keyof typeof users] = userId;
      createdAuthUsers.push(userId);
      await db.query('set local role service_role');
      await db.query('insert into public.profiles (id, full_name) values ($1, $2)', [userId, name]);
      if (name !== 'missing') {
        const role = ['admin', 'driver'].includes(name) ? name : 'customer';
        const status = ['pending', 'suspended'].includes(name) ? name : 'active';
        await db.query(`insert into public.account_access (user_id, role_id, status)
          select $1, id, $3 from public.roles where code = $2`, [userId, role, status]);
      }
      await db.query('reset role');
    }
  }, 60000);

  afterAll(async () => {
    // Fixtures never remain as seed/demo data, even if assertions fail.
    if (connected) await db.query('rollback');
    await db.end();
    for (const id of createdAuthUsers) {
      const result = await auth?.auth.admin.deleteUser(id);
      if (result?.error) throw new Error(`Auth fixture cleanup failed: ${result.error.message}`);
    }
  }, 30000);

  async function asClient<T>(id: string | null, role: 'authenticated' | 'anon', run: () => Promise<T>) {
    await db.query('savepoint client_test');
    try {
      await db.query(`set local role ${role}`);
      await db.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
        [id ?? '', JSON.stringify({ sub: id, role })]);
      return await run();
    } finally {
      await db.query('rollback to savepoint client_test');
      await db.query('release savepoint client_test');
    }
  }

  async function profileIds(id: string) {
    return asClient(id, 'authenticated', async () =>
      (await db.query('select id from public.profiles')).rows.map((row: { id: string }) => row.id));
  }

  it('enables RLS on all five baseline tables', async () => {
    const result = await db.query(`select c.relname, c.relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = any($1)`, [tables]);
    expect(result.rowCount).toBe(5);
    expect(result.rows.every((row: { relrowsecurity: boolean }) => row.relrowsecurity)).toBe(true);
  });

  it('a: active admin reads all profiles', async () => {
    expect((await profileIds(users.admin)).sort()).toEqual(Object.values(users).sort());
  });
  it('b: active customer reads only their profile', async () => {
    expect(await profileIds(users.customer)).toEqual([users.customer]);
  });
  it('c: pending user reads no profiles, including their own', async () => {
    expect(await profileIds(users.pending)).toEqual([]);
  });
  it('d: suspended user reads no profiles', async () => {
    expect(await profileIds(users.suspended)).toEqual([]);
  });
  it('e: anon cannot read any baseline table', async () => {
    for (const table of tables) {
      await expect(asClient(null, 'anon', () => db.query(`select * from public.${table}`)))
        .rejects.toMatchObject({ code: '42501' });
    }
  });
  it('f: even an active admin client cannot insert/update/delete account_access', async () => {
    const statements = [
      `insert into public.account_access (user_id, role_id) select '${users.missing}', id from public.roles limit 1`,
      `update public.account_access set status = 'active' where user_id = '${users.pending}'`,
      `delete from public.account_access where user_id = '${users.pending}'`,
    ];
    for (const statement of statements) {
      await expect(asClient(users.admin, 'authenticated', () => db.query(statement)))
        .rejects.toMatchObject({ code: '42501' });
    }
  });
  it('grants no direct client writes on any baseline table', async () => {
    for (const role of ['anon', 'authenticated']) {
      for (const table of tables) {
        for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
          const result = await db.query('select has_table_privilege($1, $2, $3) as allowed', [role, `public.${table}`, privilege]);
          expect(result.rows[0].allowed).toBe(false);
        }
      }
    }
    await expect(asClient(users.customer, 'authenticated', () =>
      db.query('update public.profiles set full_name = $1 where id = $2', ['Changed', users.customer])))
      .rejects.toMatchObject({ code: '42501' });
  });
  it('current_account_role returns only active roles; permissions follow the database role', async () => {
    for (const name of Object.keys(users) as (keyof typeof users)[]) {
      await asClient(users[name], 'authenticated', async () => {
        const result = await db.query(`select public.current_account_role() as role,
          public.has_permission('profiles.read') as profile_read,
          public.has_permission('relay.control') as relay_control,
          public.has_permission('trips.depart') as depart,
          public.has_permission('unknown.permission') as unknown`);
        const active = ['admin', 'customer', 'driver'].includes(name);
        expect(result.rows[0]).toEqual({
          role: active ? name : null, profile_read: active,
          relay_control: name === 'admin', depart: name === 'driver', unknown: false,
        });
      });
    }
  });
  it('reads own account_access regardless of status and reference data only when active', async () => {
    for (const name of Object.keys(users) as (keyof typeof users)[]) {
      await asClient(users[name], 'authenticated', async () => {
        const access = await db.query('select user_id from public.account_access');
        expect(access.rows).toEqual(name === 'missing' ? [] : [{ user_id: users[name] }]);
        for (const table of ['roles', 'permissions', 'role_permissions']) {
          const result = await db.query(`select * from public.${table}`);
          expect((result.rowCount ?? 0) > 0).toBe(['admin', 'customer', 'driver'].includes(name));
        }
      });
    }
  });
  it('helpers are security definer with fixed search_path and no PUBLIC execute', async () => {
    const result = await db.query(`select p.proname, p.prosecdef, p.proconfig,
      exists(select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_execute
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('current_account_role', 'has_permission')`);
    expect(result.rowCount).toBe(2);
    for (const row of result.rows) {
      expect(row.prosecdef).toBe(true);
      expect(row.proconfig).toContain('search_path=""');
      expect(row.public_execute).toBe(false);
    }
  });
});
