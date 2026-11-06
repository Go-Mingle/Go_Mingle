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
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: noBorder ? 'none' : '1px solid var(--color-divider)',
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: 'var(--color-text-muted)',
          fontFamily: 'Poppins, sans-serif',
          ...labelStyle,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          color: 'var(--color-text)',
          fontFamily: 'Poppins, sans-serif',
          ...valueStyle,
        }}
      >
        {value}
      </span>
    </div>
  )
}
