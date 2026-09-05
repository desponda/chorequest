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
  it('renders "Pending" for pending', () => {
    render(<StatusChip status="pending" />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('renders "Earned" for approved', () => {
    render(<StatusChip status="approved" />)
    expect(screen.getByText('Earned')).toBeInTheDocument()
  })

  it('renders "Retry" for rejected', () => {
    render(<StatusChip status="rejected" />)
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('renders "Claimed" for locked', () => {
    render(<StatusChip status="locked" />)
    expect(screen.getByText('Claimed')).toBeInTheDocument()
  })
})
