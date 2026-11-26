import { act, renderHook } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '../../../app/AppProviders'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import type { Todo } from '../types'
import { useClearCompletedMutation } from './useClearCompletedMutation'

const open: Todo = { ...todoFixture, id: 7, completed: false }
const done: Todo = { ...todoFixture, id: 8, completed: true }
const done2: Todo = { ...todoFixture, id: 9, completed: true }

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

describe('useClearCompletedMutation', () => {
  it('sends DELETE to /api/todos?completed=true and resolves with the count', async () => {
    const { wrapper } = setup()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ count: 2 }), { status: 200 }),
    )
    const { result } = renderHook(() => useClearCompletedMutation(), {
      wrapper,
    })

    let data: { count: number } | undefined
    await act(async () => {
      data = await result.current.mutateAsync()
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/todos?completed=true')
    expect(init.method).toBe('DELETE')
    expect(data).toEqual({ count: 2 })
  })

  it('drops only completed tasks from the cached list', async () => {
    const { wrapper } = setup()
    client.setQueryData(todoKeys.list, [open, done, done2])
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ count: 2 }), { status: 200 }),
    )
    const { result } = renderHook(() => useClearCompletedMutation(), {
      wrapper,
    })

    await act(() => result.current.mutateAsync())

    expect(client.getQueryData(todoKeys.list)).toEqual([open])
  })

  it('rejects with the server detail and keeps the cache on failure', async () => {
    const { wrapper } = setup()
    client.setQueryData(todoKeys.list, [open, done])
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Something broke.' }), {
        status: 500,
      }),
    )
    const { result } = renderHook(() => useClearCompletedMutation(), {
      wrapper,
    })

    await expect(act(() => result.current.mutateAsync())).rejects.toThrow(
      'Something broke.',
    )
    expect(client.getQueryData(todoKeys.list)).toEqual([open, done])
  })
})
