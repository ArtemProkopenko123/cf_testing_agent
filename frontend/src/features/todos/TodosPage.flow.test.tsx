import { QueryClient } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { AppProviders } from '../../app/AppProviders'
import { todoFixture } from '../../test/todoFixture'
import { TodosPage } from './TodosPage'
import type { Todo } from './types'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'

// Real children and hooks; only the network is faked. The mocks in
// TodosPage.test.tsx hide the task checkboxes that drive these flows.

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

// GET returns the task list; PATCH is answered by `update`.
function serve(list: Todo[], update: () => Promise<Response>) {
  fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
    init?.method === 'PATCH' ? update() : json(list),
  )
}

function patchCall() {
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')
  if (!call) throw new Error('No PATCH request was sent.')
  return call as [string, RequestInit]
}

it('sends completed: true when an open task is completed', async () => {
  const { wrapper, user } = setup()
  serve([todoFixture], () => json({ ...todoFixture, completed: true }))
  render(<TodosPage />, { wrapper })

  await user.click(
    await screen.findByRole('checkbox', { name: 'Complete: Prepare a demo' }),
  )

  await waitFor(() => expect(patchCall()).toBeDefined())
  const [url, init] = patchCall()
  expect(url).toBe('/api/todos/7')
  expect(JSON.parse(init.body as string)).toEqual({ completed: true })
})

it('tells the user the task was completed', async () => {
  const { wrapper, user } = setup()
  serve([todoFixture], () => json({ ...todoFixture, completed: true }))
  render(<TodosPage />, { wrapper })

  await user.click(
    await screen.findByRole('checkbox', { name: 'Complete: Prepare a demo' }),
  )

  expect(
    await screen.findByText('Another task complete. Well done!'),
  ).toBeVisible()
})

it('sends completed: false when a completed task is reopened', async () => {
  const { wrapper, user } = setup()
  const done = { ...todoFixture, completed: true }
  serve([done], () => json({ ...done, completed: false }))
  render(<TodosPage />, { wrapper })

  await user.click(
    await screen.findByRole('checkbox', {
      name: 'Mark as active: Prepare a demo',
    }),
  )

  await waitFor(() => expect(patchCall()).toBeDefined())
  expect(JSON.parse(patchCall()[1].body as string)).toEqual({
    completed: false,
  })
})

it('tells the user the task was marked as active when reopened', async () => {
  const { wrapper, user } = setup()
  const done = { ...todoFixture, completed: true }
  serve([done], () => json({ ...done, completed: false }))
  render(<TodosPage />, { wrapper })

  await user.click(
    await screen.findByRole('checkbox', {
      name: 'Mark as active: Prepare a demo',
    }),
  )

  expect(await screen.findByText('Task marked as active.')).toBeVisible()
})

it('shows the saved status in the task list after an update', async () => {
  const { wrapper, user } = setup()
  serve([todoFixture], () => json({ ...todoFixture, completed: true }))
  render(<TodosPage />, { wrapper })

  await user.click(
    await screen.findByRole('checkbox', { name: 'Complete: Prepare a demo' }),
  )

  expect(
    await screen.findByRole('checkbox', {
      name: 'Mark as active: Prepare a demo',
    }),
  ).toBeChecked()
})

it('disables the other task checkboxes while an update is in flight', async () => {
  const { wrapper, user } = setup()
  const second = { ...todoFixture, id: 8, title: 'Second task' }
  // The update never settles, so the page stays busy for the assertions.
  serve([todoFixture, second], () => new Promise<Response>(() => {}))
  render(<TodosPage />, { wrapper })

  await user.click(
    await screen.findByRole('checkbox', { name: 'Complete: Prepare a demo' }),
  )

  expect(
    await screen.findByRole('checkbox', { name: 'Complete: Second task' }),
  ).toBeDisabled()
})

it('shows the server message in the alert when an update fails', async () => {
  const { wrapper, user } = setup()
  serve([todoFixture], () => json({ detail: 'Task not found.' }, 404))
  render(<TodosPage />, { wrapper })

  await user.click(
    await screen.findByRole('checkbox', { name: 'Complete: Prepare a demo' }),
  )

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Task not found.',
  )
  expect(
    screen.getByRole('checkbox', { name: 'Complete: Prepare a demo' }),
  ).not.toBeChecked()
})

