import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { TodoList } from './TodoList'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))
vi.mock('./TodoEmptyState', () => ({
  TodoEmptyState: () => <p>Empty task list</p>,
}))
vi.mock('./TodoItem', () => ({ TodoItem: () => <li>Task</li> }))

it('shows loading feedback before showing an empty list', () => {
  const props = {
    todos: [],
    hasTodos: false,
    failed: false,
    busy: false,
    onCreate: vi.fn(),
    onToggle: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  }
  const { rerender } = render(<TodoList {...props} loading />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading your tasks…')
  expect(screen.queryByText('Empty task list')).not.toBeInTheDocument()
  rerender(<TodoList {...props} loading={false} />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByText('Empty task list')).toBeVisible()
})

const listProps = {
  todos: [],
  hasTodos: false,
  loading: false,
  failed: false,
  busy: false,
  onCreate: vi.fn(),
  onToggle: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
}

it('shows the unavailable message when the list fails before any task loads', () => {
  render(<TodoList {...listProps} failed />)
  expect(
    screen.getByRole('heading', {
      name: 'The task list is temporarily unavailable',
    }),
  ).toBeVisible()
  expect(screen.getByText('Try again to load your tasks.')).toBeVisible()
  expect(screen.queryByText('Empty task list')).not.toBeInTheDocument()
})

it('keeps the loaded tasks visible when a refetch fails', () => {
  render(
    <TodoList
      {...listProps}
      todos={[todoFixture]}
      hasTodos
      failed
    />,
  )
  expect(screen.getByText('Task')).toBeVisible()
  expect(
    screen.queryByText('The task list is temporarily unavailable'),
  ).not.toBeInTheDocument()
})

it('renders one item per task', () => {
  render(
    <TodoList
      {...listProps}
      todos={[todoFixture, { ...todoFixture, id: 8 }]}
      hasTodos
    />,
  )
  expect(screen.getAllByText('Task')).toHaveLength(2)
})

it('shows loading rather than the failure message during the first load', () => {
  render(<TodoList {...listProps} loading failed />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading your tasks…')
  expect(
    screen.queryByText('The task list is temporarily unavailable'),
  ).not.toBeInTheDocument()
})
