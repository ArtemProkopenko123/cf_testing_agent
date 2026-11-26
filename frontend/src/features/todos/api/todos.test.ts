import { beforeEach, expect, it, vi } from 'vitest'
import { request } from '../../../lib/http'
import { todoFixture } from '../../../test/todoFixture'
import { todosApi } from './todos'

vi.mock('../../../lib/http', () => ({ request: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

it('passes the abort signal when fetching tasks', async () => {
  const signal = new AbortController().signal
  vi.mocked(request).mockResolvedValue([todoFixture])
  await expect(todosApi.list(signal)).resolves.toEqual([todoFixture])
  expect(request).toHaveBeenCalledWith('/todos', { signal })
})

it('sends only writable task fields on creation', async () => {
  vi.mocked(request).mockResolvedValue(todoFixture)
  await expect(todosApi.create(todoFixture)).resolves.toEqual(todoFixture)
  expect(request).toHaveBeenCalledWith('/todos', {
    method: 'POST',
    body: JSON.stringify({
      title: todoFixture.title,
      description: '',
      priority: 'medium',
      due_date: null,
      completed: false,
    }),
  })
})

it('sends only the changed fields when updating a task', async () => {
  vi.mocked(request).mockResolvedValue({ ...todoFixture, completed: true })
  await todosApi.update(7, { completed: true })
  expect(request).toHaveBeenCalledWith('/todos/7', {
    method: 'PATCH',
    body: '{"completed":true}',
  })
})

it('sends a cleared due date as null when updating a task', async () => {
  vi.mocked(request).mockResolvedValue(todoFixture)
  await todosApi.update(7, { due_date: null })
  expect(request).toHaveBeenCalledWith('/todos/7', {
    method: 'PATCH',
    body: '{"due_date":null}',
  })
})

it('deletes a task with DELETE on its own URL', async () => {
  vi.mocked(request).mockResolvedValue(undefined)
  await todosApi.remove(7)
  expect(request).toHaveBeenCalledWith('/todos/7', { method: 'DELETE' })
})
