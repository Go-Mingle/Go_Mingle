import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { fileIcon, GroupLabel, FieldCell, SectionCard } from '../restaurantDetail.utils'

// `StarRating` moved to `src/app/atoms/StarRating.tsx` with J6G; its tests moved with
// it to `src/app/atoms/__tests__/StarRating.test.tsx`.

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
    renderWithProviders(
      <SectionCard title="Section">
        <span>Body</span>
      </SectionCard>,
    )
    expect(screen.getByText('Section')).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
  })

  it('appends a heading suffix and extra shell classes', () => {
    renderWithProviders(
      <SectionCard title="Section" titleSuffix={<em>needs attention</em>} className="ring-1">
        <span>Body</span>
      </SectionCard>,
    )

    // Adjacent JSX children, so the accessible name has no separator between them.
    const heading = screen.getByRole('heading', { level: 3 })
    expect(heading).toHaveTextContent('Section')
    expect(within(heading).getByText('needs attention')).toBeInTheDocument()
    expect(screen.getByText('Body').parentElement).toHaveClass('ring-1')
  })

  /** Defaults to English so the prototype tabs keep working untranslated. */
  it('labels the pencil from the title, or from the override when given', () => {
    const { unmount } = renderWithProviders(
      <SectionCard title="Section" onEdit={() => {}}>
        <span>Body</span>
      </SectionCard>,
    )
    expect(screen.getByRole('button', { name: 'Edit Section' })).toBeInTheDocument()
    unmount()

    renderWithProviders(
      <SectionCard title="Section" editAriaLabel="Modifier la section" onEdit={() => {}}>
        <span>Body</span>
      </SectionCard>,
    )
    expect(screen.getByRole('button', { name: 'Modifier la section' })).toBeInTheDocument()
  })
})
