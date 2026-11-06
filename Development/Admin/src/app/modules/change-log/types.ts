import type React from 'react'

export type LogRow = Record<string, unknown>

export interface ActionChipConfig {
  bg: string
  color: string
  label: string
}

export interface FilterDropdownProps {
  setSelectedKeys: (keys: React.Key[]) => void
  selectedKeys: React.Key[]
  confirm: () => void
  clearFilters?: () => void
}

export interface ChangeLogEntry {
  id: string
  user: string
  action: string
  target: string
  timestamp: string
  [key: string]: unknown
}
