/* eslint-disable react-refresh/only-export-components */
import { Star, FileText, Image, FileXls as FileSpreadsheet, File } from '@phosphor-icons/react'

export function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-[2px]">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className="shrink-0"
          fill={i <= rating ? '#F59E0B' : 'none'}
          stroke={i <= rating ? '#F59E0B' : 'var(--color-border-strong)'}
        />
      ))}
    </span>
  )
}

export function fileIcon(ext: string) {
  const e = ext.toLowerCase()
  if (e === 'pdf' || e === 'doc' || e === 'docx')
    return <FileText size={20} className="text-[var(--color-text-muted)] shrink-0" />
  if (e === 'jpg' || e === 'jpeg' || e === 'png' || e === 'gif' || e === 'webp')
    return <Image size={20} className="text-[var(--color-text-muted)] shrink-0" />
  if (e === 'xls' || e === 'xlsx' || e === 'csv')
    return <FileSpreadsheet size={20} className="text-[var(--color-text-muted)] shrink-0" />
  return <File size={20} className="text-[var(--color-text-muted)] shrink-0" />
}

export function GroupLabel({ title, first }: { title: string; first?: boolean }) {
  return (
    <p
      className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)] mb-3"
      style={{ marginTop: first ? 0 : 20 }}
    >
      {title}
    </p>
  )
}

export function FieldCell({
  label,
  value,
  noBorder = false,
  fullWidth = false,
}: {
  label: string
  value: React.ReactNode
  noBorder?: boolean
  fullWidth?: boolean
}) {
  return (
    <div
      className="py-3"
      style={{
        borderBottom: noBorder ? 'none' : '1px solid var(--color-divider)',
        gridColumn: fullWidth ? '1 / -1' : undefined,
      }}
    >
      <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)] mb-1">
        {label}
      </span>
      <div className="text-sm text-[var(--color-text)]">{value}</div>
    </div>
  )
}

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-card)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)] mb-4">
      <h3 className="text-sm font-semibold text-[var(--color-text)] mt-0 mb-4">{title}</h3>
      {children}
    </div>
  )
}
