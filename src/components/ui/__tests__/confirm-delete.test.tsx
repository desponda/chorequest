// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, prop: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Tag = prop as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ({ children, ...rest }: any) => React.createElement(Tag, rest, children)
    },
  }),
}))

import { ConfirmDelete } from '../confirm-delete'

describe('ConfirmDelete', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('first tap reveals the confirm prompt but does not call onConfirm', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDelete onConfirm={onConfirm} ariaLabel="Delete item" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete item' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Sure\? Delete/ })).toBeInTheDocument()
  })

  it('second tap on the prompt commits onConfirm', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDelete onConfirm={onConfirm} ariaLabel="Delete item" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete item' }))
    fireEvent.click(screen.getByRole('button', { name: /Sure\? Delete/ }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('Cancel button disarms without calling onConfirm', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDelete onConfirm={onConfirm} ariaLabel="Delete item" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete item' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Delete item' })).toBeInTheDocument()
  })

  it('auto-disarms after the timeout if neither tapped', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDelete onConfirm={onConfirm} ariaLabel="Delete item" timeoutMs={2000} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete item' }))
    expect(screen.getByRole('button', { name: /Sure\? Delete/ })).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(2100)
    })
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Delete item' })).toBeInTheDocument()
  })
})
