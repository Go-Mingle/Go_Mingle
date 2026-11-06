import React from 'react'
import { clsx } from 'clsx'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: boolean
}

interface CardHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-[var(--color-card)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)]',
        padding ? 'p-6' : 'overflow-hidden',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between border-b border-[var(--color-border)] mb-5 pb-4">
      <div>
        <p className="text-[15px] font-semibold text-[var(--color-text)] m-0">{title}</p>
        {subtitle && (
          <p className="text-xs text-[var(--color-text-muted)] mt-[2px] mb-0">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

interface MetricCardProps {
  label: string
  value: React.ReactNode
  trend?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export function MetricCard({ label, value, trend, icon, className }: MetricCardProps) {
  return (
    <div
      className={clsx(
        'bg-[var(--color-card)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-6',
        className,
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          {label}
        </span>
        {icon && (
          <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-accent-light)] flex items-center justify-center text-[var(--color-accent)] shrink-0">
            {icon}
          </div>
        )}
      </div>
      <div className="text-[28px] font-bold text-[var(--color-text)] leading-none">{value}</div>
      {trend && <div className="mt-2 text-xs">{trend}</div>}
    </div>
  )
}
