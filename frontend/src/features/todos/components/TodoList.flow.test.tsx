import { QueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps, ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { AppProviders } from '../../../app/AppProviders'
import { todoFixture } from '../../../test/todoFixture'
import { TodoList } from './TodoList'

// Real TodoItem and TodoEmptyState; the mocks in TodoList.test.tsx hide the
// controls that call these callbacks.

const second = { ...todoFixture, id: 8, title: 'Second task' }

let props: ComponentProps<typeof TodoList>

beforeEach(() => {
  props = {
    todos: [todoFixture, second],
    hasTodos: true,
    loading: false,
    failed: false,
    busy: false,
    onCreate: vi.fn(),
    onToggle: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  }
})

function setup() {
  const client = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders client={client}>{children}</AppProviders>
  )
  return { wrapper, user: userEvent.setup() }
}

it('lists every task by its title', () => {
  const { wrapper } = setup()
  render(<TodoList {...props} />, { wrapper })
  expect(
    screen.getByRole('heading', { name: 'Prepare a demo' }),
  ).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Second task' })).toBeVisible()
})

it('passes the task whose checkbox is clicked to onToggle', async () => {
  const { wrapper, user } = setup()
  render(<TodoList {...props} />, { wrapper })
  await user.click(screen.getByRole('checkbox', { name: 'Complete: Second task' }))
  expect(props.onToggle).toHaveBeenCalledTimes(1)
  expect(props.onToggle).toHaveBeenCalledWith(second)
})

it('passes the task whose edit button is clicked to onEdit', async () => {
  const { wrapper, user } = setup()
  render(<TodoList {...props} />, { wrapper })
  await user.click(screen.getByRole('button', { name: 'Edit: Prepare a demo' }))
  expect(props.onEdit).toHaveBeenCalledTimes(1)
  expect(props.onEdit).toHaveBeenCalledWith(todoFixture)
})

it('passes the task whose delete button is clicked to onDelete', async () => {
  const { wrapper, user } = setup()
  render(<TodoList {...props} />, { wrapper })
  await user.click(screen.getByRole('button', { name: 'Delete: Second task' }))
  expect(props.onDelete).toHaveBeenCalledTimes(1)
  expect(props.onDelete).toHaveBeenCalledWith(second)
})

it('disables the checkboxes and task buttons while busy', () => {
  const { wrapper } = setup()
  render(<TodoList {...props} busy />, { wrapper })
  expect(
    screen.getByRole('checkbox', { name: 'Complete: Prepare a demo' }),
  ).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Edit: Prepare a demo' }),
  ).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Delete: Prepare a demo' }),
  ).toBeDisabled()
})

it('offers to add a first task and calls onCreate when there are none', async () => {
  const { wrapper, user } = setup()
  render(
    <TodoList {...props} todos={[]} hasTodos={false} />,
    { wrapper },
  )
  expect(
    screen.getByRole('heading', { name: 'Add your first task' }),
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Add your first task' }))
  expect(props.onCreate).toHaveBeenCalledTimes(1)
})

it('disables the add-first-task button while busy', () => {
  const { wrapper } = setup()
  render(
    <TodoList {...props} todos={[]} hasTodos={false} busy />,
    { wrapper },
  )
  expect(
    screen.getByRole('button', { name: 'Add your first task' }),
  ).toBeDisabled()
})

it('says no tasks match when tasks exist but none are visible', () => {
  const { wrapper } = setup()
  render(<TodoList {...props} todos={[]} hasTodos />, { wrapper })
  expect(
    screen.getByRole('heading', { name: 'No matching tasks' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Add your first task' }),
  ).not.toBeInTheDocument()
})
