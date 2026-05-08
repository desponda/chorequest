// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'

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

import { StatusChip } from '../status-chip'

describe('StatusChip', () => {
  it('renders "⏳ awaiting" for pending', () => {
    render(<StatusChip status="pending" />)
    expect(screen.getByText('⏳ awaiting')).toBeInTheDocument()
  })

  it('renders "✓ done" for approved', () => {
    render(<StatusChip status="approved" />)
    expect(screen.getByText('✓ done')).toBeInTheDocument()
  })

  it('renders "✗ retry" for rejected', () => {
    render(<StatusChip status="rejected" />)
    expect(screen.getByText('✗ retry')).toBeInTheDocument()
  })

  it('renders "claimed" for locked', () => {
    render(<StatusChip status="locked" />)
    expect(screen.getByText('claimed')).toBeInTheDocument()
  })
})
