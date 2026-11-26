import { act, renderHook } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '../../../app/AppProviders'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import type { Todo } from '../types'
import { useDeleteTodoMutation } from './useDeleteTodoMutation'

const first: Todo = { ...todoFixture, id: 7, title: 'Prepare a demo' }
const second: Todo = { ...todoFixture, id: 8, title: 'Book a room' }
const third: Todo = { ...todoFixture, id: 9, title: 'Send invoices' }

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

describe('useDeleteTodoMutation', () => {
  it('sends DELETE to /api/todos/:id', async () => {
    const { wrapper } = setup()
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })

    await act(() => result.current.mutateAsync(7))

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/todos/7')
    expect(init.method).toBe('DELETE')
  })

  it('removes only the deleted task from the cached list', async () => {
    const { wrapper } = setup()
    client.setQueryData(todoKeys.list, [first, second, third])
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })

    await act(() => result.current.mutateAsync(8))

    expect(client.getQueryData(todoKeys.list)).toEqual([first, third])
  })

  it('rejects with the server detail and leaves the cache unchanged on failure', async () => {
    const { wrapper } = setup()
    client.setQueryData(todoKeys.list, [first, second])
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Task not found.' }), { status: 404 }),
    )
    const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })

    await expect(
      act(() => result.current.mutateAsync(8)),
    ).rejects.toThrow('Task not found.')
    expect(client.getQueryData(todoKeys.list)).toEqual([first, second])
  })
})
