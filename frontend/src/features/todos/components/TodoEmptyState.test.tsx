import { QueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { AppProviders } from '../../../app/AppProviders'
import { TodoEmptyState } from './TodoEmptyState'

function setup() {
  const client = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders client={client}>{children}</AppProviders>
  )
  return { user: userEvent.setup(), wrapper }
}

it('invites the first task and forwards the add request', async () => {
  const { user, wrapper } = setup()
  const onCreate = vi.fn()
  render(
    <TodoEmptyState hasTodos={false} disabled={false} onCreate={onCreate} />,
    { wrapper },
  )
  expect(
    screen.getByRole('heading', { name: 'Add your first task' }),
  ).toBeVisible()
  expect(
    screen.getByText('Write down what you need to do and get started.'),
  ).toBeVisible()
  await user.click(
    screen.getByRole('button', { name: 'Add your first task' }),
  )
  expect(onCreate).toHaveBeenCalledTimes(1)
})

it('disables the add button while the list is busy', () => {
  const { wrapper } = setup()
  render(
    <TodoEmptyState hasTodos={false} disabled onCreate={vi.fn()} />,
    { wrapper },
  )
  expect(
    screen.getByRole('button', { name: 'Add your first task' }),
  ).toBeDisabled()
})

it('explains how to find hidden tasks instead of inviting a new one', () => {
  const { wrapper } = setup()
  render(
    <TodoEmptyState hasTodos disabled={false} onCreate={vi.fn()} />,
    { wrapper },
  )
  expect(
    screen.getByRole('heading', { name: 'No matching tasks' }),
  ).toBeVisible()
  expect(
    screen.getByText('Change the status filter or search to find your tasks.'),
  ).toBeVisible()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
