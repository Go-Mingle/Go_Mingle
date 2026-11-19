import React from 'react'

interface DetailRowProps {
  label: string
  value: React.ReactNode
  noBorder?: boolean
  labelStyle?: React.CSSProperties
  valueStyle?: React.CSSProperties
}

export function DetailRow({ label, value, noBorder, labelStyle, valueStyle }: DetailRowProps) {
  return (
    <div
      className={`flex items-center justify-between min-h-11 py-2 ${
        noBorder ? '' : 'border-b border-[var(--color-divider)]'
      }`}
    >
      <span
        className="text-[13px] text-[var(--color-text-muted)] font-(--font-ui)"
        style={labelStyle}
      >
        {label}
      </span>
      <span className="text-[13px] text-[var(--color-text)] font-(--font-ui)" style={valueStyle}>
        {value}
      </span>
    </div>
  )
}
