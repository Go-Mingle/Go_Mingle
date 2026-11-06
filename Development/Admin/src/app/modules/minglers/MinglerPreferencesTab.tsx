import React from 'react'
import { useTranslation } from 'react-i18next'

export interface Preferences {
  diningExperience: string
  cuisines: string[]
  diningFrequency: string
  avgSpend: string
  dietaryRequirements: string[]
  preferredTime: string
  atmosphere: string[]
  groupDining: 'Yes' | 'No'
}

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-block bg-[var(--color-accent-light)] text-[var(--color-accent-dark)] rounded-[var(--radius-xs)] px-[10px] py-[3px] text-xs font-medium mr-1.5 mb-1">
      {label}
    </span>
  )
}

interface Props {
  preferences: Preferences
}

export function MinglerPreferencesTab({ preferences: prefs }: Props) {
  const { t } = useTranslation('minglers')
  const prefQA: { q: string; render: () => React.ReactNode }[] = [
    {
      q: t('about.diningExperience'),
      render: () => <Chip label={prefs.diningExperience} />,
    },
    {
      q: t('about.cuisines'),
      render: () => (
        <>
          {prefs.cuisines.map((c) => (
            <Chip key={c} label={c} />
          ))}
        </>
      ),
    },
    { q: t('about.diningFrequency'), render: () => <Chip label={prefs.diningFrequency} /> },
    { q: t('about.avgSpend'), render: () => <Chip label={prefs.avgSpend} /> },
    {
      q: t('about.dietary'),
      render: () =>
        prefs.dietaryRequirements.length === 1 &&
        prefs.dietaryRequirements[0] === 'No Restrictions' ? (
          <span className="text-[13px] text-[var(--color-text-secondary)]">
            {t('about.noRestrictions')}
          </span>
        ) : (
          <>
            {prefs.dietaryRequirements.map((d) => (
              <Chip key={d} label={d} />
            ))}
          </>
        ),
    },
    { q: t('about.preferredTime'), render: () => <Chip label={prefs.preferredTime} /> },
    {
      q: t('about.atmosphere'),
      render: () => (
        <>
          {prefs.atmosphere.map((a) => (
            <Chip key={a} label={a} />
          ))}
        </>
      ),
    },
    {
      q: t('about.groupDining'),
      render: () => (
        <span
          className="inline-block rounded-[var(--radius-xs)] px-[10px] py-[3px] text-xs font-medium"
          style={{
            background:
              prefs.groupDining === 'Yes' ? 'var(--color-success-bg)' : 'var(--color-divider)',
            color: prefs.groupDining === 'Yes' ? 'var(--color-success)' : 'var(--color-text-muted)',
          }}
        >
          {prefs.groupDining}
        </span>
      ),
    },
  ]

  return (
    <div className="p-6">
      <div className="bg-[var(--color-card)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)]">
        <h3 className="text-sm font-semibold text-[var(--color-text)] m-0 mb-5">
          {t('about.diningPreferences')}
        </h3>
        <div className="flex flex-col gap-4">
          {prefQA.map(({ q, render }) => (
            <div key={q} className="border-b border-[var(--color-divider)] pb-[14px]">
              <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)] mb-2">
                {q}
              </span>
              <div>{render()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
