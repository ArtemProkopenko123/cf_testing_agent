import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, useMutation } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '../../../app/AppProviders'
import { todoFixture } from '../../../test/todoFixture'
import { useCreateTodoMutation } from './useCreateTodoMutation'
import { useTodosBusy } from './useTodosBusy'

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

describe('useTodosBusy', () => {
  it('is false when no mutation is running', () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useTodosBusy(), { wrapper })

    expect(result.current).toBe(false)
  })

  it('is true while a task mutation is pending and false once it settles', async () => {
    const { wrapper } = setup()
    let release!: (response: Response) => void
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        release = resolve
      }),
    )
    const { result } = renderHook(
      () => ({ busy: useTodosBusy(), create: useCreateTodoMutation() }),
      { wrapper },
    )

    act(() => {
      result.current.create.mutate({
        title: 'Write report',
        description: '',
        priority: 'low',
        due_date: null,
        completed: false,
      })
    })
    await waitFor(() => expect(result.current.busy).toBe(true))

    await act(async () => release(new Response(JSON.stringify(todoFixture), { status: 201 })))

    await waitFor(() => expect(result.current.busy).toBe(false))
  })

  it('ignores mutations that are not under the todos key', async () => {
    const { wrapper } = setup()
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const { result } = renderHook(
      () => ({
        busy: useTodosBusy(),
        other: useMutation({
          mutationKey: ['reports', 'export'],
          mutationFn: () => pending,
        }),
      }),
      { wrapper },
    )

    act(() => {
      result.current.other.mutate()
    })
    await waitFor(() => expect(result.current.other.isPending).toBe(true))

    expect(result.current.busy).toBe(false)
    release()
  })
})
