import { act, renderHook } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '../../../app/AppProviders'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import type { Todo, TodoInput } from '../types'
import { useCreateTodoMutation } from './useCreateTodoMutation'

const input: TodoInput = {
  title: 'Write report',
  description: 'Q3 numbers',
  priority: 'high',
  due_date: '2026-12-01',
  completed: false,
}

const saved: Todo = {
  ...todoFixture,
  id: 9,
  title: 'Write report',
  description: 'Q3 numbers',
  priority: 'high',
  due_date: '2026-12-01',
  completed: false,
  created_at: '2026-11-20T10:00:00Z',
  updated_at: '2026-11-20T10:00:00Z',
}

const older: Todo = { ...todoFixture, id: 7, title: 'Prepare a demo' }

let fetchMock: ReturnType<typeof vi.fn>
let client: QueryClient

function setup() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(AppProviders, { client, children })
  return { wrapper }
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useCreateTodoMutation', () => {
  it('POSTs the new task to /api/todos and resolves with the saved task', async () => {
    const { wrapper } = setup()
    fetchMock.mockResolvedValue(new Response(JSON.stringify(saved), { status: 201 }))
    const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })

    const response = await act(() => result.current.mutateAsync(input))

    expect(response).toEqual(saved)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/todos')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual(input)
  })

  it('puts the saved task first in the cached list', async () => {
    const { wrapper } = setup()
    client.setQueryData(todoKeys.list, [older])
    fetchMock.mockResolvedValue(new Response(JSON.stringify(saved), { status: 201 }))
    const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })

    await act(() => result.current.mutateAsync(input))

    expect(client.getQueryData(todoKeys.list)).toEqual([saved, older])
  })

  it('removes an older cached copy with the same id', async () => {
    const { wrapper } = setup()
    const stale = { ...saved, title: 'Old copy' }
    client.setQueryData(todoKeys.list, [older, stale])
    fetchMock.mockResolvedValue(new Response(JSON.stringify(saved), { status: 201 }))
    const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })

    await act(() => result.current.mutateAsync(input))

    expect(client.getQueryData(todoKeys.list)).toEqual([saved, older])
  })

  it('creates a one-task list when nothing is cached yet', async () => {
    const { wrapper } = setup()
    fetchMock.mockResolvedValue(new Response(JSON.stringify(saved), { status: 201 }))
    const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })

    await act(() => result.current.mutateAsync(input))

    expect(client.getQueryData(todoKeys.list)).toEqual([saved])
  })

  it('rejects with the server detail and leaves the cache unchanged on failure', async () => {
    const { wrapper } = setup()
    client.setQueryData(todoKeys.list, [older])
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Database unavailable.' }), { status: 500 }),
    )
    const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })

    await expect(
      act(() => result.current.mutateAsync(input)),
    ).rejects.toThrow('Database unavailable.')
    expect(client.getQueryData(todoKeys.list)).toEqual([older])
  })
})
