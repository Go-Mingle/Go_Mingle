import { Input, Button } from 'antd'
import { MagnifyingGlass } from '@phosphor-icons/react'
import type { FilterDropdownProps } from 'antd/es/table/interface'

interface TableSearchFilterProps extends FilterDropdownProps {
  placeholder: string
}

export function TableSearchFilter({
  setSelectedKeys,
  selectedKeys,
  confirm,
  clearFilters,
  placeholder,
}: TableSearchFilterProps) {
  return (
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
          style={{
            borderColor: 'var(--color-border-strong)',
            color: 'var(--color-text-muted)',
            background: 'var(--color-card)',
            borderRadius: 12,
            fontSize: 12,
          }}
        >
          Reset
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
          Search
        </button>
      </div>
    </div>
  )
}
