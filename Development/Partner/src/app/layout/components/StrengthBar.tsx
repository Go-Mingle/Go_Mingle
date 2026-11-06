import type { CSSProperties } from 'react'
import { getStrength, S_COLORS, S_LABELS } from './profileModalHelpers'

export function StrengthBar({ password }: { password: string }) {
  const s = getStrength(password)
  if (!password) return null
  return (
    <div className="mt-1.5 flex gap-1 items-center">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex-1 h-1.5 rounded-[4px] transition-colors duration-200 bg-[var(--seg-color)]"
          style={{ '--seg-color': i <= s ? S_COLORS[s] : 'var(--color-border)' } as CSSProperties}
        />
      ))}
      <span
        className="text-[11px] ml-2 whitespace-nowrap min-w-[36px] text-[var(--lbl-color)]"
        style={{ '--lbl-color': S_COLORS[s] } as CSSProperties}
      >
        {S_LABELS[s]}
      </span>
    </div>
  )
}
