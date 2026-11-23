import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { sql } from 'kysely';
import { createApi } from '../apps/api/src/app.js';
import { DATABASE, type Database } from '../libs/database/database.module.js';

describe('GET /api/v1/health (real PostgreSQL, DATABASE_URL from environment)', () => {
  let app: INestApplication | undefined;
  let baseUrl: string;

  beforeAll(async () => {
    app = await createApi();
    // Fail rather than skip or accept db:error when the test database is unavailable.
    await sql`select 1`.execute(app.get<Database>(DATABASE));
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  }, 15000);

  afterAll(async () => {
    await app?.close();
  });

  it('returns HTTP 200 and db:ok', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', db: 'ok' });
  });

  it('does not expose health without the global prefix', async () => {
    expect((await fetch(`${baseUrl}/health`)).status).toBe(404);
  });
});
