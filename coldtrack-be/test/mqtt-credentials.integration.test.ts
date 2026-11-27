import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createConnection } from 'node:net';
import { connect as connectTls } from 'node:tls';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parse } from 'dotenv';
import { connectAsync, type MqttClient, type Packet } from 'mqtt';
import pg from 'pg';

jest.setTimeout(60000);
const dir = 'infra/mosquitto/config';
const names = ['SIM-01', 'SIM-02', 'SIM-03', 'SIM-04', 'svc-ingest', 'svc-publisher'];
const secretFile = (name: string) => `secrets/${name.startsWith('svc-') ? 'services' : 'devices'}/${name}.env`;
const ca = readFileSync('infra/mosquitto/certs/ca.crt');
const clients: MqttClient[] = [];
const db = new pg.Client({ connectionString: process.env.DATABASE_URL ?? parse(readFileSync('../.env')).DATABASE_URL });
const password = (name: string) => {
  const env = parse(readFileSync(secretFile(name)));
  return env.DEVICE_PASSWORD ?? env.SERVICE_PASSWORD;
};
const marker = () => 'marker-' + randomUUID();
const publish = (client: MqttClient, topic: string, value = marker()) => client.publishAsync(topic, value, { qos: 1 });

async function login(username?: string, secret?: string) {
  const client = await connectAsync('mqtts://127.0.0.1:8883', { ca, rejectUnauthorized: true,
    protocolVersion: 5, username, password: secret, reconnectPeriod: 0, connectTimeout: 3000 });
  clients.push(client);
  return client;
}
const as = (name: string) => login(name, password(name));
async function waitForBroker() {
  for (let i = 0; ; i++) {
    try { return await as('SIM-01'); } catch (err) {
      if (i === 14) throw err;
      await delay(300);
    }
  }
}

