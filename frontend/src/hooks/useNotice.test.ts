import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotice } from './useNotice'

it('starts without a notice and exposes a notification callback', () => {
  const { result } = renderHook(() => useNotice())
  expect(result.current.message).toBe('')
  expect(result.current.notify).toEqual(expect.any(Function))
})

describe('notify', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the message passed to notify', () => {
    const { result } = renderHook(() => useNotice())
    act(() => result.current.notify('Task saved.'))
    expect(result.current.message).toBe('Task saved.')
  })

  it('clears the message after four seconds', () => {
    const { result } = renderHook(() => useNotice())
    act(() => result.current.notify('Task saved.'))
    act(() => vi.advanceTimersByTime(3999))
    expect(result.current.message).toBe('Task saved.')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.message).toBe('')
  })

  it('restarts the four-second timer when a new message replaces the old one', () => {
    const { result } = renderHook(() => useNotice())
    act(() => result.current.notify('First'))
    act(() => vi.advanceTimersByTime(3000))
    act(() => result.current.notify('Second'))
    act(() => vi.advanceTimersByTime(3000))
    expect(result.current.message).toBe('Second')
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.message).toBe('')
  })
})
