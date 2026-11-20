import { useState, type ReactNode } from 'react'
import {
  Alert,
  Checkbox,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Skeleton,
  Tag,
  Upload,
  message,
} from 'antd'
import {
  Eye,
  EyeSlash,
  Image as ImageIcon,
  PencilSimple,
  Plus,
  Star,
  Trash,
  UploadSimple,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../atoms/AppButton'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import type {
  ContactInput,
  ManagedContact,
  ManagedMenuOption,
  ManagedTable,
  MenuOptionInput,
} from './manageApi'
import { useManaged, useManageMutation } from './useManage'

interface DrawerProps {
  restaurantId: string
  open: boolean
  onClose: () => void
}

/** The frame every manage drawer shares: title, the "on the restaurant's behalf" note, loading and error. */
function ManageFrame({
  open,
  onClose,
  title,
  query,
  action,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  query: { isPending: boolean; isError: boolean; error: unknown }
  action?: ReactNode
  children: ReactNode
}) {
  const { t } = useTranslation('restaurants')
  return (
    <Drawer open={open} onClose={onClose} width={560} destroyOnHidden title={title} extra={action}>
      <p className="mt-0 mb-4 text-[13px] text-[var(--color-text-muted)]">{t('manage.onBehalf')}</p>
      {query.isPending && <Skeleton active paragraph={{ rows: 6 }} />}
      {query.isError && (
        <Alert
          type="error"
          showIcon
          message={getApiErrorMessage(query.error, t('manage.loadFailed'))}
        />
      )}
      {!query.isPending && !query.isError && children}
    </Drawer>
  )
}

function useFeedback() {
  const { t } = useTranslation(['restaurants', 'common'])
  const [api, holder] = message.useMessage()
  return {
    holder,
    ok: () => void api.success(t('restaurants:manage.saved')),
    fail: (e: unknown) => void api.error(getApiErrorMessage(e, t('restaurants:manage.saveFailed'))),
  }
}

const Row = ({
  children,
  muted,
  testId,
}: {
  children: ReactNode
  muted?: boolean
  testId?: string
}) => (
  <div
    data-testid={testId}
    className={`flex items-center justify-between gap-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 ${muted ? 'opacity-70' : ''}`}
  >
    {children}
  </div>
)

