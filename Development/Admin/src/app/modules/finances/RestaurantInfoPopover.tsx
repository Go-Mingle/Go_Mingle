import React from 'react'
import { MapPin, Envelope as Mail } from '@phosphor-icons/react'

export interface RestaurantInfo {
  name: string
  email?: string
  address: string
  city: string
}

export const RestaurantInfoPopover: React.FC<{ info: RestaurantInfo }> = ({ info }) => (
  <div className="py-1 min-w-60">
    <div className="text-[15px] font-bold text-(--color-text) pb-3 mb-3 border-b border-(--color-divider)">
      {info.name}
    </div>
    <div
      className={`flex items-start gap-2 py-1.5 ${info.email ? 'border-b border-(--color-divider)' : ''}`}
    >
      <MapPin size={13} color="var(--color-accent)" className="shrink-0 mt-0.5" />
      <div>
        <div className="text-[13px] text-(--color-text-secondary)">{info.address}</div>
        <div className="text-xs text-(--color-text-muted) mt-0.5">{info.city}</div>
      </div>
    </div>
    {info.email && (
      <div className="flex items-center gap-2 py-1.5">
        <Mail size={13} color="var(--color-text-muted)" className="shrink-0" />
        <a href={`mailto:${info.email}`} className="text-[13px] text-accent no-underline">
          {info.email}
        </a>
      </div>
    )}
  </div>
)
