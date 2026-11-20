import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { TwoStepCodeStep } from '../components/TwoStepCodeStep'

describe('TwoStepCodeStep', () => {
  it('signs in as soon as six digits are typed', async () => {
    const onVerify = vi.fn()
    renderWithProviders(<TwoStepCodeStep onBack={vi.fn()} onVerify={onVerify} />)
    const boxes = screen.getAllByRole('textbox')
    await userEvent.click(boxes[0])
    await userEvent.keyboard('482913')
    expect(onVerify).toHaveBeenCalledWith('482913')
  })

  it('takes a backup code instead, and shows errors', async () => {
    const onVerify = vi.fn()
    renderWithProviders(
      <TwoStepCodeStep onBack={vi.fn()} onVerify={onVerify} error="That code didn't work." />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent("That code didn't work.")
    await userEvent.click(screen.getByRole('button', { name: /backup code/i }))
    const input = screen.getByTestId('two-step-backup')
    await userEvent.type(input, '7kq4-m2xd')
    expect(input).toHaveValue('7KQ4-M2XD')
    await userEvent.click(screen.getByTestId('two-step-verify'))
    expect(onVerify).toHaveBeenCalledWith('7KQ4-M2XD')
  })

  it('goes back to the password step', async () => {
    const onBack = vi.fn()
    renderWithProviders(<TwoStepCodeStep onBack={onBack} onVerify={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(onBack).toHaveBeenCalled()
  })
})
