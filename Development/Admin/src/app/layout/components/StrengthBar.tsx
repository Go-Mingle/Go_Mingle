import { getStrength, S_COLORS, S_LABELS } from './profileModalHelpers'

export function StrengthBar({ password }: { password: string }) {
  const s = getStrength(password)
  if (!password) return null
  return (
    <div className="mt-1.5 flex gap-1 items-center">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex-1 h-1.5 rounded-[3px] transition-colors duration-200"
          style={{ backgroundColor: i <= s ? S_COLORS[s] : 'var(--color-border)' }}
        />
      ))}
      <span
        className="text-[11px] ml-2 whitespace-nowrap min-w-[36px]"
        style={{ color: S_COLORS[s] }}
      >
        {S_LABELS[s]}
      </span>
    </div>
  )
}
