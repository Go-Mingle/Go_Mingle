import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DetailRow } from '../components/DetailRow'

describe('DetailRow', () => {
  it('renders default with border', () => {
    render(<DetailRow label="L" value="V" />)
    expect(screen.getByText('L')).toBeInTheDocument()
    expect(screen.getByText('V')).toBeInTheDocument()
  })

  it('noBorder removes border', () => {
    render(
      <DetailRow
        label="L2"
        value="V2"
        noBorder
        labelStyle={{ color: 'red' }}
        valueStyle={{ color: 'blue' }}
      />,
    )
    expect(screen.getByText('L2')).toBeInTheDocument()
  })
})
