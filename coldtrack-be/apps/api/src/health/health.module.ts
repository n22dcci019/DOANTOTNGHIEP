import { Controller, Get, Inject, Module } from '@nestjs/common';
import { sql } from 'kysely';
import { Public } from '../../../../libs/api/auth.js';
import { DATABASE, DatabaseModule, type Database } from '../../../../libs/database/database.module.js';

@Controller('health')
class HealthController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Get()
  @Public()
  async health(): Promise<{ status: 'ok'; db: 'ok' | 'error' }> {
    try {
      await sql`select 1`.execute(this.db);
      return { status: 'ok', db: 'ok' };
    } catch {
      return { status: 'ok', db: 'error' };
    }
  }
}

@Module({ imports: [DatabaseModule], controllers: [HealthController] })
export class HealthModule {}
