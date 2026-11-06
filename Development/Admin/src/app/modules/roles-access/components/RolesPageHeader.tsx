import { Plus } from '@phosphor-icons/react'
import { AppButton } from '../../../atoms/AppButton'

interface RolesPageHeaderProps {
  onNew: () => void
}

export function RolesPageHeader({ onNew }: RolesPageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
      }}
    >
      <h1
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: 'var(--color-text)',
          fontFamily: 'Poppins, sans-serif',
          margin: 0,
        }}
      >
        Roles &amp; Access
      </h1>
      <AppButton variant="primary" onClick={onNew}>
        <Plus size={15} weight="bold" />
        New role
      </AppButton>
    </div>
  )
}
