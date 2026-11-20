import { useEffect } from 'react'
import { Alert, Checkbox, Drawer, Form, Input, InputNumber, Skeleton, Switch, message } from 'antd'
import { MapPin } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../atoms/AppButton'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import type { ManagedProfile, ProfilePatch } from './manageApi'
import { useManaged, useManageMutation } from './useManage'
import { coordsFromMapLink } from './mapLink'

interface Props {
  restaurantId: string
  open: boolean
  onClose: () => void
}

type Values = {
  name: string
  cuisine: string
  description: string
  areaDistrict: string
  city: string
  fullAddress: string
  latitude: number | null
  longitude: number | null
  mapLink: string
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  phone: string
  email: string
  website: string
  houseRules: string
  dressCode: string
  servesAlcohol: boolean
  visibleOnApp: boolean
}

/** `+92 300 123 4567` → `+923001234567`, the only phone form the API takes. */
const compactPhone = (v: string) => v.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')

const toValues = (p: ManagedProfile): Values => ({
  name: p.name ?? '',
  cuisine: p.cuisine ?? '',
  description: p.description ?? '',
  areaDistrict: p.location.areaDistrict ?? '',
  city: p.location.city ?? '',
  fullAddress: p.location.fullAddress ?? '',
  latitude: p.location.latitude,
  longitude: p.location.longitude,
  mapLink: '',
  ownerName: p.owner.name ?? '',
  ownerEmail: p.owner.email ?? '',
  ownerPhone: p.owner.phone ?? '',
  phone: p.restaurant.phone ?? '',
  email: p.restaurant.email ?? '',
  website: p.restaurant.website ?? '',
  houseRules: p.rules.houseRules ?? '',
  dressCode: p.rules.dressCode ?? '',
  servesAlcohol: p.rules.servesAlcohol ?? false,
  visibleOnApp: p.visibleOnApp,
})

const toPatch = (v: Values, wasVisible: boolean): ProfilePatch => ({
  name: v.name.trim(),
  cuisine: v.cuisine.trim(),
  description: v.description.trim(),
  location: {
    areaDistrict: v.areaDistrict.trim(),
    city: v.city.trim(),
    fullAddress: v.fullAddress.trim(),
    latitude: v.latitude,
    longitude: v.longitude,
  },
  owner: {
    name: v.ownerName.trim(),
    email: v.ownerEmail.trim(),
    phone: compactPhone(v.ownerPhone),
  },
  restaurant: { phone: compactPhone(v.phone), email: v.email.trim(), website: v.website.trim() },
  rules: {
    houseRules: v.houseRules.trim(),
    dressCode: v.dressCode.trim(),
    servesAlcohol: v.servesAlcohol,
  },
  ...(v.visibleOnApp !== wasVisible ? { visibleOnApp: v.visibleOnApp } : {}),
})

/**
 * Every field of the restaurant's profile, editable by a super admin (GM-342):
 * the same fields and rules the restaurant's own Overview uses, including the
 * map location ("View on map" is built from its coordinates).
 */
