import { Popover } from 'antd'
import { useTranslation } from 'react-i18next'
import { LabelTag } from '../../../atoms/LabelTag'

interface ModuleTagListProps {
  labels: string[]
  /** How many chips to show before collapsing the rest into "+N more". */
  max?: number
}

/**
 * Renders a role's module labels as chips, capped at `max` per the design so a
 * role with many modules doesn't sprawl horizontally across the listing table.
 * The overflow collapses into a "+N more" chip that reveals the rest on hover.
 */
export function ModuleTagList({ labels, max = 4 }: ModuleTagListProps) {
  const { t } = useTranslation('roles-access')

  const visible = labels.slice(0, max)
  const hidden = labels.slice(max)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {visible.map((label) => (
        <LabelTag key={label}>{label}</LabelTag>
      ))}
      {hidden.length > 0 && (
        <Popover
          content={
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 260 }}>
              {hidden.map((label) => (
                <LabelTag key={label}>{label}</LabelTag>
              ))}
            </div>
          }
        >
          <span>
            <LabelTag style={{ cursor: 'default' }}>
              {t('moreModules', { count: hidden.length })}
            </LabelTag>
          </span>
        </Popover>
      )}
    </div>
  )
}
