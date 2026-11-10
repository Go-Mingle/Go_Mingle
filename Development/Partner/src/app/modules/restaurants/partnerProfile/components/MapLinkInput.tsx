import { useState } from 'react'
import { Input } from 'antd'
import { MapPin, Warning } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { parseMapLink } from '../mapLink'

const LABEL = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]'

interface MapLinkInputProps {
  latitude: string
  longitude: string
  onChange: (latitude: string, longitude: string) => void
  error?: string
}

/**
 * Sets the map position from a pasted Google Maps link or coordinates. Shown
 * when the interactive map cannot load, so a missing Maps key never leaves the
 * partner unable to complete "Map Location".
 */
export function MapLinkInput({ latitude, longitude, onChange, error }: MapLinkInputProps) {
  const { t } = useTranslation('restaurants')
  const [text, setText] = useState('')
  const parsed = parseMapLink(text)
  const pinned = latitude.trim() !== '' && longitude.trim() !== ''

  const handleChange = (next: string) => {
    setText(next)
    const p = parseMapLink(next)
    if (p.ok) onChange(p.latitude.toFixed(6), p.longitude.toFixed(6))
  }

  const problem = !parsed.ok && parsed.reason !== 'empty' ? t(`profile.mapLink.errors.${parsed.reason}`) : error

  return (
    <div>
      <label htmlFor="map-link" className={LABEL}>
        {t('profile.mapLink.label')}
      </label>
      <Input
        id="map-link"
        size="large"
        className="mt-2"
        value={text}
        status={problem ? 'error' : undefined}
        placeholder={t('profile.mapLink.placeholder')}
        onChange={(e) => handleChange(e.target.value)}
      />
      <div className="mt-1 text-[12px] text-[var(--color-text-subtle)]">{t('profile.mapLink.hint')}</div>
      {problem && <div className="mt-1 text-[12px] text-[var(--color-error)]">{problem}</div>}
      {parsed.ok && !parsed.precise && (
        <div className="mt-1 flex items-start gap-1 text-[12px] text-[var(--color-warning)]">
          <Warning size={14} className="mt-px shrink-0" />
          {t('profile.mapLink.approximate')}
        </div>
      )}
      {pinned && (
        <div className="mt-1.5 flex items-center gap-1 text-[12px] text-[var(--color-text-secondary)]">
          <MapPin size={14} weight="fill" className="text-[var(--color-accent)]" />
          {t('profile.mapLink.pinned', {
            latitude: Number(latitude).toFixed(5),
            longitude: Number(longitude).toFixed(5),
          })}
        </div>
      )}
    </div>
  )
}
