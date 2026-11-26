import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatDate, isOverdue, selectTodos, validateTodo } from './todos'
import type { Todo, TodoInput } from '../types'

function draft(overrides: Partial<TodoInput> = {}): TodoInput {
  return {
    title: 'Sprint plan',
    description: '',
    priority: 'medium',
    due_date: null,
    completed: false,
    ...overrides,
  }
}

const base: Todo = {
  id: 1,
  title: 'Sprint plan',
  description: '',
  priority: 'medium',
  completed: false,
  due_date: null,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
}

describe('selectTodos', () => {
  it('combines status with a case-insensitive search in the description', () => {
    const matching = { ...base, description: 'Discuss the API' }
    const todos = [
      matching,
      { ...matching, id: 2, completed: true },
      { ...base, id: 3 },
    ]
    expect(selectTodos(todos, 'active', ' api ', 'newest')).toEqual([matching])
  })

  it('sorts by priority without changing the source array', () => {
    const high: Todo = { ...base, id: 2, priority: 'high' }
    const todos = [base, high]
    expect(selectTodos(todos, 'all', '', 'priority')).toEqual([high, base])
    expect(todos).toEqual([base, high])
  })

  it('matches the search text against the title too', () => {
    const plan = { ...base, title: 'Sprint plan' }
    const other = { ...base, id: 2, title: 'Buy milk' }
    expect(selectTodos([plan, other], 'all', 'SPRINT', 'newest')).toEqual([
      plan,
    ])
  })

  it('keeps only completed tasks for the completed filter', () => {
    const done = { ...base, id: 2, completed: true }
    expect(selectTodos([base, done], 'completed', '', 'newest')).toEqual([
      done,
    ])
  })

  it('sorts by due date with undated tasks last', () => {
    const undated = { ...base, id: 1, due_date: null }
    const later = { ...base, id: 2, due_date: '2026-10-20' }
    const sooner = { ...base, id: 3, due_date: '2026-10-05' }
    expect(
      selectTodos([undated, later, sooner], 'all', '', 'due').map((t) => t.id),
    ).toEqual([3, 2, 1])
  })

  it('sorts the newest tasks first by creation time', () => {
    const older = { ...base, id: 1, created_at: '2026-10-01T12:00:00Z' }
    const newer = { ...base, id: 2, created_at: '2026-10-03T08:00:00Z' }
    expect(
      selectTodos([older, newer], 'all', '', 'newest').map((t) => t.id),
    ).toEqual([2, 1])
  })
})

describe('validateTodo', () => {
  it('returns no errors for a valid task', () => {
    expect(validateTodo(draft())).toEqual({})
  })

  it('accepts a real calendar date in YYYY-MM-DD form', () => {
    expect(validateTodo(draft({ due_date: '2026-10-15' }))).toEqual({})
  })

  it('asks for a title when it is blank after trimming', () => {
    expect(validateTodo(draft({ title: '   ' }))).toEqual({
      title: 'Enter a task title.',
    })
  })

  it('accepts a title of exactly 120 characters', () => {
    expect(validateTodo(draft({ title: 'a'.repeat(120) }))).toEqual({})
  })

  it('rejects a title of 121 characters', () => {
    expect(validateTodo(draft({ title: 'a'.repeat(121) }))).toEqual({
      title: 'The title must be at most 120 characters.',
    })
  })

  it('accepts a description of exactly 2000 characters', () => {
    expect(validateTodo(draft({ description: 'x'.repeat(2000) }))).toEqual({})
  })

  it('rejects a description of 2001 characters', () => {
    expect(validateTodo(draft({ description: 'x'.repeat(2001) }))).toEqual({
      description: 'The description must be at most 2000 characters.',
    })
  })

  it('rejects a due date that does not exist in the calendar', () => {
    expect(validateTodo(draft({ due_date: '2026-02-30' }))).toEqual({
      due_date: 'Enter a valid date.',
    })
  })

  it('rejects a due date that is not in YYYY-MM-DD form', () => {
    expect(validateTodo(draft({ due_date: '15/10/2026' }))).toEqual({
      due_date: 'Enter a valid date.',
    })
  })
})

describe('isOverdue', () => {
  const open: Todo = { ...base, id: 2, due_date: '2026-10-14' }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 15, 12)) // local noon, 15 October 2026
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is true for an open task due before today', () => {
    expect(isOverdue(open)).toBe(true)
  })

  it('is false for an open task due today', () => {
    expect(isOverdue({ ...open, due_date: '2026-10-15' })).toBe(false)
  })

  it('is false for an open task due in the future', () => {
    expect(isOverdue({ ...open, due_date: '2026-10-16' })).toBe(false)
  })

  it('is false for a completed task even when its date has passed', () => {
    expect(isOverdue({ ...open, completed: true })).toBe(false)
  })

  it('is false for a task without a due date', () => {
    expect(isOverdue({ ...open, due_date: null })).toBe(false)
  })
})

describe('formatDate', () => {
  it('formats a date as day, short month and year', () => {
    expect(formatDate('2026-10-15')).toBe('15 Oct 2026')
  })

  it('does not shift the date to the previous day', () => {
    expect(formatDate('2026-01-01')).toBe('1 Jan 2026')
  })
})
