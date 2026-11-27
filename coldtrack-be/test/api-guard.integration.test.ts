import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Logger, Module, type INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { decodeProtectedHeader, SignJWT } from 'jose';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import pg from 'pg';
import { configureApi } from '../libs/api/api.module.js';
import { assertVersion } from '../libs/api/errors.js';
import { JwtVerifier } from '../libs/api/jwt-verifier.js';
import { GuardFixturesModule, fixtureState } from './support/guard-fixtures.js';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: resolve('..', '.env') }), GuardFixturesModule] })
class TestAppModule {}

describe('API guard 2.1 (real PostgreSQL and local Supabase Auth)', () => {
  const env = { ...parse(readFileSync('../.env')), ...process.env };
  const db = new pg.Client({ connectionString: env.DATABASE_URL });
  let app: INestApplication | undefined;
  let auth: SupabaseClient;
  let base: string;
  let connected = false;
  let secret: Uint8Array;
  let issuer: string;
  const accounts: Record<string, { id: string; token: string }> = {};
  const ids: string[] = [];
  const logs: string[] = [];
  const logger = {
    log: () => undefined, warn: () => undefined, debug: () => undefined,
    verbose: () => undefined, fatal: (message: unknown) => logs.push(String(message)),
    error: (message: unknown) => logs.push(String(message)),
  };

  beforeAll(async () => {
    const status = JSON.parse(execFileSync(process.execPath, [resolve('node_modules/supabase/dist/supabase.js'),
      'status', '--workdir', '..', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })) as {
        JWT_SECRET: string; SERVICE_ROLE_KEY: string; ANON_KEY: string; API_URL: string;
      };
    secret = new TextEncoder().encode(status.JWT_SECRET);
    issuer = `${status.API_URL}/auth/v1`;
    if (env.SUPABASE_JWT_SECRET !== status.JWT_SECRET) throw new Error('Configured secret must match local Supabase');
    auth = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    await db.connect(); connected = true;
    for (const name of ['admin', 'customer', 'pending', 'suspended', 'missing']) {
      const email = `${randomUUID()}@example.test`;
      const password = `Test-${randomUUID()}!`;
      const created = await auth.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) throw new Error('Auth fixture creation failed');
      const id = created.data.user.id; ids.push(id);
      await db.query('begin');
      try {
        await db.query('set local role service_role');
        await db.query('insert into public.profiles (id,full_name) values ($1,$2)', [id, name]);
        if (name !== 'missing') await db.query(`insert into public.account_access(user_id,role_id,status)
          select $1,id,$3 from public.roles where code=$2`,
        [id, name === 'admin' ? 'admin' : 'customer', ['pending', 'suspended'].includes(name) ? name : 'active']);
        await db.query('commit');
      } catch (error) { await db.query('rollback'); throw error; }
      const login = await client.auth.signInWithPassword({ email, password });
      if (login.error || !login.data.session) throw new Error('Supabase Auth login failed');
      accounts[name] = { id, token: login.data.session.access_token };
    }
    Logger.overrideLogger(logger);
    app = await NestFactory.create(TestAppModule, { logger });
    configureApi(app);
    await app.listen(0, '127.0.0.1'); base = `${await app.getUrl()}/api/v1`;
  }, 60000);

  afterAll(async () => {
    fixtureState.release = undefined; fixtureState.entered = undefined;
    await app?.close(); Logger.overrideLogger(new Logger());
    if (connected) {
      await db.query('begin');
      try {
        await db.query('set local role service_role');
        await db.query('delete from public.idempotency_requests where user_id=any($1::uuid[])', [ids]);
        await db.query('delete from public.account_access where user_id=any($1::uuid[])', [ids]);
        await db.query('delete from public.profiles where id=any($1::uuid[])', [ids]);
        await db.query('commit');
      } catch (error) { await db.query('rollback'); throw error; }
    }
    await db.end();
    for (const id of ids) {
      const result = await auth.auth.admin.deleteUser(id);
      if (result.error) throw result.error;
    }
  }, 30000);

  function get(path: string, who: string | null = 'admin', headers: Record<string, string> = {}) {
    return fetch(`${base}${path}`, { headers: { ...(who ? { Authorization: `Bearer ${accounts[who].token}` } : {}), ...headers } });
  }
  function mutate(key?: string, body: unknown = {}, headers: Record<string, string> = {}) {
    return fetch(`${base}/_t/mutate`, { method: 'POST', headers: {
      Authorization: `Bearer ${accounts.admin.token}`, 'Content-Type': 'application/json',
      ...(key ? { 'Idempotency-Key': key } : {}), ...headers,
    }, body: JSON.stringify(body) });
  }
  async function error(response: Response, status: number, code: string) {
    expect(response.status).toBe(status);
    const body = await response.json() as { error: { code: string; message: string; details: unknown; request_id: string } };
    expect(Object.keys(body)).toEqual(['error']);
    expect(Object.keys(body.error).sort()).toEqual(['code', 'details', 'message', 'request_id']);
    expect(body.error.code).toBe(code);
    expect(body.error.request_id).toBe(response.headers.get('X-Request-Id'));
    expect(body.error.request_id.length).toBeGreaterThan(0);
    expect(typeof body.error.message).toBe('string');
    expect(JSON.stringify(body)).not.toMatch(/private_table|select \*|stack|account_access|idempotency_requests/i);
    if (code !== 'VERSION_CONFLICT') expect(body.error.details).toBeNull();
    return body.error;
  }
  async function signed(claims: Record<string, unknown>, key = secret) {
    return new SignJWT({ aud: 'authenticated', iss: issuer, sub: accounts.admin.id, exp: Math.floor(Date.now() / 1000) + 3600, ...claims })
      .setProtectedHeader({ alg: 'HS256' }).sign(key);
  }

  it('a,o,p: missing Authorization uses standard error and generated request UUID', async () => {
    const body = await error(await get('/_t/any-auth', null), 401, 'UNAUTHENTICATED');
    expect(body.request_id).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('b: rejects bad signature, expired JWT, wrong audience and missing exp', async () => {
    for (const token of [await signed({}, new TextEncoder().encode('wrong-secret')), await signed({ exp: 1 }),
      await signed({ aud: 'other' }), await signed({ exp: undefined })]) {
      await error(await get('/_t/any-auth', null, { Authorization: `Bearer ${token}` }), 401, 'UNAUTHENTICATED');
    }
  });
  it('c: valid Supabase JWT without access is inactive', async () => {
    await error(await get('/_t/any-auth', 'missing'), 403, 'ACCOUNT_INACTIVE');
  });
  it('d: admin has read/approve permission; customer cannot approve', async () => {
    expect((await get('/_t/perm-shipments-read')).status).toBe(200);
    expect((await get('/_t/approve')).status).toBe(200);
    await error(await get('/_t/approve', 'customer'), 403, 'FORBIDDEN');
  });
  it('e: pending/suspended are blocked on every authenticated fixture', async () => {
    for (const who of ['pending', 'suspended']) {
      for (const path of ['/_t/any-auth', '/_t/approve', '/_t/perm-shipments-read', '/_t/version-check', '/_t/internal']) {
        await error(await get(path, who), 403, 'ACCOUNT_INACTIVE');
      }
      await error(await mutate(randomUUID(), {}, { Authorization: `Bearer ${accounts[who].token}` }), 403, 'ACCOUNT_INACTIVE');
    }
  });
  it('e: checks DB status again with the same token on the next request', async () => {
    await db.query("update public.account_access set status='suspended' where user_id=$1", [accounts.admin.id]);
    try { await error(await get('/_t/any-auth'), 403, 'ACCOUNT_INACTIVE'); }
    finally { await db.query("update public.account_access set status='active' where user_id=$1", [accounts.admin.id]); }
    expect((await get('/_t/any-auth')).status).toBe(200);
  });
  it('f: signed role claims cannot elevate or remove DB permissions', async () => {
    await error(await get('/_t/approve', null, { Authorization: `Bearer ${await signed({ sub: accounts.customer.id, role: 'service_role' })}` }), 403, 'FORBIDDEN');
    expect((await get('/_t/approve', null, { Authorization: `Bearer ${await signed({ role: 'customer' })}` })).status).toBe(200);
    const principal = await (await get('/_t/any-auth')).json() as { userId: string; roleCode: string; permissions: string[] };
    expect(principal.userId).toBe(accounts.admin.id); expect(principal.roleCode).toBe('admin');
    expect(principal.permissions).toContain('shipments.approve');
  });
  it('g: missing key and malformed UUID are rejected', async () => {
    await error(await mutate(), 400, 'IDEMPOTENCY_KEY_REQUIRED');
    await error(await mutate('invalid'), 400, 'VALIDATION_FAILED');
  });
  it('h: canonical body replay preserves HTTP 202 and response; handler runs once', async () => {
    const key = randomUUID(); const before = fixtureState.calls;
    const first = await mutate(key, { value: 1, fail: false }); expect(first.status).toBe(202);
    const body = await first.json();
    const second = await mutate(key, { fail: false, value: 1 }); expect(second.status).toBe(202);
    expect(await second.json()).toEqual(body); expect(fixtureState.calls).toBe(before + 1);
  });
  it('i: same key with different payload returns conflict', async () => {
    const key = randomUUID(); expect((await mutate(key, { value: 1 })).status).toBe(202);
    await error(await mutate(key, { value: 2 }), 409, 'IDEMPOTENCY_KEY_REUSED');
  });
  it('j: overlapping requests claim only one handler execution', async () => {
    const key = randomUUID(); const before = fixtureState.calls;
    let release!: () => void;
    fixtureState.release = new Promise<void>(resolve => { release = resolve; });
    const entered = new Promise<void>(resolve => { fixtureState.entered = resolve; });
    const first = mutate(key, { wait: true });
    try {
      await entered;
      await error(await mutate(key, { wait: true }), 409, 'IDEMPOTENCY_IN_PROGRESS');
      await error(await mutate(key, { value: 99 }), 409, 'IDEMPOTENCY_KEY_REUSED');
    } finally { release(); fixtureState.entered = undefined; }
    expect((await first).status).toBe(202); expect(fixtureState.calls).toBe(before + 1);
  });
  it('k: failing handler removes placeholder; identical retry executes again', async () => {
    const key = randomUUID(); const before = fixtureState.calls;
    await error(await mutate(key, { fail: true }), 500, 'INTERNAL');
    expect((await db.query('select id from public.idempotency_requests where user_id=$1 and idempotency_key=$2', [accounts.admin.id, key])).rowCount).toBe(0);
    await error(await mutate(key, { fail: true }), 500, 'INTERNAL');
    expect(fixtureState.calls).toBe(before + 2);
    expect((await mutate(key, { value: 1 })).status).toBe(202);
  });
  it('l: expired record is replaced as a new request', async () => {
    const key = randomUUID(); await mutate(key, { value: 1 }); const before = fixtureState.calls;
    await db.query("update public.idempotency_requests set created_at=now()-interval '2 days', expires_at=now()-interval '1 day' where user_id=$1 and idempotency_key=$2", [accounts.admin.id, key]);
    expect((await mutate(key, { value: 2 })).status).toBe(202); expect(fixtureState.calls).toBe(before + 1);
  });
  it('m: version matches or yields conflict with current_version', async () => {
    expect(() => assertVersion({ version: 7 }, 7)).not.toThrow();
    expect((await get('/_t/version-check?version=7')).status).toBe(200);
    const body = await error(await get('/_t/version-check?version=6'), 409, 'VERSION_CONFLICT');
    expect(body.details).toEqual({ current_version: 7 });
  });
  it('n,p: internal error is sanitized and detailed log includes supplied request id', async () => {
    const id = randomUUID();
    const body = await error(await get('/_t/internal', 'admin', { 'X-Request-Id': id }), 500, 'INTERNAL');
    expect(body.message).toBe('An internal error occurred.'); expect(body.request_id).toBe(id);
    expect(logs.some(log => log.includes(id) && log.includes('private_table'))).toBe(true);
    const success = await get('/_t/any-auth', 'admin', { 'X-Request-Id': id });
    expect(success.headers.get('X-Request-Id')).toBe(id);
  });
  it('o: DTO and body parser errors use the same safe envelope; failed validation releases key', async () => {
    const key = randomUUID();
    await error(await mutate(key, { value: -1 }), 400, 'VALIDATION_FAILED');
    await error(await mutate(randomUUID(), { extra: 'unexpected' }), 400, 'VALIDATION_FAILED');
    expect((await mutate(key, { value: 1 })).status).toBe(202);
    await error(await fetch(`${base}/_t/mutate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }), 400, 'VALIDATION_FAILED');
  });
  it('q: public route works without JWT; unregistered route uses standard 404', async () => {
    expect((await get('/_t/public', null)).status).toBe(200);
    await error(await get('/_t/unknown'), 404, 'NOT_FOUND');
  });
  it('r: authenticated and anonymous clients cannot read idempotency storage', async () => {
    for (const role of ['authenticated', 'anon']) {
      await db.query('begin');
      try {
        await db.query(`set local role ${role}`);
        await expect(db.query('select * from public.idempotency_requests')).rejects.toMatchObject({ code: '42501' });
      } finally { await db.query('rollback'); }
    }
  });

  it('ES256: accepts an access token signed by real Supabase Auth', async () => {
    expect(decodeProtectedHeader(accounts.admin.token).alg).toBe('ES256');
    expect((await get('/_t/any-auth')).status).toBe(200);
  });

  it('alg allowlist: rejects none, HS384 and asymmetric-key confusion', async () => {
    const parts = accounts.admin.token.split('.');
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${parts[1]}.`;
    await error(await get('/_t/any-auth', null, { Authorization: `Bearer ${unsigned}` }), 401, 'UNAUTHENTICATED');
    const hs384 = await new SignJWT({ sub: accounts.admin.id, iss: issuer, aud: 'authenticated' })
      .setExpirationTime('1h').setProtectedHeader({ alg: 'HS384' }).sign(secret);
    await error(await get('/_t/any-auth', null, { Authorization: `Bearer ${hs384}` }), 401, 'UNAUTHENTICATED');
    const jwks = await (await fetch(`${issuer}/.well-known/jwks.json`)).text();
    const forged = await signed({}, new TextEncoder().encode(jwks));
    await error(await get('/_t/any-auth', null, { Authorization: `Bearer ${forged}` }), 401, 'UNAUTHENTICATED');
  });

  it('issuer: rejects wrong or missing iss for HS256 and altered ES256 payloads', async () => {
    for (const iss of ['https://wrong.example/auth/v1', undefined]) {
      await error(await get('/_t/any-auth', null, { Authorization: `Bearer ${await signed({ iss })}` }), 401, 'UNAUTHENTICATED');
      const parts = accounts.admin.token.split('.');
      const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as Record<string, unknown>;
      claims.iss = iss;
      parts[1] = Buffer.from(JSON.stringify(claims)).toString('base64url');
      await error(await get('/_t/any-auth', null, { Authorization: `Bearer ${parts.join('.')}` }), 401, 'UNAUTHENTICATED');
    }
  });

  it('HS256: no secret disables HS256 while ES256 still verifies', async () => {
    const verifier = new JwtVerifier(new ConfigService({ SUPABASE_URL: env.SUPABASE_URL, SUPABASE_JWT_SECRET: '' }));
    await expect(verifier.verify(await signed({}))).rejects.toThrow();
    await expect(verifier.verify(accounts.admin.token)).resolves.toMatchObject({ payload: { sub: accounts.admin.id } });
  });

  it('JWKS: rejects a kid absent from the trusted key set', async () => {
    const parts = accounts.admin.token.split('.');
    parts[0] = Buffer.from(JSON.stringify({ alg: 'ES256', kid: randomUUID() })).toString('base64url');
    await error(await get('/_t/any-auth', null, { Authorization: `Bearer ${parts.join('.')}` }), 401, 'UNAUTHENTICATED');
  });
});
