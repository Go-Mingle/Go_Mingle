import type { TFunction } from 'i18next'
import type { MasterInterestTableItem } from '../types'
import { getProminglerId, getProminglerName } from '../masterListHelpers'
import { ProminglerBadge } from '../../../molecules/ProminglerBadge'

const TONE = {
  secondary: 'text-[var(--color-text-secondary)]',
  muted: 'text-[var(--color-text-subtle)]',
} as const

/**
 * Type scale for grid text. `cell` is the desktop row value; `label` matches the
 * small uppercase caption slot used inside the mobile cards, so a link dropped
 * there keeps the card's hierarchy instead of blowing up to row size.
 */
const SIZE = {
  cell: 'font-[Poppins] text-[14px] font-medium',
  label: 'font-[Poppins] text-[10px] font-semibold uppercase tracking-[0.06em]',
} as const

export type CellSize = keyof typeof SIZE

/** Plain grid text. `muted` is used for the em-dash placeholders. */
export function TextCell({
  value,
  tone = 'secondary',
  size = 'cell',
}: {
  value: string
  tone?: keyof typeof TONE
  size?: CellSize
}) {
  return <span className={`${SIZE[size]} ${TONE[tone]}`}>{value}</span>
}

/**
 * A cell whose value navigates elsewhere when the row carries the target id.
 * Mirrors the Finances link cells: accent + pointer when clickable, plain
 * secondary text otherwise, and always stopping propagation so the row's own
 * click handler doesn't also fire.
 */
export function LinkCell({
  label,
  targetId,
  onClick,
  size = 'cell',
}: {
  label: string
  targetId?: string
  onClick?: (id: string) => void
  size?: CellSize
}) {
  if (!onClick || !targetId) return <TextCell value={label} size={size} />
  return (
    <span
      role="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick(targetId)
      }}
      className={`${SIZE[size]} cursor-pointer text-[var(--color-accent)] hover:underline`}
    >
      {label}
    </span>
  )
}

/**
 * The Promingler cell. Renders "Self Captain" when no Promingler is assigned,
 * and links to the mingler detail page as soon as the API supplies an id —
 * today it sends a bare name, which renders as plain text.
 */
export function ProminglerCell({
  row,
  t,
  onProminglerClick,
}: {
  row: MasterInterestTableItem
  t: TFunction
  onProminglerClick?: (minglerId: string) => void
}) {
  const selfCaptainLabel = t('promingler.selfCaptain')

  // No assigned Promingler — the table is self-captained: no badge, no link.
  if (row.promingler == null) return <TextCell value={selfCaptainLabel} />

  return (
    <span className="inline-flex items-center gap-1.5">
      <LinkCell
        label={getProminglerName(row.promingler, selfCaptainLabel)}
        targetId={getProminglerId(row.promingler)}
        onClick={onProminglerClick}
      />
      <ProminglerBadge verified label={false} />
    </span>
  )
}
