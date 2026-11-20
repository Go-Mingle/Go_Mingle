import { useState } from 'react'
import { Dropdown, Input, Modal, message } from 'antd'
import type { MenuProps } from 'antd'
import {
  Archive,
  ArrowCounterClockwise,
  CaretDown,
  ForkKnife,
  Image,
  ListChecks,
  NotePencil,
  Table,
  UserList,
  Wrench,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../atoms/AppButton'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import { EditDetailsDrawer } from './EditDetailsDrawer'
import {
  AmenitiesDrawer,
  ContactsDrawer,
  MenuOptionsDrawer,
  PhotosDrawer,
  TablesDrawer,
} from './ManageDrawers'
import { useArchiveMutations } from './useManage'

type Panel = 'details' | 'contacts' | 'tables' | 'menus' | 'amenities' | 'photos' | 'archive' | null

interface Props {
  restaurantId: string
  restaurantName: string
  archived: boolean
}

/**
 * "Manage restaurant": everything the restaurant can change on its own
 * screens, plus archive, for a super admin (GM-342). Each choice opens a
 * drawer that works through the restaurant's own rules.
 */
export function ManageRestaurantMenu({ restaurantId, restaurantName, archived }: Props) {
  const { t } = useTranslation(['restaurants', 'common'])
  const [panel, setPanel] = useState<Panel>(null)
  const [reason, setReason] = useState('')
  const [messageApi, holder] = message.useMessage()
  const { archive, restore } = useArchiveMutations(restaurantId)
  const close = () => setPanel(null)

  const items: MenuProps['items'] = [
    {
      key: 'details',
      icon: <NotePencil size={16} />,
      label: t('restaurants:manage.menu.details'),
      disabled: archived,
    },
    {
      key: 'contacts',
      icon: <UserList size={16} />,
      label: t('restaurants:manage.menu.contacts'),
      disabled: archived,
    },
    {
      key: 'tables',
      icon: <Table size={16} />,
      label: t('restaurants:manage.menu.tables'),
      disabled: archived,
    },
    {
      key: 'menus',
      icon: <ForkKnife size={16} />,
      label: t('restaurants:manage.menu.menus'),
      disabled: archived,
    },
    {
      key: 'amenities',
      icon: <ListChecks size={16} />,
      label: t('restaurants:manage.menu.amenities'),
      disabled: archived,
    },
    {
      key: 'photos',
      icon: <Image size={16} />,
      label: t('restaurants:manage.menu.photos'),
      disabled: archived,
    },
    { type: 'divider' },
    archived
      ? {
          key: 'restore',
          icon: <ArrowCounterClockwise size={16} />,
          label: t('restaurants:manage.menu.restore'),
        }
      : {
          key: 'archive',
          icon: <Archive size={16} />,
          label: t('restaurants:manage.menu.archive'),
          danger: true,
        },
  ]

  const onClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'restore') {
      restore.mutate(undefined, {
        onSuccess: () =>
          void messageApi.success(
            t('restaurants:manage.archive.restored', { name: restaurantName }),
          ),
        onError: (e) =>
          void messageApi.error(getApiErrorMessage(e, t('restaurants:manage.saveFailed'))),
      })
      return
    }
    if (key === 'archive') setReason('')
    setPanel(key as Panel)
  }

  return (
    <>
      {holder}
      <Dropdown menu={{ items, onClick }} trigger={['click']}>
        <AppButton variant="secondary" data-testid="manage-restaurant">
          <Wrench size={14} aria-hidden /> {t('restaurants:manage.menu.button')}{' '}
          <CaretDown size={12} aria-hidden />
        </AppButton>
      </Dropdown>

      <EditDetailsDrawer restaurantId={restaurantId} open={panel === 'details'} onClose={close} />
      <ContactsDrawer restaurantId={restaurantId} open={panel === 'contacts'} onClose={close} />
      <TablesDrawer restaurantId={restaurantId} open={panel === 'tables'} onClose={close} />
      <MenuOptionsDrawer restaurantId={restaurantId} open={panel === 'menus'} onClose={close} />
      <AmenitiesDrawer restaurantId={restaurantId} open={panel === 'amenities'} onClose={close} />
      <PhotosDrawer restaurantId={restaurantId} open={panel === 'photos'} onClose={close} />

      <Modal
        open={panel === 'archive'}
        onCancel={close}
        title={t('restaurants:manage.archive.title', { name: restaurantName })}
        okText={t('restaurants:manage.archive.confirm')}
        okButtonProps={{
          danger: true,
          disabled: reason.trim().length < 10,
          loading: archive.isPending,
        }}
        cancelText={t('common:buttons.cancel')}
        onOk={() =>
          archive.mutate(reason.trim(), {
            onSuccess: () => {
              close()
              void messageApi.success(
                t('restaurants:manage.archive.done', { name: restaurantName }),
              )
            },
            onError: (e) =>
              void messageApi.error(getApiErrorMessage(e, t('restaurants:manage.saveFailed'))),
          })
        }
        destroyOnHidden
      >
        <p className="text-[14px] text-[var(--color-text-muted)]">
          {t('restaurants:manage.archive.body')}
        </p>
        <Input.TextArea
          aria-label={t('restaurants:manage.archive.reason')}
          placeholder={t('restaurants:manage.archive.reason')}
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          showCount
          maxLength={300}
        />
      </Modal>
    </>
  )
}
