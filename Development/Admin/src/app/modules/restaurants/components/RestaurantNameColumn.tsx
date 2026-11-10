import { ImageWithFallback } from '../../../atoms/ImageWithFallback'
import { Input, Button } from 'antd'
import type { ColumnType } from 'antd/es/table'
import { MagnifyingGlass } from '@phosphor-icons/react'
import type { TFunction } from 'i18next'
import type { Restaurant } from './restaurantsPage.types'
import { tableSortIcon } from './RestaurantsTableIcons'

function getInitials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w))
  if (words.length === 0) return '??'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export const buildRestaurantNameColumn = (t: TFunction): ColumnType<Restaurant> => ({
  title: t('restaurants:table.headers.name'),
  dataIndex: 'name',
  key: 'restaurant',
  sorter: true,
  sortIcon: tableSortIcon,
  filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
    <div style={{ padding: 12, width: 240 }}>
      <Input
        autoFocus
        prefix={<MagnifyingGlass size={14} style={{ color: 'var(--color-text-subtle)' }} />}
        placeholder={t('restaurants:table.search.restaurants')}
        value={selectedKeys[0] as string}
        onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
        onPressEnter={() => confirm()}
        style={{ marginBottom: 8, borderRadius: 12 }}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button
          size="small"
          onClick={() => {
            clearFilters?.()
            confirm()
          }}
          style={{
            borderColor: 'var(--color-border-strong)',
            color: 'var(--color-text-muted)',
            background: 'var(--color-card)',
            borderRadius: 12,
            fontSize: 12,
          }}
        >
          {t('restaurants:table.search.reset')}
        </Button>
        <button
          onClick={() => confirm()}
          style={{
            height: 28,
            padding: '0 12px',
            background: 'var(--color-accent)',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            fontFamily: 'Poppins, sans-serif',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 150ms ease-out',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-dark)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-accent)')}
        >
          {t('restaurants:table.search.search')}
        </button>
      </div>
    </div>
  ),
  filterIcon: (filtered: boolean) => (
    <MagnifyingGlass
      size={14}
      weight={filtered ? 'fill' : 'regular'}
      style={{ color: filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)' }}
    />
  ),
  render: (_, record) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <ImageWithFallback
        src={record.avatarUrl}
        alt={record.name}
        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        fallback={
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: record.avatarColor,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.03em',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            {getInitials(record.name)}
          </div>
        }
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text)',
            fontFamily: 'Poppins, sans-serif',
          }}
        >
          {record.name}
        </span>
        <span
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text-muted)',
          }}
        >
          {record.cuisine}
        </span>
      </div>
    </div>
  ),
})
