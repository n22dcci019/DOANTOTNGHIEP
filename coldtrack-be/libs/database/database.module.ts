import { Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { DB } from './schema.js';

export const DATABASE = Symbol('DATABASE');
export type Database = Kysely<DB>;

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async onApplicationShutdown() {
    await this.db.destroy();
  }
}

@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Database => {
        const pool = new pg.Pool({
          connectionString: config.getOrThrow<string>('DATABASE_URL'),
          connectionTimeoutMillis: 2000,
          query_timeout: 2000,
          statement_timeout: 2000,
        });
        // Idle connections can emit errors when PostgreSQL stops.
        pool.on('error', () => undefined);
        return new Kysely({ dialect: new PostgresDialect({ pool }) });
      },
    },
    DatabaseLifecycle,
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
