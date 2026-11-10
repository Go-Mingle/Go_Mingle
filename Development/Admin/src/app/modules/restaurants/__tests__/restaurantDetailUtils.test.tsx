import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StarRating, fileIcon, GroupLabel, FieldCell, SectionCard } from '../restaurantDetail.utils'

describe('StarRating', () => {
  it.each([0, 1, 3, 5])('renders %d stars', (n) => {
    const { container } = render(<StarRating rating={n} />)
    expect(container.querySelectorAll('svg')).toHaveLength(5)
  })

  it('respects size prop', () => {
    const { container } = render(<StarRating rating={3} size={20} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})

describe('fileIcon', () => {
  it.each(['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp', 'xls', 'xlsx', 'csv', 'zip'])(
    'returns svg for %s',
    (ext) => {
      const { container } = render(<>{fileIcon(ext)}</>)
      expect(container.querySelector('svg')).toBeInTheDocument()
    },
  )
})

describe('GroupLabel', () => {
  it('renders with first prop', () => {
    render(<GroupLabel title="T1" first />)
    expect(screen.getByText('T1')).toBeInTheDocument()
  })

  it('renders without first', () => {
    render(<GroupLabel title="T2" />)
    expect(screen.getByText('T2')).toBeInTheDocument()
  })
})

describe('FieldCell', () => {
  it('renders default', () => {
    render(<FieldCell label="L" value="V" />)
    expect(screen.getByText('L')).toBeInTheDocument()
    expect(screen.getByText('V')).toBeInTheDocument()
  })

  it('renders fullWidth and noBorder', () => {
    render(<FieldCell label="L2" value="V2" fullWidth noBorder />)
    expect(screen.getByText('L2')).toBeInTheDocument()
  })
})

describe('SectionCard', () => {
  it('renders title and children', () => {
    render(
      <SectionCard title="Section">
        <span>Body</span>
      </SectionCard>,
    )
    expect(screen.getByText('Section')).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
  })
})
