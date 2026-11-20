import { useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent, ClipboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

interface OtpInputProps {
  value: string
  onChange: (val: string) => void
  length?: number
  disabled?: boolean
}

/**
 * One box per digit. Focus moves on as each digit lands, in the same event, so
 * fast typing, pasting, or the phone filling the code in (one-time-code
 * autofill) never drops a digit. The latest value is kept in a ref because
 * several keystrokes can arrive before the parent re-renders.
 */
export function OtpInput({ value, onChange, length = 6, disabled = false }: OtpInputProps) {
  const { t } = useTranslation('auth')
  const refs = useRef<Array<HTMLInputElement | null>>(Array.from({ length }, () => null))
  const latest = useRef(value)
  useLayoutEffect(() => {
    latest.current = value
  }, [value])

  const digitsOf = (v: string): string[] => {
    const arr = v.split('').slice(0, length)
    while (arr.length < length) arr.push('')
    return arr
  }

  const emit = (digits: string[]) => {
    // Keep the digits typed so far, up to the first gap.
    const firstGap = digits.indexOf('')
    const joined = (firstGap === -1 ? digits : digits.slice(0, firstGap)).join('')
    latest.current = joined
    onChange(joined)
  }

  const focus = (i: number) => refs.current[Math.max(0, Math.min(i, length - 1))]?.focus()

  /** Several digits at once (paste, autofill): fill from `start`. */
  const fill = (start: number, text: string) => {
    const incoming = text.replace(/\D/g, '').slice(0, length - start)
    if (!incoming) return
    const digits = digitsOf(latest.current)
    incoming.split('').forEach((d, k) => (digits[start + k] = d))
    emit(digits)
    focus(start + incoming.length)
  }

  const handleChange = (index: number, val: string) => {
    const typed = val.replace(/\D/g, '')
    if (typed.length > 1) {
      // Autofill or a fast second key into a full box: spread the digits.
      const existing = digitsOf(latest.current)[index]
      fill(index, existing && typed.startsWith(existing) ? typed.slice(existing.length) : typed)
      return
    }
    const digits = digitsOf(latest.current)
    digits[index] = typed
    emit(digits)
    if (typed && index < length - 1) focus(index + 1)
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const digits = digitsOf(latest.current)
      if (digits[index]) {
        digits[index] = ''
        emit(digits)
      } else if (index > 0) {
        digits[index - 1] = ''
        emit(digits)
        focus(index - 1)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focus(index - 1)
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      focus(index + 1)
    }
  }

  const handlePaste = (index: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    fill(index, e.clipboardData.getData('text'))
  }

  const digits = digitsOf(value)

  return (
    <div className="flex w-full gap-2">
      {Array.from({ length }, (_, idx) => (
        <input
          key={idx}
          ref={(el) => {
            refs.current[idx] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete={idx === 0 ? 'one-time-code' : 'off'}
          aria-label={t('otp.digit', {
            n: idx + 1,
            total: length,
            defaultValue: `Digit ${idx + 1} of ${length}`,
          })}
          value={digits[idx]}
          disabled={disabled}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onPaste={(e) => handlePaste(idx, e)}
          onFocus={(e) => e.target.select()}
          className="h-[52px] min-w-0 flex-1 rounded-[8px] border border-[var(--color-input-border)] bg-[var(--color-input)] text-center text-[20px] font-bold text-[var(--color-text)] transition-[border-color,box-shadow] focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_var(--color-accent-light)] focus:outline-none disabled:opacity-40"
        />
      ))}
    </div>
  )
}
