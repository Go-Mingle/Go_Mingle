import { useRef } from 'react'
import type { KeyboardEvent, ClipboardEvent } from 'react'

interface OtpInputProps {
  value: string
  onChange: (val: string) => void
  length?: number
  disabled?: boolean
}

export function OtpInput({ value, onChange, length = 6, disabled = false }: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>(Array.from({ length }, () => null))

  const getDigits = (): string[] => {
    const arr = value.split('').slice(0, length)
    while (arr.length < length) arr.push('')
    return arr
  }

  const updateDigit = (index: number, char: string) => {
    const digits = getDigits()
    digits[index] = char
    let joined = digits.join('')
    while (joined.endsWith(' ')) joined = joined.slice(0, -1)
    onChange(joined)
    if (char && index < length - 1) {
      setTimeout(() => refs.current[index + 1]?.focus(), 0)
    }
  }

  const handleChange = (index: number, val: string) => {
    const char = val.replace(/\D/g, '').slice(-1)
    updateDigit(index, char)
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const digits = getDigits()
      if (digits[index]) {
        updateDigit(index, '')
      } else if (index > 0) {
        const d = getDigits()
        d[index - 1] = ''
        onChange(d.join(''))
        setTimeout(() => refs.current[index - 1]?.focus(), 0)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      refs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    onChange(pasted)
    const focusIdx = Math.min(pasted.length, length - 1)
    setTimeout(() => refs.current[focusIdx]?.focus(), 0)
  }

  const digits = getDigits()

  return (
    <div className="flex gap-2 w-full">
      {Array.from({ length }, (_, idx) => (
        <input
          key={idx}
          ref={(el) => {
            refs.current[idx] = el
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[idx]}
          disabled={disabled}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onPaste={idx === 0 ? handlePaste : undefined}
          onFocus={(e) => e.target.select()}
          className="flex-1 min-w-0 h-[52px] text-center text-[20px] font-bold text-[var(--color-text)] border border-[var(--color-input-border)] rounded-[8px] focus:outline-none focus:border-[var(--color-accent)] transition-all disabled:opacity-40 bg-[var(--color-input)]"
          onFocusCapture={(e) => {
            ;(e.target as HTMLInputElement).style.borderColor = 'var(--color-accent)'
            ;(e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(15,167,157,0.15)'
          }}
          onBlur={(e) => {
            ;(e.target as HTMLInputElement).style.borderColor = ''
            ;(e.target as HTMLInputElement).style.boxShadow = ''
          }}
        />
      ))}
    </div>
  )
}
