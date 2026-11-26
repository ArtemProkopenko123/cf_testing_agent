import { afterEach, it, expect, vi } from 'vitest';
import { resolveDatabaseUrl } from '../src/core/config.ts';

const parts = {
  POSTGRES_USER: 'alice',
  POSTGRES_PASSWORD: 's3cret',
  POSTGRES_HOST: 'db.internal',
  DB_PORT: '6543',
  POSTGRES_DB: 'taskly',
};

function stubDatabaseEnv(overrides: Partial<Record<keyof typeof parts | 'DATABASE_URL', string>> = {}) {
  const values = { DATABASE_URL: '', ...parts, ...overrides };
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
}

afterEach(() => vi.unstubAllEnvs());

it('returns an explicit override unchanged', () => {
  expect(resolveDatabaseUrl('postgresql://u:p@db.example:5432/app')).toBe('postgresql://u:p@db.example:5432/app');
});
it('rewrites the postgresql+psycopg scheme to postgresql', () => {
  expect(resolveDatabaseUrl('postgresql+psycopg://u:p@h:5432/d')).toBe('postgresql://u:p@h:5432/d');
});
it('prefers DATABASE_URL over the POSTGRES_* parts', () => {
  stubDatabaseEnv({ DATABASE_URL: 'postgresql://bob:pw@other:5433/shared' });
  expect(resolveDatabaseUrl()).toBe('postgresql://bob:pw@other:5433/shared');
});
it('builds the URL from the POSTGRES_* parts when DATABASE_URL is unset', () => {
  stubDatabaseEnv();
  expect(resolveDatabaseUrl()).toBe('postgresql://alice:s3cret@db.internal:6543/taskly');
});
it('percent-encodes an @ in the password so the host is still parsed correctly', () => {
  stubDatabaseEnv({ POSTGRES_PASSWORD: 'p@ss' });
  expect(resolveDatabaseUrl()).toBe('postgresql://alice:p%40ss@db.internal:6543/taskly');
});
it.each(Object.keys(parts))('throws naming the missing %s variable', (name) => {
  stubDatabaseEnv({ [name]: '' });
  expect(() => resolveDatabaseUrl()).toThrow(`Missing environment variable: ${name}`);
});
