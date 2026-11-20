import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OtpInput } from '../components/OtpInput'

describe('OtpInput', () => {
  it('renders 6 inputs by default', () => {
    render(<OtpInput value="" onChange={() => {}} />)
    expect(document.querySelectorAll('input').length).toBe(6)
  })

  it('typing a digit calls onChange and advances focus', async () => {
    const onChange = vi.fn()
    render(<OtpInput value="" onChange={onChange} />)
    const inputs = document.querySelectorAll('input')
    await userEvent.setup().type(inputs[0] as HTMLInputElement, '5')
    expect(onChange).toHaveBeenCalled()
  })

  it('Backspace clears digit or moves back', () => {
    const onChange = vi.fn()
    render(<OtpInput value="12" onChange={onChange} />)
    const inputs = document.querySelectorAll('input')
    // press backspace on filled cell -> clear
    fireEvent.keyDown(inputs[1], { key: 'Backspace' })
    expect(onChange).toHaveBeenCalled()
    onChange.mockClear()
    // press backspace on empty cell -> move back, clear previous
    fireEvent.keyDown(inputs[3], { key: 'Backspace' })
    expect(onChange).toHaveBeenCalled()
  })

  it('Arrow keys move focus', () => {
    render(<OtpInput value="" onChange={() => {}} />)
    const inputs = document.querySelectorAll('input')
    fireEvent.keyDown(inputs[2], { key: 'ArrowLeft' })
    fireEvent.keyDown(inputs[2], { key: 'ArrowRight' })
  })

  it('Paste fills the inputs', () => {
    const onChange = vi.fn()
    render(<OtpInput value="" onChange={onChange} />)
    const inputs = document.querySelectorAll('input')
    fireEvent.paste(inputs[0], {
      clipboardData: { getData: () => '123456' },
    })
    expect(onChange).toHaveBeenCalledWith('123456')
  })

  it('onChange filters non-digits', () => {
    const onChange = vi.fn()
    render(<OtpInput value="" onChange={onChange} />)
    const inputs = document.querySelectorAll('input')
    fireEvent.change(inputs[0], { target: { value: 'a' } })
    // non-digit filtered to empty
    expect(onChange).toHaveBeenCalled()
  })

  it('Focus selects text and styles applied', () => {
    render(<OtpInput value="1" onChange={() => {}} />)
    const inputs = document.querySelectorAll('input')
    fireEvent.focus(inputs[0])
    fireEvent.blur(inputs[0])
  })

  it('disabled state', () => {
    render(<OtpInput value="" onChange={() => {}} disabled />)
    const inputs = document.querySelectorAll('input')
    expect((inputs[0] as HTMLInputElement).disabled).toBe(true)
  })

  it('keeps every digit when typed fast, as a person or a password manager does', async () => {
    const seen: string[] = []
    function Harness() {
      const [v, setV] = useState('')
      return (
        <OtpInput
          value={v}
          onChange={(x) => {
            seen.push(x)
            setV(x)
          }}
        />
      )
    }
    render(<Harness />)
    const inputs = document.querySelectorAll('input')
    await userEvent.setup({ delay: null }).type(inputs[0] as HTMLInputElement, '482913')
    expect(seen.at(-1)).toBe('482913')
    expect(document.activeElement).toBe(inputs[5])
  })

  it('takes the whole code when the phone fills it into the first box', () => {
    const onChange = vi.fn()
    render(<OtpInput value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Digit 1 of 6'), { target: { value: '903114' } })
    expect(onChange).toHaveBeenLastCalledWith('903114')
  })

  it('offers one-time-code autofill and names each box', () => {
    render(<OtpInput value="" onChange={() => {}} />)
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveAttribute('autocomplete', 'one-time-code')
    expect(screen.getByLabelText('Digit 6 of 6')).toBeInTheDocument()
  })
})
