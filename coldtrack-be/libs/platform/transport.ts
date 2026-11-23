import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { connect } from 'mqtt';
import pg from 'pg';
import { validateEnvironment } from '../config/environment.js';

// Infrastructure only: no telemetry subscriptions, ACKs or command publication.
export async function startTransport(role: 'ingest' | 'publisher') {
  const env = validateEnvironment(process.env);
  const { MQTT_URL, MQTT_CA_FILE, MQTT_USERNAME, MQTT_PASSWORD_FILE } = process.env;
  if (!MQTT_URL || !MQTT_CA_FILE || !MQTT_USERNAME || !MQTT_PASSWORD_FILE) {
    throw new Error('MQTT_URL, MQTT_CA_FILE, MQTT_USERNAME and MQTT_PASSWORD_FILE are required');
  }
  if (new URL(MQTT_URL).protocol !== 'mqtts:') throw new Error('MQTT_URL requires TLS');
  const db = new Kysely<Record<string, never>>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        connectionString: env.DATABASE_URL,
        connectionTimeoutMillis: 2000,
        query_timeout: 2000,
      }).on('error', () => console.warn(`${role}: DB disconnected`)),
    }),
  });
  const mqtt = connect(MQTT_URL, {
    ca: readFileSync(MQTT_CA_FILE),
    username: MQTT_USERNAME,
    password: readFileSync(MQTT_PASSWORD_FILE, 'utf8').trim(),
    rejectUnauthorized: true,
    reconnectPeriod: 5000,
    connectTimeout: 5000,
    clientId: `coldtrack-${role}`,
  });
  mqtt.on('connect', () => console.log(`${role}: MQTT connected`));
  mqtt.on('error', () => console.warn(`${role}: MQTT connection error; retrying`));
  let wasConnected = false;
  let checking = false;
  const checkDatabase = async () => {
    if (checking) return;
    checking = true;
    try {
      await sql`select 1`.execute(db);
      if (!wasConnected) console.log(`${role}: DB connected`);
      wasConnected = true;
    } catch {
      console.warn(`${role}: DB connection error; retrying`);
      wasConnected = false;
    } finally {
      checking = false;
    }
  };
  await checkDatabase();
  const interval = setInterval(() => void checkDatabase(), 5000);
  const shutdown = async () => {
    clearInterval(interval);
    await mqtt.endAsync(true);
    await db.destroy();
  };
  process.once('SIGTERM', () => void shutdown());
  process.once('SIGINT', () => void shutdown());
}
