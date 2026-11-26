import request from 'supertest';
import { afterEach, it, expect, vi } from 'vitest';
import { createApp } from '../src/factory.ts';
import { createDatabase } from '../src/core/database.ts';

afterEach(() => vi.restoreAllMocks());

function setup() {
  // Real Prisma client, faked IO: no PostgreSQL is needed.
  const database = createDatabase('postgresql://test:test@localhost:5432/test');
  const findFirst = vi.spyOn(database.todo, 'findFirst').mockResolvedValue(null);
  return { app: createApp(database), findFirst };
}

it('reports ok after the database answers a query', async () => {
  const { app, findFirst } = setup();
  const response = await request(app).get('/api/health');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: 'ok' });
  expect(findFirst).toHaveBeenCalledOnce();
});

it('returns 500 without details when the database query fails', async () => {
  const { app, findFirst } = setup();
  findFirst.mockRejectedValue(new Error('password authentication failed for user "app"'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const response = await request(app).get('/api/health');
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ detail: 'Internal Server Error' });
});
