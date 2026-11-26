import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import type { Todo } from '../types'
import { useTodoFilters } from './useTodoFilters'

// Ids are chosen so that newest-first, priority and due-date orders differ.
const buyMilk: Todo = {
  ...todoFixture,
  id: 1,
  title: 'Buy milk',
  priority: 'low',
  completed: false,
  due_date: null,
  created_at: '2026-10-01T09:00:00Z',
}
const callAlice: Todo = {
  ...todoFixture,
  id: 2,
  title: 'Call Alice',
  priority: 'high',
  completed: true,
  due_date: '2026-10-30',
  created_at: '2026-10-03T09:00:00Z',
}
const planTrip: Todo = {
  ...todoFixture,
  id: 3,
  title: 'Plan trip',
  priority: 'high',
  completed: false,
  due_date: '2026-11-01',
  created_at: '2026-10-02T09:00:00Z',
}
const buyBread: Todo = {
  ...todoFixture,
  id: 4,
  title: 'Buy bread',
  priority: 'medium',
  completed: false,
  due_date: null,
  created_at: '2026-10-04T09:00:00Z',
}
const todos = [buyMilk, callAlice, planTrip, buyBread]

function visibleIds() {
  return (result: { current: ReturnType<typeof useTodoFilters> }) =>
    result.current.visible.map((todo) => todo.id)
}

describe('useTodoFilters', () => {
  it('shows every task, newest first, by default', () => {
    const { result } = renderHook(() => useTodoFilters(todos))

    expect(visibleIds()(result)).toEqual([4, 2, 3, 1])
  })

  it('hides active tasks when the completed filter is set', () => {
    const { result } = renderHook(() => useTodoFilters(todos))

    act(() => result.current.setFilter('completed'))

    expect(visibleIds()(result)).toEqual([2])
  })

  it('hides completed tasks when the active filter is set', () => {
    const { result } = renderHook(() => useTodoFilters(todos))

    act(() => result.current.setFilter('active'))

    expect(visibleIds()(result)).toEqual([4, 3, 1])
  })

  it('matches the search text against titles regardless of case', () => {
    const { result } = renderHook(() => useTodoFilters(todos))

    act(() => result.current.setSearch('  BUY '))

    expect(visibleIds()(result)).toEqual([4, 1])
  })

  it('sorts high priority first when priority sort is selected', () => {
    const { result } = renderHook(() => useTodoFilters(todos))

    act(() => result.current.setSort('priority'))

    expect(visibleIds()(result)).toEqual([3, 2, 4, 1])
  })

  it('sorts by due date and puts tasks without a due date last', () => {
    const { result } = renderHook(() => useTodoFilters(todos))

    act(() => result.current.setSort('due'))

    expect(visibleIds()(result)).toEqual([2, 3, 4, 1])
  })
})
