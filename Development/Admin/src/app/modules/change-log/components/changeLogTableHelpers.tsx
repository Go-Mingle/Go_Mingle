import React from 'react'
import { Input, Button } from 'antd'
import { ArrowUp, ArrowDown, ArrowsDownUp, Funnel, MagnifyingGlass } from '@phosphor-icons/react'
import i18n from '../../../../locales/i18n'
import type { LogRow, FilterDropdownProps, ActionChipConfig } from '../types'

export type { LogRow, FilterDropdownProps, ActionChipConfig }

const tLog = (key: string): string => i18n.t(key, { ns: 'change-log' }) as string

// Solid fill + white text — consistent with the restaurant listing tags.
export const ACTION_CONFIG: Record<string, ActionChipConfig> = {
  create: { bg: 'var(--color-info)', color: '#ffffff', label: tLog('actions.create') },
  update: { bg: 'var(--color-warning)', color: '#ffffff', label: tLog('actions.update') },
  delete: { bg: 'var(--color-error)', color: '#ffffff', label: tLog('actions.delete') },
}

export const tableSortIcon = ({ sortOrder }: { sortOrder: 'ascend' | 'descend' | null }) => {
  if (sortOrder === 'ascend') return <ArrowUp size={12} weight="bold" color="var(--color-accent)" />
  if (sortOrder === 'descend')
    return <ArrowDown size={12} weight="bold" color="var(--color-accent)" />
  return <ArrowsDownUp size={12} color="var(--color-text-subtle)" />
}

export const funnelIcon = (filtered: boolean) => (
  <Funnel
    size={14}
    weight={filtered ? 'fill' : 'regular'}
    style={{ color: filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)' }}
  />
)

export const makeSearchFilter = (placeholder: string, dataIndex: string) => ({
  filterDropdown: ({
    setSelectedKeys,
    selectedKeys,
    confirm,
    clearFilters,
  }: FilterDropdownProps) => (
    <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Input
        placeholder={placeholder}
        value={selectedKeys[0] as string}
        onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
        onPressEnter={() => confirm()}
        size="small"
        style={{ width: 180 }}
      />
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <Button
          size="small"
          onClick={() => {
            clearFilters?.()
            confirm()
          }}
        >
          {tLog('filterBtn.reset')}
        </Button>
        <button
          className="btn-primary"
          style={{
            height: 24,
            padding: '0 8px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onClick={() => confirm()}
        >
          {tLog('filterBtn.search')}
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
  onFilter: (value: React.Key | boolean, record: LogRow) =>
    String(record[dataIndex] ?? '')
      .toLowerCase()
      .includes(String(value).toLowerCase()),
})
