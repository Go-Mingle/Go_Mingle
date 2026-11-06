// ── shared card class strings ─────────────────────────────────
export const CARD_CLS =
  'bg-(--color-card) border border-(--color-border) rounded-xl shadow-(--shadow-sm) p-4 flex flex-col gap-3'

export const LABEL_CLS =
  'text-[10px] font-semibold uppercase tracking-[0.06em] text-(--color-text-subtle) [font-family:var(--font-ui)] mb-[3px]'

export const VALUE_BASE_CLS = 'text-[13px] [font-family:var(--font-ui)]'

export const ACTION_BTN_CLS =
  'h-[34px] px-[14px] rounded-xl text-xs font-semibold [font-family:var(--font-ui)] inline-flex items-center gap-1.5 cursor-pointer'

// ── getInitials ───────────────────────────────────────────────
export function getInitials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w))
  if (words.length === 0) return '??'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

// ── deterministic avatar colour ───────────────────────────────
const AVATAR_PALETTE = [
  'var(--color-accent)',
  '#F97316',
  '#8B5CF6',
  '#EF4444',
  '#10B981',
  '#3B82F6',
  '#F59E0B',
  '#EC4899',
  '#6366F1',
  '#14B8A6',
]

export function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}
