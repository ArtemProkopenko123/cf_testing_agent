import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '../../../app/AppProviders'
import { todoFixture } from '../../../test/todoFixture'
import { useTodosQuery } from './useTodosQuery'

let fetchMock: ReturnType<typeof vi.fn>

function setup() {
  const client = new QueryClient({
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

describe('useTodosQuery', () => {
  it('loads the task list from GET /api/todos', async () => {
    const { wrapper } = setup()
    fetchMock.mockResolvedValue(new Response(JSON.stringify([todoFixture]), { status: 200 }))
    const { result } = renderHook(() => useTodosQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([todoFixture])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/todos')
    expect(init.method).toBeUndefined()
  })

  it('passes an abort signal to the request', async () => {
    const { wrapper } = setup()
    fetchMock.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))
    const { result } = renderHook(() => useTodosQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const [, init] = fetchMock.mock.calls[0]
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('exposes the server detail as the error message when loading fails', async () => {
    const { wrapper } = setup()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Database unavailable.' }), { status: 500 }),
    )
    const { result } = renderHook(() => useTodosQuery(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error?.message).toBe('Database unavailable.')
  })
})
