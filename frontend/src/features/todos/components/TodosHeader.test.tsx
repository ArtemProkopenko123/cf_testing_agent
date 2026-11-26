import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { TodosHeader } from './TodosHeader'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))

it('invokes creation when enabled and blocks it when disabled', async () => {
  const user = userEvent.setup()
  const onCreate = vi.fn()
  const { rerender } = render(
    <TodosHeader
      disabled={false}
      hasCompleted={false}
      onCreate={onCreate}
      onClearCompleted={vi.fn()}
    />,
  )
  expect(screen.getByRole('heading', { name: 'Tasks' })).toBeVisible()
  expect(
    screen.getByText('Create, organize, and complete tasks.'),
  ).toBeVisible()
  const button = screen.getByRole('button', { name: 'New task' })
  await user.click(button)
  expect(onCreate).toHaveBeenCalledTimes(1)
  rerender(
    <TodosHeader
      disabled
      hasCompleted={false}
      onCreate={onCreate}
      onClearCompleted={vi.fn()}
    />,
  )
  expect(button).toBeDisabled()
  await user.click(button)
  expect(onCreate).toHaveBeenCalledTimes(1)
})

it('calls onClearCompleted when Clear completed is clicked and tasks are completed', async () => {
  const user = userEvent.setup()
  const onClearCompleted = vi.fn()
  render(
    <TodosHeader
      disabled={false}
      hasCompleted
      onCreate={vi.fn()}
      onClearCompleted={onClearCompleted}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Clear completed' }))
  expect(onClearCompleted).toHaveBeenCalledTimes(1)
})

it('disables Clear completed when there are no completed tasks', () => {
  render(
    <TodosHeader
      disabled={false}
      hasCompleted={false}
      onCreate={vi.fn()}
      onClearCompleted={vi.fn()}
    />,
  )
  expect(screen.getByRole('button', { name: 'Clear completed' })).toBeDisabled()
})

it('disables Clear completed while the page is disabled', () => {
  render(
    <TodosHeader
      disabled
      hasCompleted
      onCreate={vi.fn()}
      onClearCompleted={vi.fn()}
    />,
  )
  expect(screen.getByRole('button', { name: 'Clear completed' })).toBeDisabled()
})
