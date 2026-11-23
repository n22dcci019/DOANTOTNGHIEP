import 'dotenv/config';
import { z } from 'zod';

export type ServiceRole = 'api' | 'ingest' | 'worker';

const optionalValue = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
);

const port = z.coerce.number().int().min(1).max(65535);
const positiveInt = z.coerce.number().int().positive();

const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  HOST: z.string().default('127.0.0.1'),
  API_PORT: port.default(3000),
  INGEST_PORT: port.default(3001),
  WORKER_PORT: port.default(3002),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173'),
  DATABASE_URL: optionalValue,
  INGEST_DATABASE_URL: optionalValue,
  WORKER_DATABASE_URL: optionalValue,
  MQTT_URL: optionalValue,
  MQTT_INGEST_USERNAME: optionalValue,
  MQTT_INGEST_PASSWORD: optionalValue,
  MQTT_WORKER_USERNAME: optionalValue,
  MQTT_WORKER_PASSWORD: optionalValue,
  TELEMETRY_INTERVAL_SECONDS: positiveInt.default(15),
  SIMULATOR_INTERVAL_SECONDS: positiveInt.default(30),
  SIMULATOR_VEHICLES: z.coerce.number().int().min(5).max(7).default(5),
  STALE_AFTER_SECONDS: positiveInt.default(60),
  SIGNAL_LOST_AFTER_SECONDS: positiveInt.default(300),
  TELEMETRY_RETENTION_DAYS: positiveInt.default(7),
});

export function loadEnvironment() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    // Report names only, never environment values containing secrets.
    throw new Error(
      `Invalid environment: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    );
  }
  const env = result.data;
  if (env.STALE_AFTER_SECONDS >= env.SIGNAL_LOST_AFTER_SECONDS) {
    throw new Error(
      'STALE_AFTER_SECONDS must be less than SIGNAL_LOST_AFTER_SECONDS',
    );
  }
  if (env.MQTT_URL) {
    const broker = new URL(env.MQTT_URL);
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(broker.hostname);
    if (broker.username || broker.password) {
      throw new Error(
        'Use separate MQTT credential variables, not credentials in MQTT_URL',
      );
    }
    if (
      broker.protocol !== 'mqtts:' &&
      !(broker.protocol === 'mqtt:' && local && env.NODE_ENV !== 'production')
    ) {
      throw new Error('MQTT requires TLS except loopback development');
    }
  }
  return env;
}

export type Environment = ReturnType<typeof loadEnvironment>;
