import React from 'react'
import { Input, Button } from 'antd'
import { MagnifyingGlass } from '@phosphor-icons/react'
import type { Interest } from '../types'

const greyBtnStyle: React.CSSProperties = {
  borderColor: 'var(--color-border-strong)',
  color: 'var(--color-text-muted)',
  borderRadius: 12,
}

const accentBtnStyle: React.CSSProperties = {
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
}

type FilterDropdownProps = {
  setSelectedKeys: (keys: React.Key[]) => void
  selectedKeys: React.Key[]
  confirm: () => void
  clearFilters?: () => void
}

export function makeSearchFilter(placeholder: string, dataIndex: keyof Interest) {
  return {
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }: FilterDropdownProps) => (
      <div style={{ padding: 12, width: 240 }}>
        <Input
          autoFocus
          prefix={<MagnifyingGlass size={14} style={{ color: 'var(--color-text-subtle)' }} />}
          placeholder={placeholder}
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
            style={greyBtnStyle}
          >
            Reset
          </Button>
          <button
            onClick={() => confirm()}
            style={accentBtnStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-dark)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-accent)')}
          >
            Search
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
    onFilter: (value: unknown, record: Interest) =>
      String(record[dataIndex] ?? '')
        .toLowerCase()
        .includes(String(value).toLowerCase()),
  }
}
