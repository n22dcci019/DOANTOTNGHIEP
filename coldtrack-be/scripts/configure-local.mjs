import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
import pg from 'pg';

// Only local credential provisioning. Application schema migrations belong to Supabase CLI.
const root = process.cwd();
if (!existsSync(resolve(root, 'supabase/config.toml'))) {
  throw new Error('Run from coldtrack-be after supabase init');
}
const envFile = resolve(root, '.env');
const env = existsSync(envFile)
  ? parse(readFileSync(envFile))
  : parse(readFileSync('.env.example'));
if (
  env.NODE_ENV !== 'development' ||
  env.SUPABASE_URL !== 'http://127.0.0.1:54321'
) {
  throw new Error(
    'This command is restricted to the default local development stack',
  );
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `Local tool failed: ${command}. Check Docker/Supabase availability.`,
    );
  }
  return result.stdout;
}

const statusOutput =
  process.platform === 'win32'
    ? run(process.env.ComSpec ?? 'cmd.exe', [
        '/d',
        '/s',
        '/c',
        'node_modules\\.bin\\supabase.cmd status -o json',
      ])
    : run('./node_modules/.bin/supabase', ['status', '-o', 'json']);
const status = JSON.parse(statusOutput);
const dbUrl = status.DB_URL ?? status.db_url;
if (!dbUrl) throw new Error('Supabase status did not return DB_URL');
const databaseAddress = new URL(dbUrl);
if (
  !['127.0.0.1', 'localhost'].includes(databaseAddress.hostname) ||
  databaseAddress.port !== '54322'
) {
  throw new Error(
    'Refusing to provision credentials outside the default local database',
  );
}

const db = new pg.Client({ connectionString: dbUrl });
await db.connect();
try {
  for (const [role, key] of [
    ['coldtrack_api', 'DATABASE_URL'],
    ['coldtrack_ingest', 'INGEST_DATABASE_URL'],
    ['coldtrack_worker', 'WORKER_DATABASE_URL'],
  ]) {
    const existingUrl = env[key] ? new URL(env[key]) : undefined;
    if (
      existingUrl &&
      (!['127.0.0.1', 'localhost'].includes(existingUrl.hostname) ||
        existingUrl.port !== '54322' ||
        existingUrl.username !== role)
    ) {
      throw new Error(`Refusing to overwrite non-local ${key}`);
    }
    const password = existingUrl
      ? decodeURIComponent(existingUrl.password)
      : randomBytes(24).toString('base64url');
    const roleExists = await db.query(
      'select rolsuper, rolcreatedb, rolcreaterole, rolbypassrls from pg_roles where rolname = $1',
      [role],
    );
    if (roleExists.rowCount === 0)
      await db.query(`create role ${role} nologin`);
    if (
      roleExists.rows.some(
        (row) =>
          row.rolsuper ||
          row.rolcreatedb ||
          row.rolcreaterole ||
          row.rolbypassrls,
      )
    ) {
      throw new Error(`Refusing to configure privileged local role: ${role}`);
    }
    const quoted = await db.query('select quote_literal($1) as password', [
      password,
    ]);
    await db.query(
      `alter role ${role} with login password ${quoted.rows[0].password} noinherit`,
    );
    await db.query(`grant connect on database postgres to ${role}`);
    const url = new URL(dbUrl);
    url.username = role;
    url.password = password;
    env[key] = url.toString();
  }
} finally {
  await db.end();
}

env.SUPABASE_PUBLISHABLE_KEY =
  status.PUBLISHABLE_KEY ??
  status.publishable_key ??
  status.ANON_KEY ??
  status.anon_key ??
  '';
env.SUPABASE_SECRET_KEY =
  status.SECRET_KEY ??
  status.secret_key ??
  status.SERVICE_ROLE_KEY ??
  status.service_role_key ??
  '';
env.MQTT_INGEST_PASSWORD ||= randomBytes(24).toString('base64url');
env.MQTT_WORKER_PASSWORD ||= randomBytes(24).toString('base64url');
const deviceFile = resolve(root, 'infra/mosquitto/device.env');
const device = existsSync(deviceFile)
  ? parse(readFileSync(deviceFile))
  : {
      MQTT_USERNAME: 'TB-0001',
      MQTT_PASSWORD: randomBytes(24).toString('base64url'),
    };
const brokerConfig = resolve(root, 'infra/mosquitto/config');
const passwordPath = resolve(brokerConfig, 'passwords');
if (!existsSync(passwordPath)) writeFileSync(passwordPath, '', { mode: 0o600 });

// Password values are passed via child environment, never shell command literals or logs.
for (const [username, password] of [
  [env.MQTT_INGEST_USERNAME, env.MQTT_INGEST_PASSWORD],
  [env.MQTT_WORKER_USERNAME, env.MQTT_WORKER_PASSWORD],
  [device.MQTT_USERNAME, device.MQTT_PASSWORD],
]) {
  run(
    'docker',
    [
      'run',
      '--rm',
      '--mount',
      `type=bind,source=${brokerConfig},target=/mosquitto/config`,
      '--env',
      'MQTT_BOOTSTRAP_USER',
      '--env',
      'MQTT_BOOTSTRAP_PASSWORD',
      '--entrypoint',
      'sh',
      'eclipse-mosquitto:2',
      '-c',
      'mosquitto_passwd -b /mosquitto/config/passwords "$MQTT_BOOTSTRAP_USER" "$MQTT_BOOTSTRAP_PASSWORD"',
    ],
    {
      env: {
        ...process.env,
        MQTT_BOOTSTRAP_USER: username,
        MQTT_BOOTSTRAP_PASSWORD: password,
      },
    },
  );
}
const serialize = (values) =>
  Object.entries(values)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join('\n') + '\n';
writeFileSync(envFile, serialize(env), { mode: 0o600 });
writeFileSync(deviceFile, serialize(device), { mode: 0o600 });
console.log(
  'Local .env, three restricted DB logins, and Mosquitto password hashes configured. No secret values printed.',
);
console.log(
  'No domain grants or business schema applied. Re-run after local DB reset if needed.',
);
