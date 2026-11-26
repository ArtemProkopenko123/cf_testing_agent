import { act, renderHook } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '../../../app/AppProviders'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import type { Todo } from '../types'
import { useUpdateTodoMutation } from './useUpdateTodoMutation'

const first: Todo = { ...todoFixture, id: 7, title: 'Prepare a demo' }
const second: Todo = { ...todoFixture, id: 8, title: 'Book a room' }
const third: Todo = { ...todoFixture, id: 9, title: 'Send invoices' }

const renamed: Todo = { ...second, title: 'Book a meeting room', completed: true }

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

describe('useUpdateTodoMutation', () => {
  it('PATCHes the changed fields to /api/todos/:id', async () => {
    const { wrapper } = setup()
    fetchMock.mockResolvedValue(new Response(JSON.stringify(renamed), { status: 200 }))
    const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })

    await act(() =>
      result.current.mutateAsync({
        id: 8,
        input: { title: 'Book a meeting room', completed: true },
      }),
    )

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/todos/8')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({
      title: 'Book a meeting room',
      completed: true,
    })
  })

  it('replaces only the matching task and keeps the list order', async () => {
    const { wrapper } = setup()
    client.setQueryData(todoKeys.list, [first, second, third])
    fetchMock.mockResolvedValue(new Response(JSON.stringify(renamed), { status: 200 }))
    const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })

    await act(() =>
      result.current.mutateAsync({
        id: 8,
        input: { title: 'Book a meeting room', completed: true },
      }),
    )

    expect(client.getQueryData(todoKeys.list)).toEqual([first, renamed, third])
  })

  it('rejects with the server detail and leaves the cache unchanged on failure', async () => {
    const { wrapper } = setup()
    client.setQueryData(todoKeys.list, [first, second])
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Task not found.' }), { status: 404 }),
    )
    const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })

    await expect(
      act(() => result.current.mutateAsync({ id: 8, input: { completed: true } })),
    ).rejects.toThrow('Task not found.')
    expect(client.getQueryData(todoKeys.list)).toEqual([first, second])
  })
})
