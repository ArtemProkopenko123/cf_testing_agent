import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { useNotice } from '../../hooks/useNotice'
import { useClearCompletedMutation } from './hooks/useClearCompletedMutation'
import { useTodoFilters } from './hooks/useTodoFilters'
import { useTodosBusy } from './hooks/useTodosBusy'
import { useTodosQuery } from './hooks/useTodosQuery'
import { useUpdateTodoMutation } from './hooks/useUpdateTodoMutation'
import { TodosPage } from './TodosPage'

vi.mock('../../design-system', () => import('../../design-system/mocks'))
vi.mock('../../hooks/useNotice', () => ({ useNotice: vi.fn() }))
vi.mock('./hooks/useTodoFilters', () => ({ useTodoFilters: vi.fn() }))
vi.mock('./hooks/useTodosBusy', () => ({ useTodosBusy: vi.fn() }))
vi.mock('./hooks/useClearCompletedMutation', () => ({
  useClearCompletedMutation: vi.fn(),
}))
vi.mock('./hooks/useTodosQuery', () => ({ useTodosQuery: vi.fn() }))
vi.mock('./hooks/useUpdateTodoMutation', () => ({
  useUpdateTodoMutation: vi.fn(),
}))
vi.mock('./components/TodosHeader', () => ({
  TodosHeader: () => <h1>Tasks</h1>,
}))
vi.mock('./components/TodoFilters', () => ({ TodoFilters: () => null }))
vi.mock('./components/TodoList', () => ({ TodoList: () => <p>Task list</p> }))
vi.mock('./components/TodoEditor', () => ({ TodoEditor: () => null }))
vi.mock('./components/DeleteTodoDialog', () => ({
  DeleteTodoDialog: () => null,
}))
vi.mock('../../components/SuccessNotice', () => ({ SuccessNotice: () => null }))

beforeEach(() => {
  vi.mocked(useClearCompletedMutation).mockReturnValue({
    error: null,
    reset: vi.fn(),
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useClearCompletedMutation>)
})

it('displays a query failure and resets mutation errors before retrying', async () => {
  const user = userEvent.setup()
  const refetch = vi.fn().mockResolvedValue(undefined)
  const reset = vi.fn()
  vi.mocked(useTodosQuery).mockReturnValue({
    data: [],
    isPending: false,
    isFetching: false,
    isError: true,
    error: new Error('The server is unavailable.'),
    refetch,
  } as unknown as ReturnType<typeof useTodosQuery>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    error: null,
    reset,
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  vi.mocked(useTodosBusy).mockReturnValue(false)
  vi.mocked(useNotice).mockReturnValue({ message: '', notify: vi.fn() })
  vi.mocked(useTodoFilters).mockReturnValue({
    filter: 'all',
    search: '',
    sort: 'newest',
    visible: [],
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    setSort: vi.fn(),
  })
  render(<TodosPage />)
  expect(screen.getByTestId('alert')).toHaveTextContent(
    'The server is unavailable.',
  )
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1))
  expect(reset).toHaveBeenCalledTimes(1)
  expect(reset.mock.invocationCallOrder[0]).toBeLessThan(
    refetch.mock.invocationCallOrder[0],
  )
})

function mockPage({
  query = {},
  mutationError = null,
  busy = false,
}: {
  query?: Record<string, unknown>
  mutationError?: Error | null
  busy?: boolean
}) {
  vi.mocked(useTodosQuery).mockReturnValue({
    data: [],
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...query,
  } as unknown as ReturnType<typeof useTodosQuery>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    error: mutationError,
    reset: vi.fn(),
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  vi.mocked(useTodosBusy).mockReturnValue(busy)
  vi.mocked(useNotice).mockReturnValue({ message: '', notify: vi.fn() })
  vi.mocked(useTodoFilters).mockReturnValue({
    filter: 'all',
    search: '',
    sort: 'newest',
    visible: [],
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    setSort: vi.fn(),
  })
}

it('shows a failed task update in the page alert', () => {
  mockPage({ mutationError: new Error('Could not update the task.') })
  render(<TodosPage />)
  expect(screen.getByTestId('alert')).toHaveTextContent(
    'Could not update the task.',
  )
})

it('shows no alert when neither the list nor an update failed', () => {
  mockPage({})
  render(<TodosPage />)
  expect(screen.queryByTestId('alert')).not.toBeInTheDocument()
})

it('disables Try again while the list is refetching', () => {
  mockPage({
    query: {
      isError: true,
      isFetching: true,
      error: new Error('The server is unavailable.'),
    },
  })
  render(<TodosPage />)
  expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled()
})

it('disables Try again while another task operation is busy', () => {
  mockPage({
    query: {
      isError: true,
      error: new Error('The server is unavailable.'),
    },
    busy: true,
  })
  render(<TodosPage />)
  expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled()
})
