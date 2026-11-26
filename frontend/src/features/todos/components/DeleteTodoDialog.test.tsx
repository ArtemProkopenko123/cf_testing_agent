import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { useDeleteTodoMutation } from '../hooks/useDeleteTodoMutation'
import { DeleteTodoDialog } from './DeleteTodoDialog'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))
vi.mock('../hooks/useDeleteTodoMutation', () => ({
  useDeleteTodoMutation: vi.fn(),
}))

it('shows a deletion error and allows cancelling without deleting', async () => {
  const user = userEvent.setup()
  const mutateAsync = vi.fn()
  vi.mocked(useDeleteTodoMutation).mockReturnValue({
    isPending: false,
    error: new Error('Could not delete.'),
    mutateAsync,
  } as unknown as ReturnType<typeof useDeleteTodoMutation>)
  const onClose = vi.fn()
  const onDeleted = vi.fn()
  render(
    <DeleteTodoDialog
      todo={todoFixture}
      busy={false}
      onClose={onClose}
      onDeleted={onDeleted}
    />,
  )
  expect(screen.getByRole('dialog', { name: 'Delete task?' })).toBeVisible()
  expect(
    screen.getByText(
      `The task “${todoFixture.title}” will be permanently deleted.`,
    ),
  ).toBeVisible()
  expect(screen.getByTestId('alert')).toHaveTextContent('Could not delete.')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(mutateAsync).not.toHaveBeenCalled()
  expect(onDeleted).not.toHaveBeenCalled()
})

function mockDeleteMutation(overrides: Record<string, unknown>) {
  vi.mocked(useDeleteTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ReturnType<typeof useDeleteTodoMutation>)
}

it('deletes the task by id and reports success', async () => {
  const user = userEvent.setup()
  const mutateAsync = vi.fn().mockResolvedValue(undefined)
  mockDeleteMutation({ mutateAsync })
  const onDeleted = vi.fn()
  render(
    <DeleteTodoDialog
      todo={todoFixture}
      busy={false}
      onClose={vi.fn()}
      onDeleted={onDeleted}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Delete task' }))
  expect(mutateAsync).toHaveBeenCalledWith(todoFixture.id)
  expect(onDeleted).toHaveBeenCalledTimes(1)
})

it('keeps the dialog open when the deletion fails', async () => {
  const user = userEvent.setup()
  mockDeleteMutation({
    mutateAsync: vi.fn().mockRejectedValue(new Error('Could not delete.')),
  })
  const onClose = vi.fn()
  const onDeleted = vi.fn()
  render(
    <DeleteTodoDialog
      todo={todoFixture}
      busy={false}
      onClose={onClose}
      onDeleted={onDeleted}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Delete task' }))
  expect(onDeleted).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog', { name: 'Delete task?' })).toBeVisible()
})

it('shows progress and disables the actions while the deletion is pending', () => {
  mockDeleteMutation({ isPending: true })
  render(
    <DeleteTodoDialog
      todo={todoFixture}
      busy={false}
      onClose={vi.fn()}
      onDeleted={vi.fn()}
    />,
  )
  expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
})

it('disables the actions and does not delete while the page is busy', async () => {
  const user = userEvent.setup()
  const mutateAsync = vi.fn().mockResolvedValue(undefined)
  mockDeleteMutation({ mutateAsync })
  const onDeleted = vi.fn()
  render(
    <DeleteTodoDialog
      todo={todoFixture}
      busy
      onClose={vi.fn()}
      onDeleted={onDeleted}
    />,
  )
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  // The destructive action is the last button in the dialog (after Close and Cancel).
  const buttons = screen.getAllByRole('button')
  const deleteButton = buttons[buttons.length - 1]
  expect(deleteButton).toBeDisabled()
  await user.click(deleteButton)
  expect(mutateAsync).not.toHaveBeenCalled()
  expect(onDeleted).not.toHaveBeenCalled()
})
