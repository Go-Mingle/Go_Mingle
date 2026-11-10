import { Alert, Spin } from 'antd'
import { Eye, EyeSlash, ForkKnife, Plus } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import { AppButton } from '../../../../atoms/AppButton'
import { ConfirmModal } from '../../../../molecules/ConfirmModal'
import { TabEmptyState } from '../../components/TabEmptyState'
import type { MenuTab } from '../hooks/useMenuTab'
import type { useMenuOptionsTab } from '../hooks/useMenuOptionsTab'
import { MenuOptionCard } from './MenuOptionCard'
import { MenuOptionFormModal } from './MenuOptionFormModal'
import { MenuPdfCard } from './MenuPdfCard'

type Options = ReturnType<typeof useMenuOptionsTab>

/**
 * The Menu Options tab (J6D).
 *
 * Two independent halves on one screen: the single public menu PDF and the
 * prix-fixe combos. Neither knows about the other.
 */
export function MenuOptionsTab({ c }: { c: MenuTab }) {
  return (
    <div>
      <MenuPdfCard c={c.pdf} />
      <MenuOptionsSection c={c.options} />
    </div>
  )
}

function MenuOptionsSection({ c }: { c: Options }) {
  const { t } = useTranslation(['restaurants', 'common'])

  if (c.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    )
  }

  if (c.isError) {
    return (
      <Alert type="error" message={getApiErrorMessage(c.error, t('common:errors.fetchError'))} />
    )
  }

  return (
    <>
      {c.options.length === 0 ? (
        <TabEmptyState
          IconComp={ForkKnife}
          title={t('restaurants:partnerMenu.emptyTitle')}
          description={t('restaurants:partnerMenu.emptyDesc')}
          action={
            c.editable ? (
              <AppButton variant="primary" onClick={c.openAdd}>
                <Plus size={15} weight="bold" />
                {t('restaurants:partnerMenu.addOption')}
              </AppButton>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Absent rather than disabled while read-only (BR-10). */}
          {c.editable && (
            <div className="mb-5 flex justify-end">
              <AppButton variant="primary" className="w-full md:w-auto" onClick={c.openAdd}>
                <Plus size={15} weight="bold" />
                {t('restaurants:partnerMenu.addOption')}
              </AppButton>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {c.options.map((option) => (
              <MenuOptionCard
                key={option.comboId}
                option={option}
                editable={c.editable}
                onEdit={() => c.openEdit(option)}
                onDelete={() => c.requestDelete(option)}
                onToggleVisibility={() => c.requestVisibility(option)}
              />
            ))}
          </div>
        </>
      )}

      <MenuOptionFormModal c={c} />
      <MenuOptionsModals c={c} />
    </>
  )
}

function MenuOptionsModals({ c }: { c: Options }) {
  const { t } = useTranslation(['restaurants', 'common'])

  const hidingNow = c.visibilityTarget?.isHidden === false
  const blockedName = c.blocked?.option.name ?? ''
  const upcoming = c.blocked?.upcomingTables ?? 0

  return (
    <>
      <ConfirmModal
        open={Boolean(c.deleteTarget)}
        onCancel={c.cancelDelete}
        onConfirm={c.confirmDelete}
        danger
        title={t('restaurants:partnerMenu.deleteTitle')}
        content={t('restaurants:partnerMenu.deleteBody', { name: c.deleteTarget?.name ?? '' })}
        cancelText={t('common:buttons.cancel')}
        confirmText={t('common:buttons.delete')}
      />

      <ConfirmModal
        open={Boolean(c.visibilityTarget)}
        onCancel={c.cancelVisibility}
        onConfirm={c.confirmVisibility}
        icon={hidingNow ? <EyeSlash size={24} /> : <Eye size={24} />}
        title={t(
          hidingNow ? 'restaurants:partnerMenu.hideTitle' : 'restaurants:partnerMenu.showTitle',
          {
            name: c.visibilityTarget?.name ?? '',
          },
        )}
        // The subtitle matters: hiding only withdraws the combo from the admin's
        // *future* interest-table picker. Diners on tables it is already attached
        // to keep being served it (CR-49), and the design's label is loose on that.
        content={t(
          hidingNow ? 'restaurants:partnerMenu.hideBody' : 'restaurants:partnerMenu.showBody',
        )}
        cancelText={t('common:buttons.cancel')}
        confirmText={t(hidingNow ? 'restaurants:partnerMenu.hide' : 'restaurants:partnerMenu.show')}
      />

      {/* The delete guard (BR-09). Not really a failure — hiding is the intended
          alternative, so it is offered as this dialog's primary action. */}
      <ConfirmModal
        open={Boolean(c.blocked)}
        onCancel={c.dismissBlocked}
        onConfirm={c.hideFromBlocked}
        icon={<EyeSlash size={24} />}
        title={t('restaurants:partnerMenu.blockedTitle')}
        content={
          upcoming > 0
            ? t('restaurants:partnerMenu.blockedBodyCounted', {
                name: blockedName,
                count: upcoming,
              })
            : t('restaurants:partnerMenu.blockedBody', { name: blockedName })
        }
        cancelText={t('common:buttons.cancel')}
        confirmText={t('restaurants:partnerMenu.hideInstead')}
      />
    </>
  )
}
