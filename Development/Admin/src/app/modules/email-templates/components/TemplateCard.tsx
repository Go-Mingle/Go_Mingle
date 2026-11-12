import { Switch, Tooltip } from 'antd'
import { EnvelopeSimple, LockSimple, PencilSimple } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../atoms/AppButton'
import { formatWhen } from '../formatWhen'
import type { EmailTemplate } from '../types'

interface TemplateCardProps {
  template: EmailTemplate
  toggling: boolean
  onToggle: (template: EmailTemplate, enabled: boolean) => void
  onEdit: (template: EmailTemplate) => void
}

export function TemplateCard({
  template,
  toggling,
  onToggle,
  onEdit,
}: Readonly<TemplateCardProps>) {
  const { t } = useTranslation('email-templates')
  const when = formatWhen(template.updatedAt)
  const history = template.isDefault
    ? t('card.defaultWording')
    : template.updatedBy
      ? t('card.editedBy', { name: template.updatedBy, when })
      : t('card.edited', { when })

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-(--color-border) bg-(--color-card) p-4 transition-shadow md:hover:shadow-(--shadow-md) md:flex-row md:items-center md:gap-5"
      data-testid={`template-${template.key}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-(--color-accent-light) text-(--color-accent-dark)">
          <EnvelopeSimple size={18} weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 text-[15px] font-semibold text-(--color-text) [font-family:var(--font-ui)]">
              {template.name}
            </h3>
            {template.required && (
              <Tooltip title={t('card.alwaysOn')}>
                <LockSimple
                  size={14}
                  className="text-(--color-text-subtle)"
                  aria-label={t('card.alwaysOn')}
                />
              </Tooltip>
            )}
          </div>
          <p className="m-0 mt-0.5 text-[13px] text-(--color-text-muted)">{template.description}</p>
          <p className="m-0 mt-2 truncate text-[13px] text-(--color-text-secondary)">
            <span className="font-medium text-(--color-text-subtle)">{t('card.subject')}: </span>
            {template.subject}
          </p>
          <p className="m-0 mt-1 text-[12px] text-(--color-text-subtle)">{history}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-4 md:justify-end">
        <Tooltip title={template.required ? t('card.alwaysOn') : undefined}>
          <label className="flex items-center gap-2 text-[13px] text-(--color-text-secondary)">
            <Switch
              size="small"
              checked={template.enabled}
              disabled={template.required}
              loading={toggling}
              onChange={(checked) => onToggle(template, checked)}
              aria-label={`${template.name}: ${template.enabled ? t('card.on') : t('card.off')}`}
            />
            {template.enabled ? t('card.on') : t('card.off')}
          </label>
        </Tooltip>
        <AppButton variant="neutral" onClick={() => onEdit(template)}>
          <PencilSimple size={14} />
          {t('card.edit')}
        </AppButton>
      </div>
    </div>
  )
}
