import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import pg from 'pg';
import { hashMosquittoCredential, matchesMosquittoHash } from '../libs/credentials/mosquitto-hash.js';

const root = fileURLToPath(new URL('../', import.meta.url));
export const services = ['svc-ingest', 'svc-publisher'] as const;
const config = join(root, 'infra/mosquitto/config');
export function assertSim(code: string) {
  if (!['SIM-01', 'SIM-02', 'SIM-03', 'SIM-04'].includes(code)) throw new Error('Unexpected simulated device username');
}

export function secretPath(user: string) {
  if ((services as readonly string[]).includes(user)) return join(root, 'secrets/services', user + '.env');
  assertSim(user);
  return join(root, 'secrets/devices', user + '.env');
}

export function secureDirectory(folder: string) {
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  if (process.platform === 'win32') {
    const identity = execFileSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8' });
    const sid = identity.match(/S-1-[0-9-]+/i)?.[0];
    if (!sid) throw new Error('Cannot determine Windows user for secret file ACL');
    execFileSync('icacls.exe', [folder, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { stdio: 'ignore' });
  }
}

export function atomicWrite(path: string, contents: string, mode: number) {
  const temp = join(dirname(path), '.' + randomUUID() + '.tmp');
  try {
    writeFileSync(temp, contents, { flag: 'wx', mode });
    renameSync(temp, path);
  } finally {
    rmSync(temp, { force: true });
  }
}

export function createSecret(user: string, path: string) {
  const password = randomBytes(32).toString('base64url');
  const contents = user.startsWith('svc-')
    ? `SERVICE_USER=${user}\nSERVICE_PASSWORD=${password}\n`
    : `DEVICE_CODE=${user}\nDEVICE_PASSWORD=${password}\n`;
  atomicWrite(path, contents, 0o600);
  return password;
}

export function readSecret(user: string, path = secretPath(user)): string {
  const env = parse(readFileSync(path));
  const service = user.startsWith('svc-');
  const password = service ? env.SERVICE_PASSWORD : env.DEVICE_PASSWORD;
  if ((service ? env.SERVICE_USER : env.DEVICE_CODE) !== user || !/^[\w-]{43,}$/.test(password ?? '')) {
    throw new Error(`Invalid local secret file for ${user}`);
  }
  return password;
}

export async function runLocal(flag: string, work: (db: pg.Client, enabled: boolean) => Promise<void>) {
  let client: pg.Client | undefined;
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length && args[0] !== flag)) throw new Error(`Only ${flag} is supported`);
    const rootEnv = join(root, '../.env');
    const url = new URL(process.env.DATABASE_URL ?? (existsSync(rootEnv) ? parse(readFileSync(rootEnv)).DATABASE_URL : ''));
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        || url.port !== '54322' || url.pathname !== '/postgres') throw new Error('Expected the local DoAnTotNghiep database');
    client = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 5000 });
    await client.connect();
    // All three commands share one session lock, including file replacement and optional restart.
    await client.query("select pg_advisory_lock(hashtext('coldtrack.mqtt.provision'))");
    await work(client, args.length === 1);
  } catch (error) {
    // Database and process errors can include inputs. Only print our own validation messages.
    console.error(error instanceof Error && error.constructor === Error && !('code' in error) && !('cmd' in error)
      ? error.message : `MQTT provisioning failed (${(error as NodeJS.ErrnoException).code ?? 'unknown'}; ${(error as NodeJS.ErrnoException).syscall ?? 'database or subprocess'}). Check DB and local file permissions.`);
    process.exitCode = 1;
  } finally {
    await client?.end();
  }
}

type Entry = { username: string; hash: string };
const rule = (access: string, code: string, topic: string) => `topic ${access} devices/${code}/${topic}`;

export async function syncBroker(db: pg.Client, bootstrap = false) {
  const devices = (await db.query<Entry>(`select d.device_code as username, c.credential_hash as hash
    from public.device_credentials c join public.devices d on d.id = c.device_id
    where c.active and c.revoked_at is null order by d.device_code`)).rows;
  const codes = devices.map(row => row.username);
  codes.forEach(assertSim);
  const passwdPath = join(config, 'passwd');
  const previous = existsSync(passwdPath) ? readFileSync(passwdPath, 'utf8') : '';
  const oldHashes = new Map(previous.trim().split(/\r?\n/).map(line => line.split(':') as [string, string]));
  const entries = [...devices];
  for (const name of services) {
    if (bootstrap && !oldHashes.has(name) && !existsSync(secretPath(name))) continue;
    const password = readSecret(name);
    const old = oldHashes.get(name);
    const hash = old && await matchesMosquittoHash(password, old) ? old : await hashMosquittoCredential(password);
    entries.push({ username: name, hash });
  }
  const blocks = codes.map(code => [`user ${code}`,
    ...['telemetry', 'events', 'status', 'command-acks'].map(topic => rule('write', code, topic)),
    ...['commands', 'sync-acks'].map(topic => rule('read', code, topic))]);
  blocks.push(['user svc-ingest', ...['telemetry', 'events', 'status', 'command-acks'].map(t => rule('read', '+', t)),
    ...codes.map(code => rule('write', code, 'sync-acks'))]);
  blocks.push(['user svc-publisher', rule('read', '+', 'command-acks'), ...codes.map(code => rule('write', code, 'commands'))]);
  const acl = blocks.map(block => block.join('\n')).join('\n\n') + '\n';
  const names = [...acl.matchAll(/^user (.*)$/gm)].map(match => match[1]);
  const allowed = new Set([...codes, ...services]);
  if (/^\s*pattern\b/im.test(acl) || names.length !== allowed.size || new Set(names).size !== allowed.size
      || names.some(n => !allowed.has(n)) || entries.some(e => !allowed.has(e.username) || !/^\$7\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/.test(e.hash))) {
    throw new Error('Invalid generated broker ACL or password file');
  }
  const passwd = entries.map(e => `${e.username}:${e.hash}\n`).join('');
  // The broker reads these files on controlled restart. Install the restrictive ACL first.
  atomicWrite(join(config, 'acl'), acl, 0o644);
  atomicWrite(passwdPath, passwd, 0o640);
  console.log(`Synced ${devices.length} device credentials. Cấu hình trên đĩa: cần restart mosquitto.`);
}
