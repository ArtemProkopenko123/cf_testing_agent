import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { TodoInput } from '../types'
import { TodoForm } from './TodoForm'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))

describe('TodoForm', () => {
  it('rejects a whitespace-only title without submitting', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <TodoForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    await user.type(screen.getByLabelText(/Task title/), '   ')
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(screen.getByText('Enter a task title.')).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits trimmed values and the selected priority', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <TodoForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    await user.type(screen.getByLabelText(/Task title/), '  Prepare a demo  ')
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Prepare a demo',
      description: '',
      priority: 'high',
      due_date: null,
      completed: false,
    })
  })

  it('rejects a title longer than 120 characters without submitting', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <TodoForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    await user.click(screen.getByLabelText(/Task title/))
    await user.paste('a'.repeat(121))
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(
      screen.getByText('The title must be at most 120 characters.'),
    ).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('accepts a title of exactly 120 characters', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <TodoForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    await user.click(screen.getByLabelText(/Task title/))
    await user.paste('a'.repeat(120))
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'a'.repeat(120) }),
    )
  })

  it('rejects a description longer than 2000 characters without submitting', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <TodoForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    await user.type(screen.getByLabelText(/Task title/), 'Prepare a demo')
    await user.click(screen.getByLabelText(/Description/))
    await user.paste('d'.repeat(2001))
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(
      screen.getByText('The description must be at most 2000 characters.'),
    ).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('trims the description before submitting', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <TodoForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    await user.type(screen.getByLabelText(/Task title/), 'Prepare a demo')
    await user.type(
      screen.getByLabelText(/Description/),
      '  Bring the slides  ',
    )
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Bring the slides' }),
    )
  })

  it('submits the due date the user picked', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <TodoForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    await user.type(screen.getByLabelText(/Task title/), 'Prepare a demo')
    await user.type(screen.getByLabelText(/Due date/), '2026-12-31')
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ due_date: '2026-12-31' }),
    )
  })

  it('pre-fills the fields from the task being edited and submits the edits', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    const initial: TodoInput = {
      title: 'Prepare a demo',
      description: 'Slides',
      priority: 'low',
      due_date: '2026-05-01',
      completed: false,
    }
    render(
      <TodoForm
        initial={initial}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    expect(screen.getByLabelText(/Task title/)).toHaveValue('Prepare a demo')
    expect(screen.getByLabelText('Priority')).toHaveValue('low')
    expect(screen.getByLabelText(/Due date/)).toHaveValue('2026-05-01')
    await user.clear(screen.getByLabelText(/Task title/))
    await user.type(screen.getByLabelText(/Task title/), 'Final demo')
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Final demo',
        description: 'Slides',
        priority: 'low',
        due_date: '2026-05-01',
      }),
    )
  })

  it('calls onCancel without submitting', async () => {
    const onSubmit = vi.fn()
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <TodoForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        busy={false}
        error={null}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('disables the fields and shows Saving… while busy', () => {
    render(
      <TodoForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        busy={true}
        error={null}
      />,
    )
    expect(screen.getByLabelText(/Task title/)).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('shows the save error in a warning alert', () => {
    render(
      <TodoForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        busy={false}
        error="Could not save the task."
      />,
    )
    expect(screen.getByTestId('alert')).toHaveTextContent(
      'Could not save the task.',
    )
  })
})
