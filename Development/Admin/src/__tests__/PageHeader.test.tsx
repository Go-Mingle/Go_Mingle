import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from '../app/molecules/PageHeader'

describe('PageHeader', () => {
  it('renders title', () => {
    render(<PageHeader title="My Page" />)
    expect(screen.getByText('My Page')).toBeTruthy()
  })

  it('does not render section label', () => {
    render(<PageHeader section="CONFIGURE" title="My Page" />)
    expect(screen.queryByText('CONFIGURE')).toBeNull()
    expect(screen.getByText('My Page')).toBeTruthy()
  })

  it('renders subtitle when provided', () => {
    render(<PageHeader title="Dashboard" subtitle="Welcome to the admin portal" />)
    expect(screen.getByText('Welcome to the admin portal')).toBeTruthy()
  })

  it('does not render subtitle when omitted', () => {
    render(<PageHeader title="Dashboard" />)
    expect(screen.queryByText(/subtitle/)).toBeNull()
  })

  it('renders action when provided', () => {
    render(<PageHeader title="Users" action={<button>+ New user</button>} />)
    expect(screen.getByRole('button', { name: '+ New user' })).toBeTruthy()
  })

  it('does not render action slot when omitted', () => {
    const { container } = render(<PageHeader title="Title" />)
    const actionDiv = container.querySelector('.shrink-0')
    expect(actionDiv).toBeNull()
  })

  it('applies custom className to wrapper', () => {
    const { container } = render(<PageHeader title="T" className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
