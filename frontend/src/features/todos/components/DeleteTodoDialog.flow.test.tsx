import { QueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { AppProviders } from '../../../app/AppProviders'
import { todoFixture } from '../../../test/todoFixture'
import { DeleteTodoDialog } from './DeleteTodoDialog'

// Real drawer, button and mutation hook; only the network is faked. The mocks in
// DeleteTodoDialog.test.tsx replace the hook and design system, which hides the
// request and the server error handling.

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
})

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders client={client}>{children}</AppProviders>
  )
  return { wrapper, user: userEvent.setup() }
}

const todo = { ...todoFixture, id: 7 }

it('sends DELETE for the task id and reports success', async () => {
  const { wrapper, user } = setup()
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
  const onDeleted = vi.fn()
  render(
    <DeleteTodoDialog
      todo={todo}
      busy={false}
      onClose={vi.fn()}
      onDeleted={onDeleted}
    />,
    { wrapper },
  )
  await user.click(screen.getByRole('button', { name: 'Delete task' }))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url, init] = fetchMock.mock.calls[0]
  expect(String(url)).toMatch(/\/todos\/7$/)
  expect(init.method).toBe('DELETE')
  expect(onDeleted).toHaveBeenCalledOnce()
})

it('shows the server error, stays open, and succeeds on retry', async () => {
  const { wrapper, user } = setup()
  fetchMock
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Task not found.' }), {
        status: 404,
      }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
  const onDeleted = vi.fn()
  const onClose = vi.fn()
  render(
    <DeleteTodoDialog
      todo={todo}
      busy={false}
      onClose={onClose}
      onDeleted={onDeleted}
    />,
    { wrapper },
  )
  await user.click(screen.getByRole('button', { name: 'Delete task' }))
  expect(await screen.findByText('Task not found.')).toBeVisible()
  expect(onDeleted).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
  const retry = screen.getByRole('button', { name: 'Delete task' })
  expect(retry).toBeEnabled()
  await user.click(retry)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(onDeleted).toHaveBeenCalledOnce()
})

it('shows progress and sends no second request while deleting', async () => {
  const { wrapper, user } = setup()
  let finish: (response: Response) => void = () => {}
  fetchMock.mockReturnValue(
    new Promise<Response>((resolve) => {
      finish = resolve
    }),
  )
  const onDeleted = vi.fn()
  render(
    <DeleteTodoDialog
      todo={todo}
      busy={false}
      onClose={vi.fn()}
      onDeleted={onDeleted}
    />,
    { wrapper },
  )
  await user.click(screen.getByRole('button', { name: 'Delete task' }))
  const pending = await screen.findByRole('button', { name: 'Deleting…' })
  expect(pending).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  await user.click(pending)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  finish(new Response(null, { status: 204 }))
  await vi.waitFor(() => expect(onDeleted).toHaveBeenCalledOnce())
})
