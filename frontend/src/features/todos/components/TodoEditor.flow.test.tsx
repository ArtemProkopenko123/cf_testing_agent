import { QueryClient } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { AppProviders } from '../../../app/AppProviders'
import { todoFixture } from '../../../test/todoFixture'
import { TodoEditor } from './TodoEditor'

// Real form, drawer and mutation hooks; only the network is faked. The mocks in
// TodoEditor.test.tsx replace the form, which hides the error and cancel wiring.

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

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }))
}

it('posts the new task and reports that it was added', async () => {
  const { wrapper, user } = setup()
  fetchMock.mockImplementation(() =>
    json({ ...todoFixture, title: 'Prepare a demo' }, 201),
  )
  const onSaved = vi.fn()
  render(
    <TodoEditor todo="new" busy={false} onClose={vi.fn()} onSaved={onSaved} />,
    { wrapper },
  )

  await user.type(screen.getByLabelText(/Task title/), 'Prepare a demo')
  await user.click(screen.getByRole('button', { name: 'Save task' }))

  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('New task added.'))
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(url).toBe('/api/todos')
  expect(init.method).toBe('POST')
  expect(JSON.parse(init.body as string)).toEqual({
    title: 'Prepare a demo',
    description: '',
    priority: 'medium',
    due_date: null,
    completed: false,
  })
})

it('shows the server message in the drawer and keeps the editor open when saving fails', async () => {
  const { wrapper, user } = setup()
  fetchMock.mockImplementation(() =>
    json({ detail: 'Could not save the task.' }, 500),
  )
  const onSaved = vi.fn()
  render(
    <TodoEditor todo="new" busy={false} onClose={vi.fn()} onSaved={onSaved} />,
    { wrapper },
  )

  await user.type(screen.getByLabelText(/Task title/), 'Prepare a demo')
  await user.click(screen.getByRole('button', { name: 'Save task' }))

  expect(await screen.findByText('Could not save the task.')).toBeVisible()
  expect(screen.getByRole('dialog', { name: 'New task' })).toBeVisible()
  expect(onSaved).not.toHaveBeenCalled()
})

it('patches the edited task by id and reports the saved changes', async () => {
  const { wrapper, user } = setup()
  fetchMock.mockImplementation(() =>
    json({ ...todoFixture, title: 'Final demo' }),
  )
  const onSaved = vi.fn()
  render(
    <TodoEditor
      todo={todoFixture}
      busy={false}
      onClose={vi.fn()}
      onSaved={onSaved}
    />,
    { wrapper },
  )

  await user.clear(screen.getByLabelText(/Task title/))
  await user.type(screen.getByLabelText(/Task title/), 'Final demo')
  await user.click(screen.getByRole('button', { name: 'Save task' }))

  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Changes saved.'))
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(url).toBe('/api/todos/7')
  expect(init.method).toBe('PATCH')
  expect(JSON.parse(init.body as string)).toEqual({
    title: 'Final demo',
    description: '',
    priority: 'medium',
    due_date: null,
    completed: false,
  })
})

it('closes without sending a request when Cancel is pressed', async () => {
  const { wrapper, user } = setup()
  const onClose = vi.fn()
  const onSaved = vi.fn()
  render(
    <TodoEditor todo="new" busy={false} onClose={onClose} onSaved={onSaved} />,
    { wrapper },
  )

  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(onClose).toHaveBeenCalledTimes(1)
  expect(fetchMock).not.toHaveBeenCalled()
  expect(onSaved).not.toHaveBeenCalled()
})
