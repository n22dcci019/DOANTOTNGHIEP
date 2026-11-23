import { describe, expect, it } from '@jest/globals';
import { validateEnvironment } from '../libs/config/environment.js';

describe('environment validation', () => {
  const DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

  it('reports missing DATABASE_URL clearly', () => {
    expect(() => validateEnvironment({})).toThrow('DATABASE_URL is required');
    expect(() => validateEnvironment({ DATABASE_URL: ' ' })).toThrow('DATABASE_URL is required');
  });

  it('defaults PORT to 3000', () => {
    expect(validateEnvironment({ DATABASE_URL }).PORT).toBe(3000);
  });

  it('accepts a configured port', () => {
    expect(validateEnvironment({ DATABASE_URL, PORT: '3100' }).PORT).toBe(3100);
  });

  it('rejects invalid URLs and invalid or Supabase ports', () => {
    expect(() => validateEnvironment({ DATABASE_URL: 'invalid' })).toThrow('PostgreSQL URL');
    expect(() => validateEnvironment({ DATABASE_URL: 'https://localhost' })).toThrow('PostgreSQL URL');
    for (const PORT of ['', 'abc', '0', '65536', '3000.5', '54321', '54322', '54323', '54324']) {
      expect(() => validateEnvironment({ DATABASE_URL, PORT })).toThrow('PORT');
    }
  });
});
