import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { useCreateTodoMutation } from '../hooks/useCreateTodoMutation'
import { useUpdateTodoMutation } from '../hooks/useUpdateTodoMutation'
import type { TodoInput } from '../types'
import { TodoEditor } from './TodoEditor'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))
vi.mock('../hooks/useCreateTodoMutation', () => ({
  useCreateTodoMutation: vi.fn(),
}))
vi.mock('../hooks/useUpdateTodoMutation', () => ({
  useUpdateTodoMutation: vi.fn(),
}))
vi.mock('./TodoForm', () => ({
  TodoForm: ({
    onSubmit,
  }: {
    onSubmit: (input: TodoInput) => Promise<void>
  }) => <button onClick={() => void onSubmit(todoFixture)}>Submit form</button>,
}))

it('creates a new task and reports a successful save', async () => {
  const user = userEvent.setup()
  const create = vi.fn().mockResolvedValue(todoFixture)
  const update = vi.fn()
  vi.mocked(useCreateTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: create,
  } as unknown as ReturnType<typeof useCreateTodoMutation>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: update,
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  const onSaved = vi.fn()
  render(
    <TodoEditor todo="new" busy={false} onClose={vi.fn()} onSaved={onSaved} />,
  )
  expect(screen.getByRole('dialog', { name: 'New task' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Submit form' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('New task added.'))
  expect(create).toHaveBeenCalledWith(todoFixture)
  expect(update).not.toHaveBeenCalled()
})

function mockMutations({
  create = vi.fn(),
  update = vi.fn(),
  createPending = false,
  updatePending = false,
}: {
  create?: ReturnType<typeof vi.fn>
  update?: ReturnType<typeof vi.fn>
  createPending?: boolean
  updatePending?: boolean
}) {
  vi.mocked(useCreateTodoMutation).mockReturnValue({
    isPending: createPending,
    error: null,
    mutateAsync: create,
  } as unknown as ReturnType<typeof useCreateTodoMutation>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    isPending: updatePending,
    error: null,
    mutateAsync: update,
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  return { create, update }
}

it('updates the existing task by id and reports the saved changes', async () => {
  const user = userEvent.setup()
  const { create, update } = mockMutations({
    update: vi.fn().mockResolvedValue(todoFixture),
  })
  const onSaved = vi.fn()
  render(
    <TodoEditor
      todo={todoFixture}
      busy={false}
      onClose={vi.fn()}
      onSaved={onSaved}
    />,
  )
  expect(screen.getByRole('dialog', { name: 'Edit task' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Submit form' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Changes saved.'))
  expect(update).toHaveBeenCalledWith({ id: 7, input: todoFixture })
  expect(create).not.toHaveBeenCalled()
})

it('keeps the editor open and reports nothing when the save is rejected', async () => {
  const user = userEvent.setup()
  mockMutations({
    create: vi.fn().mockRejectedValue(new Error('Could not save the task.')),
  })
  const onSaved = vi.fn()
  render(
    <TodoEditor todo="new" busy={false} onClose={vi.fn()} onSaved={onSaved} />,
  )
  await user.click(screen.getByRole('button', { name: 'Submit form' }))
  expect(await screen.findByRole('dialog', { name: 'New task' })).toBeVisible()
  expect(onSaved).not.toHaveBeenCalled()
})

it('ignores a submit while a save is already pending', async () => {
  const user = userEvent.setup()
  const { create, update } = mockMutations({ createPending: true })
  render(
    <TodoEditor todo="new" busy={false} onClose={vi.fn()} onSaved={vi.fn()} />,
  )
  await user.click(screen.getByRole('button', { name: 'Submit form' }))
  expect(create).not.toHaveBeenCalled()
  expect(update).not.toHaveBeenCalled()
})
