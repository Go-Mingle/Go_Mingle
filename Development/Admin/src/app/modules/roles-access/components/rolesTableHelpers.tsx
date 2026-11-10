import { Input, Button } from 'antd'
import { ArrowUp, ArrowDown, ArrowsDownUp, MagnifyingGlass } from '@phosphor-icons/react'
import i18n from '../../../../locales/i18n'
import type { Role, RoleModule, FilterDropdownProps } from '../types'
import { moduleColours, defaultModuleColour } from '../constants'

export type { Role, FilterDropdownProps }
export { moduleColours, defaultModuleColour }

const tRoles = (key: string): string => i18n.t(key, { ns: 'roles-access' }) as string

// Full module list available for role assignment.
// Configure section (7) followed by Manage section (7) — matches canonical sidebar order.
export const ALL_MODULES: RoleModule[] = [
  // Configure
  { key: 'ROLES_AND_ACCESS', label: tRoles('modules.rolesAccess') },
  { key: 'USERS', label: tRoles('modules.users') },
  { key: 'CATEGORIES', label: tRoles('modules.categories') },
  { key: 'INTEREST_TOPICS', label: tRoles('modules.interestTopics') },
  { key: 'LOYALTY_CONFIGURATION', label: tRoles('modules.loyalty') },
  { key: 'AMENITIES', label: tRoles('modules.amenities') },
  { key: 'PREFERENCE_QUESTIONS', label: tRoles('modules.preferenceQuestions') },
  { key: 'TIMER_SETTINGS', label: tRoles('modules.timerSettings') },
  // Manage
  { key: 'RESTAURANT_APPROVALS', label: tRoles('modules.approvalQueue') },
  { key: 'MANAGE_RESTAURANTS', label: tRoles('modules.restaurants') },
  { key: 'MANAGE_MINGLERS', label: tRoles('modules.minglers') },
  { key: 'BOOKINGS', label: tRoles('modules.booking') },
  { key: 'REVIEWS', label: tRoles('modules.reviews') },
  { key: 'FINANCES', label: tRoles('modules.finances') },
  { key: 'CHANGE_LOG', label: tRoles('modules.changeLog') },
]

export const tableSortIcon = ({ sortOrder }: { sortOrder: 'ascend' | 'descend' | null }) => {
  if (sortOrder === 'ascend') return <ArrowUp size={12} weight="bold" color="var(--color-accent)" />
  if (sortOrder === 'descend')
    return <ArrowDown size={12} weight="bold" color="var(--color-accent)" />
  return <ArrowsDownUp size={12} color="var(--color-text-subtle)" />
}

// Server-side search dropdown for the Role Name column — mirrors
// UsersTable's searchFilterDropdown/searchFilterIcon exactly. No onFilter:
// the roles API does the filtering, so the value is only surfaced via the
// Table's onChange `filters` bag (the parent reads filters['name'] and
// re-queries), never applied to rows locally.
export const searchFilterDropdown =
  (placeholder: string) =>
  ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
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
            borderRadius: 12,
          }}
        >
          {tRoles('filterBtn.reset')}
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
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-dark)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-accent)')}
        >
          {tRoles('filterBtn.search')}
        </button>
      </div>
    </div>
  )

export const searchFilterIcon = (filtered: boolean) => (
  <MagnifyingGlass
    size={14}
    weight={filtered ? 'fill' : 'regular'}
    style={{ color: filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)' }}
  />
)