it('closes the new-task editor after a save and tells the user it was added', async () => {
  const { wrapper, user } = setup()
  const created = { ...todoFixture, id: 9, title: 'Write the report' }
  fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? json(created, 201) : json([]),
  )
  render(<TodosPage />, { wrapper })

  await user.click(await screen.findByRole('button', { name: 'New task' }))
  await user.type(screen.getByLabelText(/Task title/), 'Write the report')
  await user.click(screen.getByRole('button', { name: 'Save task' }))

  expect(await screen.findByText('New task added.')).toBeVisible()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

function serveClear(list: Todo[], clear: () => Promise<Response>) {
  fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
    init?.method === 'DELETE' ? clear() : json(list),
  )
}

it('clears completed tasks, sends the bulk request and reports the count', async () => {
  const { wrapper, user } = setup()
  const open = { ...todoFixture, id: 1, title: 'Open task' }
  const doneA = { ...todoFixture, id: 2, title: 'Done A', completed: true }
  const doneB = { ...todoFixture, id: 3, title: 'Done B', completed: true }
  serveClear([open, doneA, doneB], () => json({ count: 2 }))
  render(<TodosPage />, { wrapper })

  await user.click(await screen.findByRole('button', { name: 'Clear completed' }))

  expect(await screen.findByText('Cleared 2 completed tasks.')).toBeVisible()
  const [url, init] = fetchMock.mock.calls.find(
    ([, call]) => call?.method === 'DELETE',
  ) as [string, RequestInit]
  expect(url).toBe('/api/todos?completed=true')
  expect(init.method).toBe('DELETE')
  expect(screen.queryByText('Done A')).not.toBeInTheDocument()
  expect(screen.queryByText('Done B')).not.toBeInTheDocument()
  expect(screen.getByText('Open task')).toBeVisible()
})

it('uses the singular in the notice when one task was cleared', async () => {
  const { wrapper, user } = setup()
  const doneA = { ...todoFixture, id: 2, title: 'Done A', completed: true }
  serveClear([doneA], () => json({ count: 1 }))
  render(<TodosPage />, { wrapper })

  await user.click(await screen.findByRole('button', { name: 'Clear completed' }))

  expect(await screen.findByText('Cleared 1 completed task.')).toBeVisible()
})

it('disables Clear completed when no task is completed', async () => {
  const { wrapper } = setup()
  serveClear([todoFixture], () => json({ count: 0 }))
  render(<TodosPage />, { wrapper })

  await screen.findByText('Prepare a demo')
  expect(screen.getByRole('button', { name: 'Clear completed' })).toBeDisabled()
})

it('disables Clear completed while another operation is running', async () => {
  const { wrapper, user } = setup()
  const done = { ...todoFixture, completed: true }
  // The update never settles, so the page stays busy.
  fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
    init?.method === 'PATCH' ? new Promise<Response>(() => {}) : json([done]),
  )
  render(<TodosPage />, { wrapper })

  await user.click(
    await screen.findByRole('checkbox', {
      name: 'Mark as active: Prepare a demo',
    }),
  )

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Clear completed' })).toBeDisabled(),
  )
})

it('shows the server message in the alert when clearing fails and keeps the tasks', async () => {
  const { wrapper, user } = setup()
  const done = { ...todoFixture, completed: true }
  serveClear([done], () => json({ detail: 'Could not clear tasks.' }, 500))
  render(<TodosPage />, { wrapper })

  await user.click(await screen.findByRole('button', { name: 'Clear completed' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not clear tasks.',
  )
  expect(screen.getByText('Prepare a demo')).toBeVisible()
})

it('deletes a task after confirmation and tells the user it was deleted', async () => {
  const { wrapper, user } = setup()
  fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
    init?.method === 'DELETE'
      ? Promise.resolve(new Response(null, { status: 204 }))
      : json([todoFixture]),
  )
  render(<TodosPage />, { wrapper })

  await user.click(
    await screen.findByRole('button', { name: 'Delete: Prepare a demo' }),
  )
  expect(screen.getByRole('dialog', { name: 'Delete task?' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Delete task' }))

  expect(await screen.findByText('Task deleted.')).toBeVisible()
  const [url, init] = fetchMock.mock.calls.find(
    ([, call]) => call?.method === 'DELETE',
  ) as [string, RequestInit]
  expect(url).toBe('/api/todos/7')
  expect(init.method).toBe('DELETE')
})