const IconBtn = ({
  label,
  onClick,
  children,
  danger,
}: {
  label: string
  onClick?: () => void
  children: ReactNode
  danger?: boolean
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={`inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border-none bg-transparent hover:bg-[var(--color-hover-neutral)] ${
      danger ? 'text-[var(--color-error)]' : 'text-[var(--color-text-secondary)]'
    }`}
  >
    {children}
  </button>
)

// ── Contacts ───────────────────────────────────────────────────────────────

const compactPhone = (v?: string) => (v ?? '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')

export function ContactsDrawer({ restaurantId, open, onClose }: DrawerProps) {
  const { t } = useTranslation(['restaurants', 'common'])
  const fb = useFeedback()
  const list = useManaged(restaurantId, 'contacts', (api) => api.contacts(), open)
  const [editing, setEditing] = useState<ManagedContact | 'new' | null>(null)
  const [form] = Form.useForm<ContactInput>()
  const save = useManageMutation(restaurantId, (api, c: ContactInput) =>
    editing && editing !== 'new' ? api.updateContact(editing.id, c) : api.addContact(c),
  )
  const remove = useManageMutation(restaurantId, (api, id: string) => api.removeContact(id))

  const start = (c: ManagedContact | 'new') => setEditing(c)
  // A fresh form per edit (keyed below), seeded through initialValues: setting
  // values before the form mounts leaves validation "out of date".
  const contactInitial = (c: ManagedContact | 'new') =>
    c === 'new'
      ? { name: '', title: '', email: '', phone: '' }
      : { name: c.name, title: c.title ?? '', email: c.email ?? '', phone: c.phone ?? '' }
  // Submitted through the form (onFinish), which waits for any validation still running.
  const onFinish = (v: ContactInput) => {
    const body: ContactInput = { name: v.name.trim() }
    if (v.title?.trim()) body.title = v.title.trim()
    if (v.email?.trim()) body.email = v.email.trim()
    if (v.phone?.trim()) body.phone = compactPhone(v.phone)
    save.mutate(body, {
      onSuccess: () => {
        fb.ok()
        setEditing(null)
        void list.refetch()
      },
      onError: fb.fail,
    })
  }

  return (
    <ManageFrame
      open={open}
      onClose={onClose}
      title={t('restaurants:manage.contacts.title')}
      query={list}
      action={
        <AppButton variant="primary" onClick={() => start('new')}>
          <Plus size={14} /> {t('restaurants:manage.contacts.add')}
        </AppButton>
      }
    >
      {fb.holder}
      {editing && (
        <Form
          key={editing === 'new' ? 'new' : editing.id}
          form={form}
          initialValues={contactInitial(editing)}
          onFinish={onFinish}
          layout="vertical"
          requiredMark={false}
          className="mb-4 rounded-[12px] border border-[var(--color-border)] p-3"
        >
          <Form.Item
            name="name"
            label={t('restaurants:manage.contacts.name')}
            rules={[{ required: true, max: 100 }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="title"
            label={t('restaurants:manage.contacts.role')}
            rules={[{ max: 100 }]}
          >
            <Input />
          </Form.Item>
          <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
            <Form.Item
              name="email"
              label={t('restaurants:manage.contacts.email')}
              rules={[{ type: 'email' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="phone" label={t('restaurants:manage.contacts.phone')}>
              <Input placeholder="+92 300 123 4567" />
            </Form.Item>
          </div>
          <div className="flex justify-end gap-2">
            <AppButton variant="neutral" onClick={() => setEditing(null)}>
              {t('common:buttons.cancel')}
            </AppButton>
            <AppButton variant="primary" onClick={() => form.submit()} disabled={save.isPending}>
              {t('common:buttons.save')}
            </AppButton>
          </div>
        </Form>
      )}
      <div className="flex flex-col gap-2">
        {(list.data ?? []).length === 0 && (
          <Empty description={t('restaurants:manage.contacts.empty')} />
        )}
        {(list.data ?? []).map((c) => (
          <Row key={c.id} testId={`manage-contact-${c.name}`}>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold">{c.name}</div>
              <div className="truncate text-[12px] text-[var(--color-text-muted)]">
                {[c.title, c.email, c.phone].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
            <div className="flex">
              <IconBtn label={t('common:buttons.edit')} onClick={() => start(c)}>
                <PencilSimple size={16} />
              </IconBtn>
              <Popconfirm
                title={t('restaurants:manage.contacts.removeConfirm', { name: c.name })}
                okText={t('common:buttons.delete')}
                cancelText={t('common:buttons.cancel')}
                onConfirm={() =>
                  remove.mutate(c.id, { onSuccess: () => void list.refetch(), onError: fb.fail })
                }
              >
                <span>
                  <IconBtn label={t('common:buttons.delete')} danger>
                    <Trash size={16} />
                  </IconBtn>
                </span>
              </Popconfirm>
            </div>
          </Row>
        ))}
      </div>
    </ManageFrame>
  )
}

// ── Tables ─────────────────────────────────────────────────────────────────

export function TablesDrawer({ restaurantId, open, onClose }: DrawerProps) {
  const { t } = useTranslation(['restaurants', 'common'])
  const fb = useFeedback()
  const list = useManaged(restaurantId, 'tables', (api) => api.tables(), open)
  const [editing, setEditing] = useState<ManagedTable | 'new' | null>(null)
  const [name, setName] = useState('')
  const save = useManageMutation(restaurantId, (api, n: string) =>
    editing && editing !== 'new' ? api.renameTable(editing.tableId, n) : api.addTable(n),
  )
  const hide = useManageMutation(restaurantId, (api, v: { id: string; hidden: boolean }) =>
    api.setTableHidden(v.id, v.hidden),
  )
  const remove = useManageMutation(restaurantId, (api, id: string) => api.removeTable(id))
  const after = { onSuccess: () => void list.refetch(), onError: fb.fail }

  return (
    <ManageFrame
      open={open}
      onClose={onClose}
      title={t('restaurants:manage.tables.title')}
      query={list}
      action={
        <AppButton
          variant="primary"
          onClick={() => {
            setEditing('new')
            setName('')
          }}
        >
          <Plus size={14} /> {t('restaurants:manage.tables.add')}
        </AppButton>
      }
    >
      {fb.holder}
      <p className="mt-0 mb-3 text-[12px] text-[var(--color-text-muted)]">
        {t('restaurants:manage.tables.hint')}
      </p>
      {editing && (
        <div className="mb-4 flex gap-2">
          <Input
            autoFocus
            aria-label={t('restaurants:manage.tables.name')}
            placeholder={t('restaurants:manage.tables.name')}
            value={name}
            maxLength={150}
            onChange={(e) => setName(e.target.value)}
            onPressEnter={() =>
              name.trim() &&
              save.mutate(name.trim(), {
                onSuccess: () => (setEditing(null), void list.refetch()),
                onError: fb.fail,
              })
            }
          />
          <AppButton
            variant="primary"
            disabled={!name.trim() || save.isPending}
            onClick={() =>
              save.mutate(name.trim(), {
                onSuccess: () => (setEditing(null), void list.refetch()),
                onError: fb.fail,
              })
            }
          >
            {t('common:buttons.save')}
          </AppButton>
          <AppButton variant="neutral" onClick={() => setEditing(null)}>
            {t('common:buttons.cancel')}
          </AppButton>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {(list.data ?? []).length === 0 && (
          <Empty description={t('restaurants:manage.tables.empty')} />
        )}
        {(list.data ?? []).map((tb) => (
          <Row key={tb.tableId} muted={tb.isHidden} testId={`manage-table-${tb.name}`}>
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[14px] font-semibold">{tb.name}</span>
              {tb.isHidden && <Tag>{t('restaurants:manage.hidden')}</Tag>}
            </div>
            <div className="flex">
              <IconBtn
                label={t('common:buttons.edit')}
                onClick={() => {
                  setEditing(tb)
                  setName(tb.name)
                }}
              >
                <PencilSimple size={16} />
              </IconBtn>
              <IconBtn
                label={tb.isHidden ? t('restaurants:manage.show') : t('restaurants:manage.hide')}
                onClick={() => hide.mutate({ id: tb.tableId, hidden: !tb.isHidden }, after)}
              >
                {tb.isHidden ? <Eye size={16} /> : <EyeSlash size={16} />}
              </IconBtn>
              <Popconfirm
                title={t('restaurants:manage.tables.removeConfirm', { name: tb.name })}
                okText={t('common:buttons.delete')}
                cancelText={t('common:buttons.cancel')}
                onConfirm={() => remove.mutate(tb.tableId, after)}
              >
                <span>
                  <IconBtn label={t('common:buttons.delete')} danger>
                    <Trash size={16} />
                  </IconBtn>
                </span>
              </Popconfirm>
            </div>
          </Row>
        ))}
      </div>
    </ManageFrame>
  )
}

// ── Menu options ───────────────────────────────────────────────────────────

type MenuForm = {
  name: string
  pricePkr: number
  courses: { course: string; choose: number; options: string }[]
}

export function MenuOptionsDrawer({ restaurantId, open, onClose }: DrawerProps) {
  const { t } = useTranslation(['restaurants', 'common'])
  const fb = useFeedback()
  const list = useManaged(restaurantId, 'menu-options', (api) => api.menuOptions(), open)
  const [editing, setEditing] = useState<ManagedMenuOption | 'new' | null>(null)
  const [form] = Form.useForm<MenuForm>()
  const save = useManageMutation(restaurantId, (api, m: MenuOptionInput) =>
    editing && editing !== 'new' ? api.updateMenuOption(editing.comboId, m) : api.addMenuOption(m),
  )
  const hide = useManageMutation(restaurantId, (api, v: { id: string; hidden: boolean }) =>
    api.setMenuOptionHidden(v.id, v.hidden),
  )
  const remove = useManageMutation(restaurantId, (api, id: string) => api.removeMenuOption(id))
  const after = { onSuccess: () => void list.refetch(), onError: fb.fail }

  const start = (m: ManagedMenuOption | 'new') => setEditing(m)
  const menuInitial = (m: ManagedMenuOption | 'new'): MenuForm =>
    m === 'new'
      ? { name: '', pricePkr: 0, courses: [{ course: '', choose: 1, options: '' }] }
      : {
          name: m.name,
          pricePkr: m.pricePkr,
          courses: m.courses.map((c) => ({
            course: c.course,
            choose: c.choose,
            options: c.options.join(', '),
          })),
        }

  const onFinish = (v: MenuForm) => {
    const body: MenuOptionInput = {
      name: v.name.trim(),
      pricePkr: Number(v.pricePkr),
      courses: v.courses.map((c) => ({
        course: c.course.trim(),
        choose: Number(c.choose),
        options: c.options
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
      })),
    }
    save.mutate(body, {
      onSuccess: () => (setEditing(null), fb.ok(), void list.refetch()),
      onError: fb.fail,
    })
  }

  return (
    <ManageFrame
      open={open}
      onClose={onClose}
      title={t('restaurants:manage.menus.title')}
      query={list}
      action={
        <AppButton variant="primary" onClick={() => start('new')}>
          <Plus size={14} /> {t('restaurants:manage.menus.add')}
        </AppButton>
      }
    >
      {fb.holder}
      {editing && (
        <Form
          key={editing === 'new' ? 'new' : editing.comboId}
          form={form}
          initialValues={menuInitial(editing)}
          onFinish={onFinish}
          layout="vertical"
          requiredMark={false}
          className="mb-4 rounded-[12px] border border-[var(--color-border)] p-3"
        >
          <div className="grid grid-cols-1 gap-x-3 md:grid-cols-[1fr_160px]">
            <Form.Item
              name="name"
              label={t('restaurants:manage.menus.name')}
              rules={[{ required: true, max: 100 }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="pricePkr"
              label={t('restaurants:manage.menus.price')}
              rules={[{ required: true }]}
            >
              <InputNumber className="w-full" min={0} step={100} addonBefore="PKR" />
            </Form.Item>
          </div>
          <Form.List name="courses">
            {(fields, { add, remove: removeCourse }) => (
              <div className="flex flex-col gap-2">
                {fields.map((f) => (
                  <div
                    key={f.key}
                    className="rounded-[10px] bg-[var(--color-page-bg,transparent)] p-2"
                  >
                    <div className="grid grid-cols-1 gap-x-2 md:grid-cols-[1fr_90px_auto]">
                      <Form.Item
                        name={[f.name, 'course']}
                        label={t('restaurants:manage.menus.course')}
                        rules={[{ required: true }]}
                      >
                        <Input placeholder={t('restaurants:manage.menus.coursePh')} />
                      </Form.Item>
                      <Form.Item
                        name={[f.name, 'choose']}
                        label={t('restaurants:manage.menus.choose')}
                        rules={[{ required: true }]}
                      >
                        <InputNumber className="w-full" min={1} max={10} />
                      </Form.Item>
                      <div className="flex items-end pb-6">
                        <IconBtn
                          label={t('restaurants:manage.menus.removeCourse')}
                          danger
                          onClick={() => removeCourse(f.name)}
                        >
                          <Trash size={16} />
                        </IconBtn>
                      </div>
                    </div>
                    <Form.Item
                      name={[f.name, 'options']}
                      label={t('restaurants:manage.menus.options')}
                      rules={[{ required: true }]}
                      className="mb-0"
                    >
                      <Input placeholder={t('restaurants:manage.menus.optionsPh')} />
                    </Form.Item>
                  </div>
                ))}
                <AppButton
                  variant="secondary"
                  onClick={() => add({ course: '', choose: 1, options: '' })}
                >
                  <Plus size={14} /> {t('restaurants:manage.menus.addCourse')}
                </AppButton>
              </div>
            )}
          </Form.List>
          <div className="mt-3 flex justify-end gap-2">
            <AppButton variant="neutral" onClick={() => setEditing(null)}>
              {t('common:buttons.cancel')}
            </AppButton>
            <AppButton variant="primary" onClick={() => form.submit()} disabled={save.isPending}>
              {t('common:buttons.save')}
            </AppButton>
          </div>
        </Form>
      )}
      <div className="flex flex-col gap-2">
        {(list.data ?? []).length === 0 && (
          <Empty description={t('restaurants:manage.menus.empty')} />
        )}
        {(list.data ?? []).map((m) => (
          <Row key={m.comboId} muted={m.isHidden} testId={`manage-menu-${m.name}`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-[14px] font-semibold">{m.name}</span>
                {m.isHidden && <Tag>{t('restaurants:manage.hidden')}</Tag>}
              </div>
              <div className="truncate text-[12px] text-[var(--color-text-muted)]">
                PKR {m.pricePkr.toLocaleString('en-US')} ·{' '}
                {m.courses.map((c) => c.course).join(', ')}
              </div>
            </div>
            <div className="flex">
              <IconBtn label={t('common:buttons.edit')} onClick={() => start(m)}>
                <PencilSimple size={16} />
              </IconBtn>
              <IconBtn
                label={m.isHidden ? t('restaurants:manage.show') : t('restaurants:manage.hide')}
                onClick={() => hide.mutate({ id: m.comboId, hidden: !m.isHidden }, after)}
              >
                {m.isHidden ? <Eye size={16} /> : <EyeSlash size={16} />}
              </IconBtn>
              <Popconfirm
                title={t('restaurants:manage.menus.removeConfirm', { name: m.name })}
                okText={t('common:buttons.delete')}
                cancelText={t('common:buttons.cancel')}
                onConfirm={() => remove.mutate(m.comboId, after)}
              >
                <span>
                  <IconBtn label={t('common:buttons.delete')} danger>
                    <Trash size={16} />
                  </IconBtn>
                </span>
              </Popconfirm>
            </div>
          </Row>
        ))}
      </div>
    </ManageFrame>
  )
}

// ── Amenities ──────────────────────────────────────────────────────────────

export function AmenitiesDrawer({ restaurantId, open, onClose }: DrawerProps) {
  const { t } = useTranslation('restaurants')
  const fb = useFeedback()
  const list = useManaged(restaurantId, 'amenities', (api) => api.amenities(), open)
  const set = useManageMutation(restaurantId, (api, v: { id: string; selected: boolean }) =>
    api.setAmenity(v.id, v.selected),
  )
  // Ticks show at once; a failed save puts the box back and says so.
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const toggle = (id: string, selected: boolean) => {
    setPending((p) => ({ ...p, [id]: selected }))
    const settle = () =>
      setPending((p) => {
        const { [id]: _done, ...restOf } = p
        void _done
        return restOf
      })
    set.mutate(
      { id, selected },
      {
        onSuccess: () => void list.refetch().then(settle),
        onError: (e) => {
          settle()
          fb.fail(e)
        },
      },
    )
  }
  return (
    <ManageFrame open={open} onClose={onClose} title={t('manage.amenities.title')} query={list}>
      {fb.holder}
      {(list.data ?? []).length === 0 && <Empty description={t('manage.amenities.empty')} />}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {(list.data ?? []).map((a) => (
          <label
            key={a.amenityId}
            className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-[var(--color-border)] px-3 py-2"
          >
            <Checkbox
              checked={pending[a.amenityId] ?? a.selected}
              onChange={(e) => toggle(a.amenityId, e.target.checked)}
            />
            {a.iconUrl && <img src={a.iconUrl} alt="" className="h-5 w-5 shrink-0" />}
            <span className="text-[14px]">{a.name}</span>
          </label>
        ))}
      </div>
    </ManageFrame>
  )
}

// ── Photos ─────────────────────────────────────────────────────────────────

export function PhotosDrawer({ restaurantId, open, onClose }: DrawerProps) {
  const { t } = useTranslation(['restaurants', 'common'])
  const fb = useFeedback()
  const list = useManaged(restaurantId, 'photos', (api) => api.photos(), open)
  const upload = useManageMutation(restaurantId, (api, f: File) => api.uploadPhoto(f))
  const cover = useManageMutation(restaurantId, (api, id: string) => api.setCover(id))
  const remove = useManageMutation(restaurantId, (api, id: string) => api.removePhoto(id))
  const after = { onSuccess: () => void list.refetch(), onError: fb.fail }
  const items = list.data?.items ?? []

  return (
    <ManageFrame
      open={open}
      onClose={onClose}
      title={t('restaurants:manage.photos.title')}
      query={list}
      action={
        <Upload
          accept="image/jpeg,image/png,image/webp"
          showUploadList={false}
          beforeUpload={(file) => {
            upload.mutate(file as unknown as File, {
              onSuccess: () => (fb.ok(), void list.refetch()),
              onError: fb.fail,
            })
            return false
          }}
        >
          <AppButton
            variant="primary"
            disabled={upload.isPending || (list.data ? items.length >= list.data.max : false)}
          >
            <UploadSimple size={14} />{' '}
            {upload.isPending
              ? t('restaurants:manage.photos.uploading')
              : t('restaurants:manage.photos.add')}
          </AppButton>
        </Upload>
      }
    >
      {fb.holder}
      {items.length === 0 && (
        <Empty
          image={<ImageIcon size={40} className="text-[var(--color-text-subtle)]" />}
          description={t('restaurants:manage.photos.empty')}
        />
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {items.map((p) => (
          <figure
            key={p.mediaId}
            className="m-0 overflow-hidden rounded-[12px] border border-[var(--color-border)]"
          >
            <img src={p.url} alt="" className="block aspect-[4/3] w-full object-cover" />
            <figcaption className="flex items-center justify-between gap-1 px-2 py-1">
              {p.isCover ? (
                <Tag color="gold">{t('restaurants:manage.photos.cover')}</Tag>
              ) : (
                <span />
              )}
              <div className="flex">
                {!p.isCover && (
                  <IconBtn
                    label={t('restaurants:manage.photos.makeCover')}
                    onClick={() => cover.mutate(p.mediaId, after)}
                  >
                    <Star size={16} />
                  </IconBtn>
                )}
                <Popconfirm
                  title={t('restaurants:manage.photos.removeConfirm')}
                  okText={t('common:buttons.delete')}
                  cancelText={t('common:buttons.cancel')}
                  onConfirm={() => remove.mutate(p.mediaId, after)}
                >
                  <span>
                    <IconBtn label={t('common:buttons.delete')} danger>
                      <Trash size={16} />
                    </IconBtn>
                  </span>
                </Popconfirm>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </ManageFrame>
  )
}
