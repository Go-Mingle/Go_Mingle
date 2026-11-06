import { InputNumber, Tooltip } from 'antd'
import { Info } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

interface NumberFieldProps {
  label: string
  value: number
  onChange: (v: number) => void
  suffix: string
  helper: string
  min: number
  /** Inclusive maximum the admin may enter; drives the info hint and clamps input. */
  max: number
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  helper,
  min,
  max,
}: NumberFieldProps) {
  const { t } = useTranslation('loyalty')
  const hint = t('rangeHint', { max: max.toLocaleString() })
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="text-xs font-semibold uppercase tracking-[0.06em] text-(--color-text-muted)">
          {label}
        </label>
        <Tooltip title={hint} placement="top">
          <Info
            size={14}
            aria-label={hint}
            className="shrink-0 cursor-pointer text-(--color-text-subtle) transition-colors hover:text-(--color-accent)"
          />
        </Tooltip>
      </div>
      <div className="w-full">
        <InputNumber
          value={value}
          onChange={(v) => {
            if (v != null) onChange(v)
          }}
          min={min}
          max={max}
          precision={0}
          className="w-full"
          suffix={<span className="text-xs text-(--color-text-subtle)">{suffix}</span>}
        />
      </div>
      <p className="mt-1.5 mb-0 text-xs text-(--color-text-muted)">{helper}</p>
    </div>
  )
}
