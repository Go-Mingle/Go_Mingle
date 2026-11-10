import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { NumberField } from '../components/NumberField'

describe('NumberField', () => {
  it('renders the label, helper text, value and the info icon with a range hint', () => {
    const { container } = renderWithProviders(
      <NumberField
        label="PKR per point"
        value={5}
        onChange={() => {}}
        suffix="PKR"
        helper="Helper text"
        min={1}
        max={100}
      />,
    )
    expect(screen.getByText('PKR per point')).toBeInTheDocument()
    expect(screen.getByText('Helper text')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton')).toHaveValue('5')
    // Info icon carries the localised range hint as its accessible label.
    expect(
      container.querySelector('svg[aria-label="Enter a whole number from 1 to 100."]'),
    ).toBeTruthy()
  })

  it('calls onChange with the numeric value when edited', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <NumberField
        label="Points"
        value={5}
        onChange={onChange}
        suffix="pts"
        helper="h"
        min={1}
        max={100}
      />,
    )
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '7' } })
    expect(onChange).toHaveBeenCalledWith(7)
  })
})