export function EditDetailsDrawer({ restaurantId, open, onClose }: Props) {
  const { t } = useTranslation(['restaurants', 'common'])
  const [form] = Form.useForm<Values>()
  const [messageApi, holder] = message.useMessage()
  const profile = useManaged(restaurantId, 'profile', (api) => api.profile(), open)
  const save = useManageMutation(restaurantId, (api, patch: ProfilePatch) => api.saveProfile(patch))

  useEffect(() => {
    if (open && profile.data) form.setFieldsValue(toValues(profile.data))
  }, [open, profile.data, form])

  const fillFromLink = () => {
    const coords = coordsFromMapLink(form.getFieldValue('mapLink') ?? '')
    if (!coords) {
      form.setFields([
        { name: 'mapLink', errors: [t('restaurants:manage.details.mapLinkInvalid')] },
      ])
      return
    }
    form.setFieldsValue(coords)
    form.setFields([{ name: 'mapLink', errors: [] }])
  }

  // Saved through the form (onFinish), which waits for any validation still running.
  const onFinish = (values: Values) => {
    if (!profile.data) return
    save.mutate(toPatch(values, profile.data.visibleOnApp), {
      onSuccess: () => {
        void messageApi.success(t('restaurants:manage.saved'))
        onClose()
      },
      onError: (e) =>
        void messageApi.error(
          getApiErrorMessage(e, t('common:errors.saveFailed', { defaultValue: 'Could not save.' })),
        ),
    })
  }

  const lat = Form.useWatch('latitude', form)
  const lng = Form.useWatch('longitude', form)
  const mapHref = lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : null

  return (
    <>
      {/* Outside the drawer, so "Saved" still shows after it closes. */}
      {holder}
      <Drawer
        open={open}
        onClose={onClose}
        width={560}
        destroyOnHidden
        title={t('restaurants:manage.details.title')}
        footer={
          <div className="flex justify-end gap-2">
            <AppButton variant="neutral" onClick={onClose}>
              {t('common:buttons.cancel')}
            </AppButton>
            <AppButton
              variant="primary"
              onClick={() => form.submit()}
              disabled={!profile.data || save.isPending}
              data-testid="manage-details-save"
            >
              {t('common:buttons.saveChanges')}
            </AppButton>
          </div>
        }
      >
        <p className="mt-0 mb-4 text-[13px] text-[var(--color-text-muted)]">
          {t('restaurants:manage.onBehalf')}
        </p>
        {profile.isPending && <Skeleton active paragraph={{ rows: 10 }} />}
        {profile.isError && (
          <Alert
            type="error"
            showIcon
            message={getApiErrorMessage(profile.error, t('restaurants:manage.loadFailed'))}
          />
        )}
        {profile.data && !profile.data.editable && (
          <Alert
            className="mb-4"
            type="warning"
            showIcon
            message={t('restaurants:manage.readOnly')}
          />
        )}
        {profile.data && (
          <Form
            form={form}
            onFinish={onFinish}
            layout="vertical"
            requiredMark={false}
            disabled={!profile.data.editable}
          >
            <h3 className="mt-0 mb-2 text-[14px] font-semibold">
              {t('restaurants:manage.details.basics')}
            </h3>
            <Form.Item
              name="name"
              label={t('restaurants:manage.details.name')}
              rules={[{ required: true, max: 100 }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="cuisine"
              label={t('restaurants:manage.details.cuisine')}
              rules={[{ max: 100 }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="description"
              label={t('restaurants:manage.details.description')}
              rules={[{ max: 600 }]}
            >
              <Input.TextArea rows={3} showCount maxLength={600} />
            </Form.Item>

            <h3 className="mt-2 mb-2 text-[14px] font-semibold">
              {t('restaurants:manage.details.location')}
            </h3>
            <Form.Item name="fullAddress" label={t('restaurants:manage.details.fullAddress')}>
              <Input />
            </Form.Item>
            <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
              <Form.Item name="areaDistrict" label={t('restaurants:manage.details.area')}>
                <Input />
              </Form.Item>
              <Form.Item name="city" label={t('restaurants:manage.details.city')}>
                <Input />
              </Form.Item>
            </div>
            <Form.Item
              label={t('restaurants:manage.details.mapLink')}
              extra={t('restaurants:manage.details.mapLinkHint')}
            >
              <div className="flex gap-2">
                <Form.Item name="mapLink" noStyle>
                  <Input placeholder="https://maps.google.com/…" />
                </Form.Item>
                <AppButton variant="secondary" onClick={fillFromLink}>
                  <MapPin size={14} aria-hidden /> {t('restaurants:manage.details.useLink')}
                </AppButton>
              </div>
            </Form.Item>
            <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
              <Form.Item name="latitude" label={t('restaurants:manage.details.latitude')}>
                <InputNumber className="w-full" min={-90} max={90} step={0.0001} />
              </Form.Item>
              <Form.Item name="longitude" label={t('restaurants:manage.details.longitude')}>
                <InputNumber className="w-full" min={-180} max={180} step={0.0001} />
              </Form.Item>
            </div>
            {mapHref && (
              <a
                href={mapHref}
                target="_blank"
                rel="noreferrer"
                className="mb-4 inline-block text-[13px] font-semibold"
              >
                {t('restaurants:manage.details.viewOnMap')}
              </a>
            )}

            <h3 className="mt-2 mb-2 text-[14px] font-semibold">
              {t('restaurants:manage.details.contact')}
            </h3>
            <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
              <Form.Item name="phone" label={t('restaurants:manage.details.phone')}>
                <Input placeholder="+92 21 3525 0000" />
              </Form.Item>
              <Form.Item
                name="email"
                label={t('restaurants:manage.details.email')}
                rules={[{ type: 'email' }]}
              >
                <Input />
              </Form.Item>
            </div>
            <Form.Item name="website" label={t('restaurants:manage.details.website')}>
              <Input placeholder="https://" />
            </Form.Item>

            <h3 className="mt-2 mb-2 text-[14px] font-semibold">
              {t('restaurants:manage.details.owner')}
            </h3>
            <Form.Item name="ownerName" label={t('restaurants:manage.details.ownerName')}>
              <Input />
            </Form.Item>
            <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
              <Form.Item
                name="ownerEmail"
                label={t('restaurants:manage.details.ownerEmail')}
                rules={[{ type: 'email' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name="ownerPhone" label={t('restaurants:manage.details.ownerPhone')}>
                <Input placeholder="+92 300 111 2233" />
              </Form.Item>
            </div>

            <h3 className="mt-2 mb-2 text-[14px] font-semibold">
              {t('restaurants:manage.details.rules')}
            </h3>
            <Form.Item name="houseRules" label={t('restaurants:manage.details.houseRules')}>
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item
              name="dressCode"
              label={t('restaurants:manage.details.dressCode')}
              rules={[{ max: 200 }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="servesAlcohol" valuePropName="checked">
              <Checkbox>{t('restaurants:manage.details.servesAlcohol')}</Checkbox>
            </Form.Item>
            {profile.data.status === 'ACTIVE' && (
              <Form.Item
                name="visibleOnApp"
                valuePropName="checked"
                label={t('restaurants:manage.details.visible')}
              >
                <Switch />
              </Form.Item>
            )}
          </Form>
        )}
      </Drawer>
    </>
  )
}
