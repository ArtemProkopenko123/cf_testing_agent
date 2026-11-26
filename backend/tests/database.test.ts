import { afterEach, it, expect, vi } from 'vitest';
import { createDatabase, initialize } from '../src/core/database.ts';

afterEach(() => vi.restoreAllMocks());

function setup() {
  // Real Prisma client, faked IO: no PostgreSQL is needed.
  const database = createDatabase('postgresql://test:test@localhost:5432/test');
  const executeRaw = vi.spyOn(database, '$executeRaw').mockResolvedValue(0);
  return { database, executeRaw };
}

// The tagged template receives its static parts as a TemplateStringsArray.
function sentSql(executeRaw: { mock: { calls: unknown[][] } }) {
  return (executeRaw.mock.calls[0][0] as TemplateStringsArray).join(' ');
}

it('creates the todos table when it is missing', async () => {
  const { database, executeRaw } = setup();
  await initialize(database);
  expect(executeRaw).toHaveBeenCalledOnce();
  expect(sentSql(executeRaw)).toContain('CREATE TABLE IF NOT EXISTS todos');
});

it('declares the title length limit and the low, medium and high priorities', async () => {
  const { database, executeRaw } = setup();
  await initialize(database);
  const sql = sentSql(executeRaw);
  expect(sql).toContain('VARCHAR(120)');
  expect(sql).toContain('CHECK (length(title) >= 1)');
  expect(sql).toContain("CHECK (priority IN ('low', 'medium', 'high'))");
});

it('rejects when the schema statement fails', async () => {
  const { database, executeRaw } = setup();
  executeRaw.mockRejectedValue(new Error('permission denied for schema public'));
  await expect(initialize(database)).rejects.toThrow('permission denied for schema public');
});