function run(script: string, ...args: string[]) {
  // No shell and no secret arguments; keep child output out of Jest error reports.
  return execFileSync(process.execPath, ['--import', 'tsx', 'scripts/' + script + '.ts', ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
}

async function receiver(client: MqttClient, topic: string) {
  const received = new Set<string>();
  client.on('message', (name, value) => { if (name === topic) received.add(value.toString()); });
  let suback: number | undefined;
  const capture = (p: Packet) => { if (p.cmd === 'suback' && typeof p.granted[0] === 'number') suback = p.granted[0]; };
  client.on('packetreceive', capture);
  try {
    await client.subscribeAsync(topic, { qos: 0 });
  } catch (err) {
    if (suback === undefined || suback < 128) throw err;
  } finally {
    client.off('packetreceive', capture);
  }
  if (suback === undefined) throw new Error('No SUBACK from broker');
  return { received, suback };
}

async function delivered(client: MqttClient, topic: string, authorized: MqttClient, forbidden?: MqttClient) {
  const observer = await receiver(authorized, topic);
  expect(observer.suback).toBe(0);
  const blocked = forbidden && await receiver(forbidden, topic);
  const value = marker();
  await publish(client, topic, value);
  for (let i = 0; !observer.received.has(value) && i < 40; i++) await delay(50);
  expect(observer.received.has(value)).toBe(true);
  if (blocked) {
    await delay(3100);
    expect(blocked.received.has(value)).toBe(false);
    console.log(`SUBACK ${topic}: 0x${blocked.suback.toString(16).padStart(2, '0')}; marker withheld`);
  }
}

const deniedWrite = async (client: MqttClient, topic: string) =>
  expect(publish(client, topic)).rejects.toMatchObject({ code: 0x87 });
async function refused(promise: Promise<MqttClient>) {
  const result = await promise.then(() => 0, (error: { code?: number }) => error.code);
  expect([0x86, 0x87]).toContain(result);
}

describe('per-user MQTT credentials and ACL on the local TLS broker', () => {
  beforeAll(async () => { await db.connect(); await waitForBroker(); });
  afterEach(async () => { await Promise.all(clients.splice(0).map(c => c.endAsync(true))); });
  afterAll(async () => { await db.end(); });

  it('a: SIM-01 connects over verified TLS', async () => { expect((await as('SIM-01')).connected).toBe(true); });
  it('b: SIM-01 publishes its own telemetry at QoS 1', async () => {
    await publish(await as('SIM-01'), 'devices/SIM-01/telemetry');
  });
  it('c: SIM-01 receives its own command', async () => {
    await delivered(await as('svc-publisher'), 'devices/SIM-01/commands', await as('SIM-01'));
  });
  it('d: SIM-01 cannot publish SIM-02 telemetry or receive the SIM-02 command marker', async () => {
    const sim = await as('SIM-01');
    await deniedWrite(sim, 'devices/SIM-02/telemetry');
    await delivered(await as('svc-publisher'), 'devices/SIM-02/commands', await as('SIM-02'), sim);
  });
  it('e: SIM-01 cannot write commands or receive its own telemetry', async () => {
    const sim = await as('SIM-01');
    await deniedWrite(sim, 'devices/SIM-01/commands');
    await delivered(sim, 'devices/SIM-01/telemetry', await as('svc-ingest'), sim);
  });
  it('f: ingest cannot publish commands and publisher cannot publish telemetry', async () => {
    await deniedWrite(await as('svc-ingest'), 'devices/SIM-01/commands');
    await deniedWrite(await as('svc-publisher'), 'devices/SIM-01/telemetry');
  });
  it('g: authorized services receive telemetry and command-acks; SIM receives targeted sync-acks', async () => {
    const sim = await as('SIM-01'), ingest = await as('svc-ingest');
    await delivered(sim, 'devices/SIM-01/telemetry', ingest);
    await delivered(sim, 'devices/SIM-01/command-acks', await as('svc-publisher'));
    await delivered(ingest, 'devices/SIM-01/sync-acks', sim);
  });
  it('h: wrong password, password alone and anonymous CONNECT are rejected', async () => {
    await refused(login('SIM-01', randomUUID()));
    // MQTT.js refuses to encode password-only CONNECT. Exercise the broker over verified TLS.
    const socket = connectTls({ host: '127.0.0.1', port: 8883, ca, rejectUnauthorized: true });
    try {
      await once(socket, 'secureConnect');
      const secret = Buffer.from(randomUUID());
      // MQTT v5, clean start + password flag, keepalive 10, no properties, empty client ID.
      const variableHeader = Buffer.from([0, 4, 77, 81, 84, 84, 5, 0x42, 0, 10, 0]);
      const payload = Buffer.concat([Buffer.from([0, 0, 0, secret.length]), secret]);
      socket.setTimeout(5000, () => socket.destroy(new Error('Timed out waiting for CONNACK')));
      socket.write(Buffer.concat([Buffer.from([0x10, variableHeader.length + payload.length]), variableHeader, payload]));
      let reply = Buffer.alloc(0);
      for await (const chunk of socket) {
        reply = Buffer.concat([reply, chunk]);
        if (reply.length >= 4) break;
      }
      expect(reply[0]).toBe(0x20);
      expect([0x86, 0x87]).toContain(reply[3]);
    } finally { socket.destroy(); }
    await refused(login());
  });
  it('i: 1883 refuses TCP connections on host and inside primary broker', async () => {
    const socket = createConnection(1883, '127.0.0.1');
    try { await expect(once(socket, 'connect')).rejects.toMatchObject({ code: 'ECONNREFUSED' }); }
    finally { socket.destroy(); }
    const probes = execFileSync('docker', ['compose', 'exec', '-T', 'mosquitto', 'cat', '/proc/net/tcp', '/proc/net/tcp6'], { encoding: 'utf8' });
    expect(probes).not.toMatch(/\s[\dA-F]+:075B\s+\S+\s+0A\b/i);
  });
  it('j: revocation and restart end the live SIM-03 session and prevent reconnect', async () => {
    const sim = await as('SIM-03');
    const result = await db.query(`update public.device_credentials c set active=false, revoked_at=now()
      from public.devices d where c.device_id=d.id and d.device_code='SIM-03' and c.active returning c.id`);
    expect(result.rowCount).toBe(1);
    try {
      expect(run('sync-mosquitto')).toContain('cần restart mosquitto');
      expect(sim.connected).toBe(true);
      const closed = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Revoked session stayed open')), 20000);
        sim.once('close', () => { clearTimeout(timer); resolve(); });
      });
      run('sync-mosquitto', '--restart');
      await closed;
      await waitForBroker();
      await refused(as('SIM-03'));
    } finally {
      await db.query('update public.device_credentials set active=true, revoked_at=null where id=$1', [result.rows[0].id]);
      run('sync-mosquitto', '--restart');
      await waitForBroker();
    }
  });
  it('k: reprovision preserves four active IDs, both service hashes and original secret files', async () => {
    const state = async () => ({
      rows: (await db.query('select id, device_id, credential_hash from public.device_credentials where active order by id')).rows,
      files: [...names.map(secretFile), join(dir, 'passwd')].map(path => createHash('sha256').update(readFileSync(path)).digest('hex')),
      mtimes: names.map(n => statSync(secretFile(n)).mtimeMs),
    });
    const before = await state();
    expect(before.rows).toHaveLength(4);
    run('provision-device-credentials');
    run('provision-service-credentials');
    expect(JSON.stringify(await state()) === JSON.stringify(before)).toBe(true);
  });
  it('l: config and persistent DB rows contain none of the six MQTT passwords', async () => {
    const secrets = names.map(password);
    const clean = (s: string) => !secrets.some(p => s.includes(p));
    for (const file of readdirSync(dir)) expect(clean(readFileSync(join(dir, file), 'utf8'))).toBe(true);
    const tables = await db.query(`select format('%I.%I', schemaname, tablename) as relation from pg_tables
      where schemaname not in ('pg_catalog','information_schema') and schemaname not like 'pg_%'`);
    for (const { relation } of tables.rows) {
      const rows = await db.query(`select to_jsonb(t)::text as document from ${relation} t`);
      expect(rows.rows.every(row => clean(row.document))).toBe(true);
    }
    const clientRead = await db.query("select has_table_privilege('authenticated','public.device_credentials','SELECT') as allowed");
    expect(clientRead.rows[0].allowed).toBe(false);
  });
  it('m: Git ignores local credentials and generated broker files', () => {
    const paths = [...names.map(secretFile), dir + '/passwd', dir + '/acl'];
    const ignored = execFileSync('git', ['check-ignore', '--', ...paths], { encoding: 'utf8' });
    expect(ignored.trim().split(/\r?\n/).sort()).toEqual(paths.sort());
    expect(execFileSync('git', ['ls-files', '--', 'secrets/', dir + '/passwd', dir + '/acl'], { encoding: 'utf8' })).toBe('');
  });
  it('m2: publisher cannot publish to either service telemetry or its own commands', async () => {
    const client = await as('svc-publisher');
    await deniedWrite(client, 'devices/svc-publisher/telemetry');
    await deniedWrite(client, 'devices/svc-publisher/commands');
  });
  it('m3: ingest cannot publish SIM commands or its own sync-acks', async () => {
    const client = await as('svc-ingest');
    await deniedWrite(client, 'devices/SIM-01/commands');
    await deniedWrite(client, 'devices/svc-ingest/sync-acks');
  });
  it('m4: SIM-01 cannot write any topic under another SIM or either service', async () => {
    const client = await as('SIM-01');
    for (const user of names.filter(n => n !== 'SIM-01')) {
      for (const topic of ['telemetry', 'events', 'status', 'command-acks', 'commands', 'sync-acks']) {
        await deniedWrite(client, `devices/${user}/${topic}`);
      }
    }
  });
  it('ACL has no patterns, has exactly one user per active credential plus both services, and bounds all SIM reads', async () => {
    const acl = readFileSync(join(dir, 'acl'), 'utf8');
    expect(acl).not.toMatch(/^\s*pattern\b/im);
    const active = (await db.query(`select d.device_code from public.devices d join public.device_credentials c
      on c.device_id=d.id where c.active and c.revoked_at is null order by d.device_code`)).rows.map(r => r.device_code);
    expect(active).toEqual(names.slice(0, 4));
    const blocks = acl.trim().split(/\n\s*\n/).map(b => b.split('\n'));
    expect(blocks.map(b => b[0])).toEqual([...active, 'svc-ingest', 'svc-publisher'].map(n => 'user ' + n));
    for (const [name, ...rules] of blocks.slice(0, active.length)) {
      const code = name.slice(5);
      expect(rules).toEqual([
        ...['telemetry', 'events', 'status', 'command-acks'].map(t => `topic write devices/${code}/${t}`),
        ...['commands', 'sync-acks'].map(t => `topic read devices/${code}/${t}`),
      ]);
    }
  });
  it('n: step 0.2 smoke test passes against the isolated TLS broker', () => {
    const output = execFileSync('docker', ['compose', 'exec', '-T', 'mosquitto-test', 'sh', '/mosquitto/scripts/test-tls.sh'], { encoding: 'utf8' });
    expect(output.match(/^PASS:/gm)).toHaveLength(3);
  });
});
