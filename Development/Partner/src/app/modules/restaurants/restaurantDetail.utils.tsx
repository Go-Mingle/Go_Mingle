/* eslint-disable react-refresh/only-export-components */
import { clsx } from 'clsx'
import {
  FileText,
  Image,
  FileXls as FileSpreadsheet,
  File,
  PencilSimple,
} from '@phosphor-icons/react'
import { CardEditButton } from './components/CardEditButton'

// `StarRating` moved to `src/app/atoms/StarRating.tsx` with J6G — it is a display
// primitive with no restaurant-detail dependency, and it now has a second consumer.

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
      className={`text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)] mb-3 ${
        first ? 'mt-0' : 'mt-5'
      }`}
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
      className={`py-3 ${noBorder ? '' : 'border-b border-[var(--color-divider)]'} ${
        fullWidth ? 'col-span-full' : ''
      }`}
    >
      <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)] mb-1">
        {label}
      </span>
      <div className="text-sm text-[var(--color-text)]">{value}</div>
    </div>
  )
}

export function SectionCard({
  title,
  titleSuffix,
  className,
  editAriaLabel,
  children,
  edit,
  onEdit,
}: {
  title: string
  /** Rendered inside the heading after the title — e.g. a "needs attention" badge. */
  titleSuffix?: React.ReactNode
  /** Extra classes on the card shell — e.g. an attention border. */
  className?: string
  /** Overrides the pencil's aria-label so callers can supply translated copy. */
  editAriaLabel?: string
  children: React.ReactNode
  edit?: React.ComponentProps<typeof CardEditButton>['edit']
  /** When provided, the pencil calls this instead of opening the built-in edit modal. */
  onEdit?: () => void
}) {
  return (
    <div
      className={clsx(
        'bg-[var(--color-card)] rounded-[var(--radius-lg)] p-4 md:p-6 shadow-[var(--shadow-sm)] mb-3 md:mb-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 mt-0 mb-4">
        <h3 className="text-sm font-semibold text-[var(--color-text)] m-0">
          {title}
          {titleSuffix}
        </h3>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            aria-label={editAriaLabel ?? `Edit ${title}`}
            className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center text-[var(--color-text-subtle)] md:hover:bg-[var(--color-hover-neutral)] md:hover:text-[var(--color-text)] bg-transparent border-none cursor-pointer"
          >
            <PencilSimple size={16} />
          </button>
        ) : edit ? (
          <CardEditButton title={title} edit={edit} />
        ) : null}
      </div>
      {children}
    </div>
  )
}
