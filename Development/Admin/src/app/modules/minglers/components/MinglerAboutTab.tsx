import React from 'react'
import { useTranslation } from 'react-i18next'
import { Grid } from 'antd'
import {
  Cake,
  Lightning,
  Heart,
  Baby,
  Buildings,
  Briefcase,
  Sparkle,
  SoccerBall,
  Trophy,
  PawPrint,
  Wallet,
  Brain,
} from '@phosphor-icons/react'
import { OverviewField } from './OverviewField'
import { formatShortDate } from '../../../../shared/utils/dateHelpers'
import type { MinglerIdentity } from './types'

interface MinglerAboutTabProps {
  identity?: MinglerIdentity
}

function NeutralChip({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        background: 'var(--color-divider)',
        color: 'var(--color-text-secondary)',
        borderRadius: 'var(--radius-xs)',
        padding: '3px 10px',
        marginRight: 6,
        marginBottom: 4,
        fontFamily: 'Poppins, sans-serif',
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {label}
    </span>
  )
}

function ValueText({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: 14,
        fontWeight: 500,
        color: 'var(--color-text)',
      }}
    >
      {children}
    </span>
  )
}

function MutedText() {
  return (
    <span
      style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: 14,
        fontWeight: 500,
        color: 'var(--color-text-muted)',
      }}
    >
      —
    </span>
  )
}

function hasInterest(interests: string[] | undefined, keyword: string): boolean {
  if (!interests) return false
  return interests.some((i) => i.toLowerCase().includes(keyword.toLowerCase()))
}

export function MinglerAboutTab({ identity }: MinglerAboutTabProps) {
  const { t } = useTranslation('minglers')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  if (!identity) {
    return (
      <p
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 14,
          color: 'var(--color-text-muted)',
          padding: '24px 0',
        }}
      >
        {t('identity.noIdentity')}
      </p>
    )
  }

  const showFootball = hasInterest(identity.personalInterests, 'football')
  const showCricket = hasInterest(identity.personalInterests, 'cricket')

  const renderList = (values: string[] | undefined) => {
    if (!values || values.length === 0) return <MutedText />
    return (
      <div>
        {values.map((v) => (
          <NeutralChip key={v} label={v} />
        ))}
      </div>
    )
  }

  const renderText = (value: string | undefined) =>
    value ? <ValueText>{value}</ValueText> : <MutedText />

  const rows: Array<{
    icon: React.ElementType
    label: string
    render: () => React.ReactNode
    show?: boolean
  }> = [
    {
      icon: Cake,
      label: t('identity.birthdate'),
      render: () => {
        // Empty fallback: an unparseable birthdate falls through to <MutedText />
        // rather than rendering "Invalid Date".
        const birthdate = formatShortDate(identity.birthdate, '')
        return birthdate ? <ValueText>{birthdate}</ValueText> : <MutedText />
      },
    },
    {
      icon: Lightning,
      label: t('identity.energyDrive'),
      render: () => renderText(identity.energyDrive),
    },
    {
      icon: Heart,
      label: t('identity.relationshipStatus'),
      render: () => renderText(identity.relationshipStatus),
    },
    { icon: Baby, label: t('identity.children'), render: () => renderText(identity.children) },
    {
      icon: Buildings,
      label: t('identity.professionIndustry'),
      render: () => renderText(identity.professionIndustry),
    },
    {
      icon: Briefcase,
      label: t('identity.profession'),
      render: () => renderText(identity.profession),
    },
    {
      icon: Sparkle,
      label: t('identity.personalInterests'),
      render: () => renderList(identity.personalInterests),
    },
    {
      icon: SoccerBall,
      label: t('identity.footballTeam'),
      render: () => renderText(identity.footballTeam),
      show: showFootball,
    },
    {
      icon: Trophy,
      label: t('identity.cricketTeam'),
      render: () => renderText(identity.cricketTeam),
      show: showCricket,
    },
    { icon: PawPrint, label: t('identity.pets'), render: () => renderText(identity.pets) },
    { icon: Wallet, label: t('identity.budget'), render: () => renderText(identity.budget) },
    {
      icon: Brain,
      label: t('identity.enneagramType'),
      render: () => renderText(identity.enneagramType),
    },
  ]

  const visibleRows = rows.filter((r) => r.show !== false)

  return (
    <div
      style={{
        background: 'var(--color-card)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-sm)',
        padding: 24,
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      <h3
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--color-text)',
          margin: 0,
          marginBottom: 12,
        }}
      >
        {t('identity.heading')}
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: '0 16px',
        }}
      >
        {visibleRows.map(({ icon, label, render }) => (
          <OverviewField key={label} IconComp={icon} label={label}>
            {render()}
          </OverviewField>
        ))}
      </div>
    </div>
  )
}
