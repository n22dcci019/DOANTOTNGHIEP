import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Logger, Module, type INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import pg from 'pg';
import { ApiModule, configureApi } from '../libs/api/api.module.js';
import { AccountsModule } from '../apps/api/src/accounts/accounts.module.js';
import { EMAIL_SENDER, NoopEmailSender } from '../libs/email/email-sender.js';
import { errorStatus } from '../libs/api/errors.js';

@Module({ imports: [ConfigModule.forRoot({
  isGlobal: true, envFilePath: resolve('..', '.env'),
  load: [() => ({ EMAIL_PROVIDER: 'noop', EXPOSE_INVITE_TOKEN_FOR_TEST: 'false' })],
}), ApiModule, AccountsModule] })
class ProfilesTestModule {}

describe('profiles and invitations 2.2 (real PostgreSQL and Supabase Auth)', () => {
  const env = { ...parse(readFileSync('../.env')), ...process.env };
  const db = new pg.Client({ connectionString: env.DATABASE_URL });
  let app: INestApplication | undefined;
  let base: string;
  let auth: SupabaseClient;
  let client: SupabaseClient;
  let emails: NoopEmailSender;
  const logs: string[] = [];
  const tokens: string[] = [];
  const passwords: string[] = [];
  const accounts: Record<string, { id: string; token: string; email: string }> = {};
  // Keep generated addresses within email's 64-character local-part limit.
  const prefix = `be22-${randomUUID().slice(0, 8)}`;
  const logger = { log: () => undefined, debug: () => undefined, verbose: () => undefined,
    warn: (message: unknown) => logs.push(String(message)), error: (message: unknown) => logs.push(String(message)),
    fatal: (message: unknown) => logs.push(String(message)) };
  const hash = (token: string) => createHash('sha256').update(token).digest('hex');

  beforeAll(async () => {
    const status = JSON.parse(execFileSync(process.execPath, [resolve('node_modules/supabase/dist/supabase.js'),
      'status', '--workdir', '..', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })) as {
        API_URL: string; SERVICE_ROLE_KEY: string; ANON_KEY: string;
      };
    auth = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    await db.connect();
    for (const name of ['admin', 'customer']) {
      const email = `${prefix}-${name}@example.test`; const password = `Test-${randomUUID()}!`;
      passwords.push(password);
      const created = await auth.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) throw new Error('Auth fixture creation failed');
      const id = created.data.user.id;
      await db.query('insert into public.profiles(id,full_name,email) values($1,$2,$3)', [id, name, email]);
      await db.query("insert into public.account_access(user_id,role_id,status) select $1,id,'active' from public.roles where code=$2", [id, name]);
      const login = await client.auth.signInWithPassword({ email, password });
      if (login.error || !login.data.session) throw new Error('Auth fixture login failed');
      accounts[name] = { id, token: login.data.session.access_token, email };
    }
    Logger.overrideLogger(logger);
    app = await NestFactory.create(ProfilesTestModule, { logger }); configureApi(app);
    emails = app.get<NoopEmailSender>(EMAIL_SENDER);
    expect(emails).toBeInstanceOf(NoopEmailSender);
    await app.listen(0, '127.0.0.1'); base = `${await app.getUrl()}/api/v1`;
  }, 60000);

  afterAll(async () => {
    await app?.close(); Logger.overrideLogger(new Logger()); await db.end();
    // These fixtures have committed append-only audit rows referencing profiles.
    // Do not weaken immutability for cleanup. npm test's subsequent seed reset
    // removes the entire fixture dataset before restoring the demo environment.
  });

  function request(path: string, body: unknown, who: string | null = 'admin', key: string | null = randomUUID(), method = 'POST') {
    return fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json',
      ...(who ? { Authorization: `Bearer ${accounts[who].token}` } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    }, body: JSON.stringify(body) });
  }
  async function error(response: Response, status: number, code: string) {
    expect(response.status).toBe(status);
    const body = await response.json() as { error: { code: string; message: string; details: unknown; request_id: string } };
    expect(Object.keys(body)).toEqual(['error']);
    expect(Object.keys(body.error).sort()).toEqual(['code', 'details', 'message', 'request_id']);
    expect(body.error.code).toBe(code); expect(body.error.request_id).toBe(response.headers.get('X-Request-Id'));
    expect(body.error.request_id).toBeTruthy(); expect(typeof body.error.message).toBe('string');
    expect(JSON.stringify(body)).not.toMatch(/23505|SQL|constraint|stack|account_invitations|profiles_email_lower_unique/);
    if (code !== 'VERSION_CONFLICT') expect(body.error.details).toBeNull();
    return body.error;
  }
  async function version(who: string) {
    return (await db.query<{ version: number }>('select version from public.profiles where id=$1', [accounts[who].id])).rows[0].version;
  }
  async function invitation(role = 'customer') {
    const email = `${prefix}-${randomUUID()}@example.test`; const before = emails.messages.length;
    const response = await request('/invitations', { email, role_code: role }); expect(response.status).toBe(202);
    const body = await response.json() as { id: string; token?: string }; expect(body.token).toBeUndefined();
    expect(emails.messages).toHaveLength(before + 1);
    const message = emails.messages.at(-1)!; expect(message.to).toBe(email);
    const link = /http[^\s]+/.exec(message.text)?.[0]; expect(link).toBeTruthy();
    const token = new URL(link!).searchParams.get('token')!; tokens.push(token);
    expect(Buffer.from(token, 'base64url').length).toBeGreaterThanOrEqual(32);
    return { id: body.id, email, token };
  }
  function registration(token: string, name = 'Invited user') {
    const password = `Test-${randomUUID()}!`; passwords.push(password); return { token, full_name: name, password };
  }

  it('a: all 10 migrations applied; version and invitation constraints exist', async () => {
    expect((await db.query('select count(*)::int as n from supabase_migrations.schema_migrations')).rows[0].n).toBe(10);
    expect((await db.query("select relrowsecurity from pg_class where oid='public.account_invitations'::regclass")).rows[0].relrowsecurity).toBe(true);
    expect((await db.query("select indexdef from pg_indexes where indexname='profiles_email_lower_unique'")).rowCount).toBe(1);
  });
  it('b: admin and customer update only their own profile', async () => {
    for (const who of ['admin', 'customer']) {
      const response = await request('/me', { full_name: `${who} changed`, version: await version(who) }, who, randomUUID(), 'PATCH');
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ id: accounts[who].id, full_name: `${who} changed` });
    }
    await error(await request(`/me/${accounts.customer.id}`, { full_name: 'Hacked', version: 1 }, 'admin', randomUUID(), 'PATCH'), 404, 'NOT_FOUND');
  });
  it('c: optimistic version increments and stale writes report current_version', async () => {
    const before = await version('customer');
    const good = await request('/me', { full_name: 'Versioned', version: before }, 'customer', randomUUID(), 'PATCH');
    expect(good.status).toBe(200); expect(await good.json()).toMatchObject({ version: before + 1 });
    const bad = await error(await request('/me', { full_name: 'Stale', version: before }, 'customer', randomUUID(), 'PATCH'), 409, 'VERSION_CONFLICT');
    expect(bad.details).toEqual({ current_version: before + 1 });
  });
  it('d: rejects foreign/malformed phone numbers, accepts Vietnamese and strips spaces', async () => {
    for (const phone of ['12345', '+12025550123']) await error(await request('/me', { phone, version: await version('customer') }, 'customer', randomUUID(), 'PATCH'), 400, 'VALIDATION_FAILED');
    for (const phone of ['0912345678', '+84912345678', '0 912 345 678']) {
      const response = await request('/me', { phone, version: await version('customer') }, 'customer', randomUUID(), 'PATCH');
      expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ phone: phone.replace(/\s/g, '') });
    }
  });
  it('e,q: case-insensitive email conflict returns CONFLICT 409; Auth email stays unchanged', async () => {
    expect(errorStatus.CONFLICT).toBe(409);
    await error(await request('/me', { email: accounts.admin.email.toUpperCase(), version: await version('customer') }, 'customer', randomUUID(), 'PATCH'), 409, 'CONFLICT');
    const response = await request('/me', { email: `${prefix}-changed@example.test`, version: await version('customer') }, 'customer', randomUUID(), 'PATCH');
    expect(response.status).toBe(200);
    expect((await auth.auth.admin.getUserById(accounts.customer.id)).data.user?.email).toBe(accounts.customer.email);
  });
  it('f: customer cannot invite customer/admin; admin sends one local email and stores only hash', async () => {
    for (const role of ['customer', 'admin']) await error(await request('/invitations', { email: `${prefix}-denied@example.test`, role_code: role }, 'customer'), 403, 'FORBIDDEN');
    const invite = await invitation();
    const row = (await db.query('select *, expires_at-created_at as lifetime from public.account_invitations where id=$1', [invite.id])).rows[0];
    expect(row.token_hash).toBe(hash(invite.token)); expect(JSON.stringify(row)).not.toContain(invite.token);
    expect(new Date(row.expires_at).getTime() - new Date(row.created_at).getTime()).toBe(72 * 3600000);
    expect(logs.join('\n')).not.toContain(invite.token);
  });
  it('g: public accept needs no idempotency key, creates active invited role, rejects reuse', async () => {
    const invite = await invitation('driver'); const body = registration(invite.token);
    const response = await request('/invitations/accept', body, null, null); expect(response.status).toBe(201);
    const result = await response.json() as { user_id: string };
    const account = (await db.query(`select a.status,r.code from public.account_access a join public.roles r on r.id=a.role_id where a.user_id=$1`, [result.user_id])).rows[0];
    expect(account).toEqual({ status: 'active', code: 'driver' });
    expect((await client.auth.signInWithPassword({ email: invite.email, password: body.password })).error).toBeNull();
    await error(await request('/invitations/accept', body, null, null), 404, 'NOT_FOUND');
  });
  it('g2: an admin invitation created by admin yields exactly its DB role', async () => {
    const invite = await invitation('admin');
    const response = await request('/invitations/accept', registration(invite.token), null, null);
    expect(response.status).toBe(201);
    const result = await response.json() as { user_id: string };
    const role = (await db.query(`select r.code from public.account_access a join public.roles r on r.id=a.role_id where a.user_id=$1`, [result.user_id])).rows[0];
    expect(role.code).toBe('admin');
  });
  it('h: expired and unknown tokens return the same 404', async () => {
    const invite = await invitation();
    // Preserve the exact 72-hour check while moving the whole window into the past.
    await db.query("update public.account_invitations set created_at=now()-interval '4 days',expires_at=now()-interval '1 day' where id=$1", [invite.id]);
    for (const token of [invite.token, 'invalid-token']) await error(await request('/invitations/accept', registration(token), null, null), 404, 'NOT_FOUND');
  });
  it('i: revoked invitation returns 404', async () => {
    const invite = await invitation(); await db.query('update public.account_invitations set revoked_at=now() where id=$1', [invite.id]);
    await error(await request('/invitations/accept', registration(invite.token), null, null), 404, 'NOT_FOUND');
  });
  it('j: concurrent accepts create exactly one Auth account and one active account', async () => {
    const invite = await invitation(); const body = registration(invite.token);
    const responses = await Promise.all([request('/invitations/accept', body, null, null), request('/invitations/accept', body, null, null)]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 404]);
    await error(responses.find(r => r.status === 404)!, 404, 'NOT_FOUND');
    expect((await db.query('select id from auth.users where lower(email)=lower($1)', [invite.email])).rowCount).toBe(1);
    expect((await db.query('select id from public.profiles where lower(email)=lower($1)', [invite.email])).rowCount).toBe(1);
  });
  it('k: real DB failure compensates Auth creation; invitation stays unused and retry succeeds', async () => {
    const invite = await invitation(); const name = `${prefix}-force-db-failure`; const body = registration(invite.token, name);
    await db.query(`alter table public.profiles add constraint be22_test_failure check (full_name <> '${name}') not valid`);
    try { await error(await request('/invitations/accept', body, null, null), 500, 'INTERNAL'); }
    finally { await db.query('alter table public.profiles drop constraint be22_test_failure'); }
    expect((await db.query('select id from auth.users where lower(email)=lower($1)', [invite.email])).rowCount).toBe(0);
    expect((await db.query('select used_at from public.account_invitations where id=$1', [invite.id])).rows[0].used_at).toBeNull();
    expect(logs.some(log => /compensating Auth user_id=/.test(log) && /\[[^\]]+\]/.test(log))).toBe(true);
    expect((await request('/invitations/accept', body, null, null)).status).toBe(201);
  });
  it('l: suspension blocks all authenticated account routes; activation restores access', async () => {
    expect((await request(`/accounts/${accounts.customer.id}/suspend`, {})).status).toBe(200);
    await error(await request('/me', { full_name: 'Blocked', version: await version('customer') }, 'customer', randomUUID(), 'PATCH'), 403, 'ACCOUNT_INACTIVE');
    await error(await request('/invitations', { email: `${prefix}-blocked@example.test`, role_code: 'customer' }, 'customer'), 403, 'ACCOUNT_INACTIVE');
    for (const action of ['suspend', 'activate']) await error(await request(`/accounts/${accounts.admin.id}/${action}`, {}, 'customer'), 403, 'ACCOUNT_INACTIVE');
    expect((await request(`/accounts/${accounts.customer.id}/activate`, {})).status).toBe(200);
    expect((await request('/me', { full_name: 'Restored', version: await version('customer') }, 'customer', randomUUID(), 'PATCH')).status).toBe(200);
  });
  it('m: admin cannot suspend self; customer cannot manage accounts', async () => {
    await error(await request(`/accounts/${accounts.admin.id}/suspend`, {}), 422, 'UNPROCESSABLE');
    await error(await request(`/accounts/${accounts.admin.id}/suspend`, {}, 'customer'), 403, 'FORBIDDEN');
  });
  it('n: invitation replay sends one email; profile replay increments version once', async () => {
    const key = randomUUID(); const email = `${prefix}-replay@example.test`; const body = { email, role_code: 'customer' };
    const before = emails.messages.length;
    const first = await request('/invitations', body, 'admin', key); expect(first.status).toBe(202); const result = await first.json();
    const second = await request('/invitations', body, 'admin', key); expect(second.status).toBe(202); expect(await second.json()).toEqual(result);
    expect(emails.messages).toHaveLength(before + 1); expect((await db.query('select id from public.account_invitations where email=$1', [email])).rowCount).toBe(1);
    tokens.push(new URL(/http[^\s]+/.exec(emails.messages.at(-1)!.text)![0]).searchParams.get('token')!);
    const profileKey = randomUUID(); const oldVersion = await version('customer'); const patch = { full_name: 'Replay', version: oldVersion };
    const p1 = await request('/me', patch, 'customer', profileKey, 'PATCH'); expect(p1.status).toBe(200); const saved = await p1.json();
    const p2 = await request('/me', patch, 'customer', profileKey, 'PATCH'); expect(p2.status).toBe(200); expect(await p2.json()).toEqual(saved);
    expect(await version('customer')).toBe(oldVersion + 1);
  });
  it('o: every successful write has the correct audit entity/actor and no token/password/plain email', async () => {
    const rows = (await db.query(`select * from public.audit_logs where actor_id in
      (select id from public.profiles where email like $1)`, [`${prefix}%`])).rows;
    for (const [action, entity] of [['profiles.update', 'profiles'], ['account.invite', 'account_invitations'],
      ['account.invitation.accept', 'account_invitations'], ['account.suspend', 'account_access'], ['account.activate', 'account_access']]) {
      expect(rows.some(row => row.action === action && row.entity === entity)).toBe(true);
    }
    for (const row of rows) {
      if (row.action === 'profiles.update') expect(row.actor_id).toBe(row.entity_id);
      if (['account.invite', 'account.suspend', 'account.activate'].includes(row.action)) expect(row.actor_id).toBe(accounts.admin.id);
      if (row.action === 'account.invitation.accept') expect(row.actor_id).toBe(row.payload.user_id);
      expect(JSON.stringify(row.payload)).not.toMatch(/token|password|@example\.test/);
    }
    const text = `${JSON.stringify(rows)}\n${logs.join('\n')}`;
    for (const secret of [...tokens, ...passwords]) expect(text).not.toContain(secret);
  });
  it('p: anon and authenticated customer/admin cannot read or write invitations', async () => {
    for (const [role, user] of [['anon', ''], ['authenticated', accounts.customer.id], ['authenticated', accounts.admin.id]]) {
      await db.query('begin');
      try {
        await db.query(`set local role ${role}`); await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
        expect((await db.query("select has_table_privilege($1,'public.account_invitations','INSERT,UPDATE,DELETE') as allowed", [role])).rows[0].allowed).toBe(false);
        await expect(db.query('select * from public.account_invitations')).rejects.toMatchObject({ code: '42501' });
      } finally { await db.query('rollback'); }
    }
  });
  it('r: validation/key failures have the standard error shape', async () => {
    await error(await request('/me', { full_name: 'Missing version' }, 'customer', randomUUID(), 'PATCH'), 400, 'VALIDATION_FAILED');
    await error(await request('/me', { version: await version('customer') }, 'customer', null, 'PATCH'), 400, 'IDEMPOTENCY_KEY_REQUIRED');
    await error(await request('/invitations', { email: 'invalid', role_code: 'customer' }), 400, 'VALIDATION_FAILED');
  });
  it('r2: opt-in test token exposure never persists raw token, including idempotency response', async () => {
    const config = app!.get(ConfigService); config.set('EXPOSE_INVITE_TOKEN_FOR_TEST', 'true');
    try {
      const key = randomUUID(); const body = { email: `${prefix}-expose@example.test`, role_code: 'customer' };
      const first = await request('/invitations', body, 'admin', key); expect(first.status).toBe(202);
      const exposed = await first.json() as { id: string; token: string }; expect(typeof exposed.token).toBe('string');
      const replay = await request('/invitations', body, 'admin', key); expect(replay.status).toBe(202); expect(await replay.json()).toEqual(exposed);
      const saved = await db.query('select to_jsonb(i) as row from public.account_invitations i where id=$1', [exposed.id]);
      expect(JSON.stringify(saved.rows)).not.toContain(exposed.token);
      const idempotency = await db.query('select response from public.idempotency_requests where user_id=$1 and idempotency_key=$2', [accounts.admin.id, key]);
      expect(idempotency.rows[0].response.token).toBeUndefined(); expect(JSON.stringify(idempotency.rows)).not.toContain(exposed.token);
      expect(logs.join('\n')).not.toContain(exposed.token);
    } finally { config.set('EXPOSE_INVITE_TOKEN_FOR_TEST', 'false'); }
  });
});
