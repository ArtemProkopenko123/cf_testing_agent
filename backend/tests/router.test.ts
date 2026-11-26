import express from 'express';
import request from 'supertest';
import { it, expect, vi } from 'vitest';
import { createTodosRouter } from '../src/features/todos/router.ts';
import { todo } from './fixture.ts';

function setup() {
  const repository = { list: vi.fn().mockResolvedValue([todo]), create: vi.fn().mockResolvedValue(todo), get: vi.fn(), update: vi.fn(), delete: vi.fn() };
  const app = express();
  app.use(express.json());
  app.use('/api/todos', createTodosRouter(repository));
  return { app, repository };
}
it('lists tasks from the repository', async () => {
  const { app, repository } = setup();
  const response = await request(app).get('/api/todos');
  expect(response.status).toBe(200);
  expect(response.body).toEqual([todo]);
  expect(repository.list).toHaveBeenCalledOnce();
});
it('creates tasks with trimmed input and defaults', async () => {
  const { app, repository } = setup();
  const response = await request(app).post('/api/todos').send({ title: '  Plan the sprint  ', priority: 'high' });
  expect(response.status).toBe(201);
  expect(response.body).toEqual(todo);
  expect(repository.create).toHaveBeenCalledWith({ title: 'Plan the sprint', description: '', priority: 'high', due_date: null, completed: false });
});
it.each([{ title: '  ' }, { title: 'x'.repeat(121) }, { title: 'Task', priority: 'urgent' }, { title: 'Task', due_date: '2026-02-30' }])(
  'rejects invalid create input without calling the repository: %j', async (payload) => {
    const { app, repository } = setup();
    expect((await request(app).post('/api/todos').send(payload)).status).toBe(422);
    expect(repository.create).not.toHaveBeenCalled();
  },
);
it('returns the task whose id is in the path', async () => {
  const { app, repository } = setup();
  repository.get.mockResolvedValueOnce(todo);
  const response = await request(app).get('/api/todos/1');
  expect(response.status).toBe(200);
  expect(response.body).toEqual(todo);
  expect(repository.get).toHaveBeenCalledWith(1);
});
it('returns 404 with a detail message when the task does not exist', async () => {
  const { app } = setup();
  const response = await request(app).get('/api/todos/999');
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ detail: 'Task not found.' });
});
it.each(['abc', '1.5', '0', '-3'])('rejects the non-positive or non-integer id %s with 422 on every id route', async (id) => {
  const { app, repository } = setup();
  expect((await request(app).get(`/api/todos/${id}`)).status).toBe(422);
  expect((await request(app).patch(`/api/todos/${id}`).send({ priority: 'low' })).status).toBe(422);
  expect((await request(app).delete(`/api/todos/${id}`)).status).toBe(422);
  expect(repository.get).not.toHaveBeenCalled();
  expect(repository.update).not.toHaveBeenCalled();
  expect(repository.delete).not.toHaveBeenCalled();
});
it('updates only the fields that were sent', async () => {
  const { app, repository } = setup();
  repository.update.mockResolvedValueOnce({ ...todo, priority: 'low' });
  const response = await request(app).patch('/api/todos/1').send({ priority: 'low' });
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ ...todo, priority: 'low' });
  expect(repository.update).toHaveBeenCalledWith(1, { priority: 'low' });
});
it('rejects an empty update with 422 and the at-least-one-field message', async () => {
  const { app, repository } = setup();
  const response = await request(app).patch('/api/todos/1').send({});
  expect(response.status).toBe(422);
  expect(response.body.detail[0].message).toBe('Provide at least one field to update.');
  expect(repository.update).not.toHaveBeenCalled();
});
it('returns 404 when updating a task that does not exist', async () => {
  const { app, repository } = setup();
  repository.update.mockResolvedValueOnce(null);
  const response = await request(app).patch('/api/todos/999').send({ completed: true });
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ detail: 'Task not found.' });
});
it('deletes the task with 204 and no body', async () => {
  const { app, repository } = setup();
  repository.delete.mockResolvedValueOnce(true);
  const response = await request(app).delete('/api/todos/1');
  expect(response.status).toBe(204);
  expect(response.text).toBe('');
  expect(repository.delete).toHaveBeenCalledWith(1);
});
it('returns 404 when deleting a task that does not exist', async () => {
  const { app, repository } = setup();
  repository.delete.mockResolvedValueOnce(false);
  const response = await request(app).delete('/api/todos/999');
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ detail: 'Task not found.' });
});
it('accepts a title of exactly 120 characters', async () => {
  const { app, repository } = setup();
  const title = 'x'.repeat(120);
  const response = await request(app).post('/api/todos').send({ title });
  expect(response.status).toBe(201);
  expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ title }));
});
it('rejects a description longer than 2000 characters without calling the repository', async () => {
  const { app, repository } = setup();
  const response = await request(app).post('/api/todos').send({ title: 'Task', description: 'x'.repeat(2001) });
  expect(response.status).toBe(422);
  expect(repository.create).not.toHaveBeenCalled();
});
