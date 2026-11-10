import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RestaurantInfoPopover } from '../RestaurantInfoPopover'

describe('RestaurantInfoPopover', () => {
  it('renders fields', () => {
    render(
      <RestaurantInfoPopover
        info={{ name: 'R', email: 'r@e.com', address: '123 St', city: 'NYC' }}
      />,
    )
    expect(screen.getByText('R')).toBeInTheDocument()
    expect(screen.getByText('123 St')).toBeInTheDocument()
    expect(screen.getByText('NYC')).toBeInTheDocument()
    expect(screen.getByText('r@e.com')).toBeInTheDocument()
  })
})
