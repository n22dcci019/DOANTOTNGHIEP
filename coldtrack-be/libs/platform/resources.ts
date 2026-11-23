import { Logger, type OnApplicationShutdown } from '@nestjs/common';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { connect, type MqttClient } from 'mqtt';
import pg from 'pg';
import type { Environment, ServiceRole } from './environment.js';

export class Resources implements OnApplicationShutdown {
  // Domain tables/types will be generated after Supabase migrations exist.
  readonly db?: Kysely<Record<string, never>>;
  readonly mqtt?: MqttClient;
  private readonly logger = new Logger(Resources.name);

  constructor(role: ServiceRole, env: Environment) {
    const connectionString =
      role === 'api'
        ? env.DATABASE_URL
        : role === 'ingest'
          ? env.INGEST_DATABASE_URL
          : env.WORKER_DATABASE_URL;
    if (connectionString) {
      this.db = new Kysely({
        dialect: new PostgresDialect({
          pool: new pg.Pool({
            connectionString,
            max: 3,
            connectionTimeoutMillis: 3000,
            statement_timeout: 3000,
            idleTimeoutMillis: 10000,
          }).on('error', () =>
            this.logger.warn('Idle database connection error'),
          ),
        }),
      });
    }
    if (role !== 'api' && env.MQTT_URL) {
      const username =
        role === 'ingest' ? env.MQTT_INGEST_USERNAME : env.MQTT_WORKER_USERNAME;
      const password =
        role === 'ingest' ? env.MQTT_INGEST_PASSWORD : env.MQTT_WORKER_PASSWORD;
      if (!username || !password) return;
      this.mqtt = connect(env.MQTT_URL, {
        username,
        password,
        clientId: `coldtrack-${role}-${process.pid}`,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 5000,
        rejectUnauthorized: true,
      });
      this.mqtt.on('error', () =>
        this.logger.warn('MQTT connection error; check broker and credentials'),
      );
    }
  }

  async readiness(role: ServiceRole) {
    let database: 'not_configured' | 'up' | 'down' = 'not_configured';
    if (this.db) {
      try {
        await sql`select 1`.execute(this.db);
        database = 'up';
      } catch {
        database = 'down';
      }
    }
    const mqtt =
      role === 'api'
        ? 'not_required'
        : !this.mqtt
          ? 'not_configured'
          : this.mqtt.connected
            ? 'up'
            : 'down';
    return {
      ready: database === 'up' && (mqtt === 'up' || mqtt === 'not_required'),
      checks: { database, mqtt },
    };
  }

  async onApplicationShutdown() {
    await this.mqtt?.endAsync(true);
    await this.db?.destroy();
  }
}
