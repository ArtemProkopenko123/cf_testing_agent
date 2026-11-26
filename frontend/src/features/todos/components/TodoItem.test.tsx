import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { TodoItem } from './TodoItem'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))

afterEach(() => {
  vi.useRealTimers()
})

it('shows an active task and forwards edit requests', async () => {
  const user = userEvent.setup()
  const onEdit = vi.fn()
  const onToggle = vi.fn()
  const onDelete = vi.fn()
  render(
    <TodoItem
      todo={todoFixture}
      busy={false}
      onEdit={onEdit}
      onToggle={onToggle}
      onDelete={onDelete}
    />,
  )
  expect(screen.getByRole('heading', { name: todoFixture.title })).toBeVisible()
  expect(screen.getByText('To do')).toBeVisible()
  expect(screen.getByText('Medium')).toBeVisible()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  await user.click(
    screen.getByRole('button', { name: `Edit: ${todoFixture.title}` }),
  )
  expect(onEdit).toHaveBeenCalledTimes(1)
  expect(onToggle).not.toHaveBeenCalled()
  expect(onDelete).not.toHaveBeenCalled()
})

it('shows a completed task as completed with a checkbox to reactivate it', () => {
  render(
    <TodoItem
      todo={{ ...todoFixture, completed: true }}
      busy={false}
      onEdit={vi.fn()}
      onToggle={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.getByText('Completed')).toBeVisible()
  expect(
    screen.getByRole('checkbox', {
      name: `Mark as active: ${todoFixture.title}`,
    }),
  ).toBeChecked()
})

it('forwards the checkbox change to complete the task', async () => {
  const user = userEvent.setup()
  const onToggle = vi.fn()
  render(
    <TodoItem
      todo={todoFixture}
      busy={false}
      onEdit={vi.fn()}
      onToggle={onToggle}
      onDelete={vi.fn()}
    />,
  )
  await user.click(
    screen.getByRole('checkbox', { name: `Complete: ${todoFixture.title}` }),
  )
  expect(onToggle).toHaveBeenCalledTimes(1)
})

it('forwards the delete request', async () => {
  const user = userEvent.setup()
  const onDelete = vi.fn()
  render(
    <TodoItem
      todo={todoFixture}
      busy={false}
      onEdit={vi.fn()}
      onToggle={vi.fn()}
      onDelete={onDelete}
    />,
  )
  await user.click(
    screen.getByRole('button', { name: `Delete: ${todoFixture.title}` }),
  )
  expect(onDelete).toHaveBeenCalledTimes(1)
})

it('shows the task description', () => {
  render(
    <TodoItem
      todo={{ ...todoFixture, description: 'Slides for Monday' }}
      busy={false}
      onEdit={vi.fn()}
      onToggle={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.getByText('Slides for Monday')).toBeVisible()
})

it.each([
  { priority: 'low', label: 'Low' },
  { priority: 'high', label: 'High' },
] as const)(
  'shows the $label priority for a $priority task',
  ({ priority, label }) => {
    render(
      <TodoItem
        todo={{ ...todoFixture, priority }}
        busy={false}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText(label)).toBeVisible()
  },
)

it('marks an open task past its due date as overdue', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-26T12:00:00'))
  render(
    <TodoItem
      todo={{ ...todoFixture, due_date: '2026-11-01' }}
      busy={false}
      onEdit={vi.fn()}
      onToggle={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.getByText(/overdue/)).toBeVisible()
})

it('does not mark a completed task as overdue after its due date', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-26T12:00:00'))
  render(
    <TodoItem
      todo={{ ...todoFixture, completed: true, due_date: '2026-11-01' }}
      busy={false}
      onEdit={vi.fn()}
      onToggle={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.queryByText(/overdue/)).not.toBeInTheDocument()
})

it('disables the checkbox and icon actions while the page is busy', () => {
  render(
    <TodoItem
      todo={todoFixture}
      busy
      onEdit={vi.fn()}
      onToggle={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(
    screen.getByRole('checkbox', { name: `Complete: ${todoFixture.title}` }),
  ).toBeDisabled()
  expect(
    screen.getByRole('button', { name: `Edit: ${todoFixture.title}` }),
  ).toBeDisabled()
  expect(
    screen.getByRole('button', { name: `Delete: ${todoFixture.title}` }),
  ).toBeDisabled()
})
