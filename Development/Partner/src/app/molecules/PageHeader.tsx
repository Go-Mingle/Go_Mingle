import { clsx } from 'clsx'

interface PageHeaderProps {
  section?: string
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <div className={clsx('flex items-start justify-between mb-6', className)}>
      <div>
        <h1 className="text-[26px] font-bold text-[var(--color-text)] leading-[1.2] mt-0 mb-0 font-[var(--font-display)]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[14px] font-normal text-[var(--color-text-muted)] mt-1 mb-0">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="ml-4 shrink-0">{action}</div>}
    </div>
  )
}
