import request from 'supertest';
import { afterEach, it, expect, vi } from 'vitest';
import { createApp } from '../src/factory.ts';
import { createDatabase } from '../src/core/database.ts';
import { record, todo } from './fixture.ts';

afterEach(() => vi.restoreAllMocks());

function setup() {
  // Real Prisma client, faked IO: no PostgreSQL is needed.
  const database = createDatabase('postgresql://test:test@localhost:5432/test');
  const findMany = vi.spyOn(database.todo, 'findMany').mockResolvedValue([record]);
  const create = vi.spyOn(database.todo, 'create').mockResolvedValue(record);
  return { app: createApp(database), findMany, create };
}

it('serves the OpenAPI document', async () => {
  const { app } = setup();
  const response = await request(app).get('/openapi.json');
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ openapi: '3.0.3', info: { title: 'Taskly App Node API', version: '1.0.0' } });
  expect(response.body.paths).toHaveProperty('/api/todos');
});

it('mounts the todos router on the database-backed repository', async () => {
  const { app, findMany } = setup();
  const response = await request(app).get('/api/todos');
  expect(response.status).toBe(200);
  expect(response.body).toEqual([todo]);
  expect(findMany).toHaveBeenCalledOnce();
});

it('returns 404 JSON for unknown routes', async () => {
  const { app } = setup();
  const response = await request(app).get('/api/unknown');
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ detail: 'Not Found' });
});

it('rejects malformed JSON with 422 without creating a task', async () => {
  const { app, create } = setup();
  const response = await request(app).post('/api/todos').set('Content-Type', 'application/json').send('{"title":');
  expect(response.status).toBe(422);
  expect(response.body).toEqual({ detail: 'Invalid JSON.' });
  expect(create).not.toHaveBeenCalled();
});

it('rejects request bodies over the size limit with 413', async () => {
  const { app, create } = setup();
  const response = await request(app).post('/api/todos').send({ title: 'x'.repeat(110 * 1024) });
  expect(response.status).toBe(413);
  expect(response.body).toEqual({ detail: 'Request body too large.' });
  expect(create).not.toHaveBeenCalled();
});

it('returns 500 without details when a route fails', async () => {
  const { app, findMany } = setup();
  findMany.mockRejectedValue(new Error('connection terminated unexpectedly'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const response = await request(app).get('/api/todos');
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ detail: 'Internal Server Error' });
});

it('does not advertise Express in the X-Powered-By header', async () => {
  const { app } = setup();
  const response = await request(app).get('/api/todos');
  expect(response.headers['x-powered-by']).toBeUndefined();
});
