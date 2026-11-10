import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { RoleName } from '../components/RoleName'

describe('RoleName', () => {
  it('renders the role name when present', () => {
    renderWithProviders(<RoleName name="Operations Manager" />)
    expect(screen.getByText('Operations Manager')).toBeInTheDocument()
    expect(screen.queryByText(/role deleted/i)).not.toBeInTheDocument()
  })

  it('trims surrounding whitespace', () => {
    renderWithProviders(<RoleName name="  Finance Manager  " />)
    expect(screen.getByText('Finance Manager')).toBeInTheDocument()
  })

  // A-02 — the API returns role.name: "" for an administrator orphaned onto a
  // soft-deleted role. The roster previously rendered a blank cell, which the
  // pentest report calls out as leaving the condition invisible to operators.
  it('flags an empty role name as deleted instead of rendering blank', () => {
    renderWithProviders(<RoleName name="" />)
    expect(screen.getByText(/role deleted/i)).toBeInTheDocument()
  })

  it('flags a whitespace-only role name as deleted', () => {
    renderWithProviders(<RoleName name="   " />)
    expect(screen.getByText(/role deleted/i)).toBeInTheDocument()
  })

  it('flags a null role name as deleted', () => {
    renderWithProviders(<RoleName name={null} />)
    expect(screen.getByText(/role deleted/i)).toBeInTheDocument()
  })

  it('flags an undefined role name as deleted', () => {
    renderWithProviders(<RoleName name={undefined} />)
    expect(screen.getByText(/role deleted/i)).toBeInTheDocument()
  })
})
