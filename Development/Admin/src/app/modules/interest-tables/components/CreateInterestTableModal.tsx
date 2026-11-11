import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  TimePicker,
  Collapse,
  Switch,
  Spin,
  Radio,
  Upload,
  message,
} from 'antd'
import type { RcFile } from 'antd/es/upload'
import { Check, UploadSimple, X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { interestTablesService } from '../services'
import type {
  AvailabilityMode,
  CreateInterestTablePayload,
  DurationMinutes,
  UpdateInterestTablePayload,
} from '../types'
import { useActiveProminglersQuery } from '../hooks/useInterestTablesQuery'
import { useInfiniteMinglersQuery } from '../../minglers/hooks/useMinglersQuery'
import { useUploadFileMutation } from '../../uploads/hooks/useUploadsQuery'
import { AppButton } from '../../../atoms/AppButton'
import { useDebouncedValue } from '../../../../shared/hooks/useDebouncedValue'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import { isPastDate, isPastTimeOnDate, pakistanNow } from '../../../../shared/utils/dateHelpers'

// Weekday keys / per-day availability windows for the assigned-table picker. Defined
// locally (previously imported from the mock module) so the modal is real-API-driven.
export type TableDay = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
export interface TableDayRange {
  start: string
  end: string
}
export interface TableDaySlots {
  day: TableDay
  ranges: TableDayRange[]
}

export interface TopicOption {
  id: string
  name: string
}
export interface ModalCombo {
  id: string
  name: string
  price: number
}
export interface ModalTable {
  id: string
  name: string
  slots: TableDaySlots[]
}
export interface ModalRestaurant {
  id: string
  name: string
  combos: ModalCombo[]
  tables: ModalTable[]
}
/** Prefill values for edit mode (DRAFT edit via PATCH). */
export interface EditInitialValues {
  name: string
  topicId: string
  maxGuests: number
  startDate: string // YYYY-MM-DD
  startTime: string // HH:mm
  durationMinutes: DurationMinutes
  restaurantTableId: string
  menuOptionIds: string[]
  mode: AvailabilityMode // lowercase (maps to availabilityMode)
  inviteOnly: boolean
  inviteList: string[]
  prominglerEnabled: boolean
  prominglerMinglerId?: string
}

interface Props {
  open: boolean
  restaurant: ModalRestaurant
  topics: TopicOption[]
  onClose: () => void
  onCreate: (dto: CreateInterestTablePayload) => void
  /** Edit mode: when set, the modal prefills and submits a PATCH via onUpdate. */
  editing?: boolean
  initialValues?: EditInitialValues
  onUpdate?: (payload: UpdateInterestTablePayload) => void
  /**
   * RBAC — without the MANAGE_MINGLERS permission the Invite Only and
   * ProMingler toggles (and their dependent pickers) are hidden.
   */
  hasMinglerAccess?: boolean
  /** Create/update mutation in flight — disables footer CTAs and shows a spinner. */
  submitting?: boolean
}

// Max Guests selectable 4–8; minimum is platform-fixed at 4 (read-only).
const GUEST_OPTIONS = [4, 5, 6, 7, 8]
// [MET-1296] Duration is one of five FIXED values — 1 / 1.5 / 2 / 2.5 / 3 hours
// (→ durationMinutes 60/90/120/150/180). This was an InputNumber stepper
// (min 1 / max 3 / step 0.5), which let a typed value land anywhere inside the
// range: 1.25h submitted durationMinutes 75 and the API rejected it with a 400
// ERR_INVALID_DURATION (`@IsIn([60,90,120,150,180])`). A select of the five
// options makes the form offer exactly what the contract accepts.
const DURATION_HOUR_OPTIONS = [1, 1.5, 2, 2.5, 3]
const DAY_INDEX: TableDay[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const ACCEPTED_TYPES = ['image/png', 'image/jpeg']
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

// Access-step dropdown labels render as "Full Name - Phone" (phone omitted when absent).
function minglerLabel(fullName: string, phone?: string | null): string {
  return phone ? `${fullName} - ${phone}` : fullName
}

function timeStringToDayjs(value?: string): Dayjs | null {
  if (!value) return null
  const [hours, minutes] = value.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return dayjs().hour(hours).minute(minutes).second(0).millisecond(0)
}

// TimePicker `disabledTime` for a start date of today — hides hours/minutes already past.
function disabledPastTimesToday() {
  const now = pakistanNow()
  return {
    disabledHours: () => Array.from({ length: now.hour() }, (_, i) => i),
    disabledMinutes: (selectedHour: number) =>
      selectedHour === now.hour() ? Array.from({ length: now.minute() }, (_, i) => i) : [],
  }
}

function addDurationMinutes(start: string, minutes: number): string {
  const [h, m] = start.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return ''
  const total = h * 60 + m + minutes
  const eh = Math.floor((total % 1440) / 60)
  const em = total % 60
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
}

interface FormShape {
  name: string
  topicId: string
  maxGuests: number
  startDate: dayjs.Dayjs
  startTime: string
  // UI is entered in hours; converted to `durationMinutes` on submit.
  durationHours: number
  restaurantTableId: string
  menuOptionIds: string[]
  // ── Access + cover-image fields ──
  mode?: AvailabilityMode
  inviteOnly?: boolean
  inviteList?: string[]
  prominglerEnabled?: boolean
  prominglerMinglerId?: string
  coverImage?: string
}

// Which accordion panel each field lives in (for jumping to the first error).
const FIELD_PANEL: Record<string, string> = {
  name: 'basics',
  topicId: 'basics',
  maxGuests: 'schedule',
  startDate: 'schedule',
  startTime: 'schedule',
  durationHours: 'schedule',
  restaurantTableId: 'table',
  menuOptionIds: 'table',
  coverImage: 'table',
  mode: 'access',
  inviteOnly: 'access',
  inviteList: 'access',
  prominglerEnabled: 'access',
  prominglerMinglerId: 'access',
}

function GuestChips({ value, onChange }: { value?: number; onChange?: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {GUEST_OPTIONS.map((n) => {
        const active = value === n
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange?.(n)}
            style={{
              minWidth: 44,
              height: 40,
              borderRadius: 12,
              cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
              fontSize: 14,
              fontWeight: 600,
              background: active ? 'var(--color-coral-light)' : 'var(--color-card)',
              color: active ? 'var(--color-coral-dark)' : 'var(--color-text-secondary)',
              border: `1.5px solid ${active ? 'var(--color-coral)' : 'var(--color-border-strong)'}`,
              transition: 'all 150ms ease-out',
            }}
          >
            {n}
          </button>
        )
      })}
    </div>
  )
}

function PanelHeader({ title, summary }: { title: string; summary: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--color-text)',
          fontFamily: 'Poppins, sans-serif',
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontSize: 12,
          color: 'var(--color-text-muted)',
          fontFamily: 'Poppins, sans-serif',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '60%',
        }}
      >
        {summary}
      </span>
    </div>
  )
}

export function CreateInterestTableModal({
  open,
  restaurant,
  topics,
  onClose,
  onCreate,
  editing = false,
  initialValues,
  onUpdate,
  hasMinglerAccess = true,
  submitting = false,
}: Props) {
  const { t } = useTranslation('interest-tables')
  const [form] = Form.useForm<FormShape>()
  const [activeKey, setActiveKey] = useState<string>('basics')
  // Storage key returned by the signed-url endpoint; sent as `coverImageKey`.
  // The `coverImage` form field holds only the base64 data URI for the preview.
  const [coverImageKey, setCoverImageKey] = useState<string | undefined>(undefined)
  const uploadMutation = useUploadFileMutation()

  // Prefill the form when opening in edit mode. The API stores minutes; the
  // form field is hours, so convert on the way in.
  useEffect(() => {
    if (open && editing && initialValues) {
      const { durationMinutes, ...rest } = initialValues
      form.setFieldsValue({
        ...rest,
        startDate: dayjs(initialValues.startDate),
        durationHours: durationMinutes / 60,
      })
    }
  }, [open, editing, initialValues, form])

  const topicId = Form.useWatch('topicId', form)
  const name = Form.useWatch('name', form)
  const maxGuests = Form.useWatch('maxGuests', form)
  const startDate = Form.useWatch('startDate', form)
  const startTime = Form.useWatch('startTime', form)
  const durationHours = Form.useWatch('durationHours', form)
  // Everything downstream (availability check, end-time preview, payload) works
  // in minutes — derive it once from the hours the user enters.
  const durationMinutes =
    typeof durationHours === 'number' ? Math.round(durationHours * 60) : undefined
  const restaurantTableId = Form.useWatch('restaurantTableId', form)
  const menuOptionIds = Form.useWatch('menuOptionIds', form)
  const inviteOnly = Form.useWatch('inviteOnly', form)
  const inviteList = Form.useWatch('inviteList', form)
  const prominglerEnabled = Form.useWatch('prominglerEnabled', form)
  const prominglerMinglerId = Form.useWatch('prominglerMinglerId', form)
  const coverImage = Form.useWatch('coverImage', form)
  const accessMode = Form.useWatch('mode', form)

  // Selecting a Pro Mingler removes them from the invite-only list so the same
  // mingler is never both the Pro Mingler and an invitee.
  useEffect(() => {
    if (prominglerMinglerId && (inviteList ?? []).includes(prominglerMinglerId)) {
      form.setFieldValue(
        'inviteList',
        (inviteList ?? []).filter((id: string) => id !== prominglerMinglerId),
      )
    }
  }, [prominglerMinglerId, inviteList, form])

  const selectedTopic = topics.find((tp) => tp.id === topicId)
  const selectedTable = restaurant.tables.find((tb) => tb.id === restaurantTableId)

  const selectedWeekday = startDate ? DAY_INDEX[dayjs(startDate).day()] : null

  // Dates and times are Pakistan time, whatever the admin's own time zone is.
  const isStartDateToday = !!startDate && dayjs(startDate).isSame(pakistanNow(), 'day')

  // `disabledTime` only constrains the dropdown, and only while the date is
  // already today — a time picked before the date, or a date switched from a
  // future day to today, would otherwise keep an already-elapsed start time.
  // Re-run the startTime rule whenever the date changes so the error surfaces
  // (and clears again when moving back to a future date).
  useEffect(() => {
    if (form.getFieldValue('startTime')) {
      void form.validateFields(['startTime']).catch(() => undefined)
    }
  }, [startDate, form])

  const availableTables = useMemo(() => {
    if (!selectedWeekday) return restaurant.tables
    return restaurant.tables.filter((tbl) =>
      tbl.slots.some((s) => s.day === selectedWeekday && s.ranges.length > 0),
    )
  }, [restaurant.tables, selectedWeekday])

  const comboOptions = restaurant.combos.map((c) => ({
    label: `${c.name} — PKR ${c.price.toLocaleString()}`,
    value: c.id,
  }))

  const endTime = startTime && durationMinutes ? addDurationMinutes(startTime, durationMinutes) : ''
  const timeRange = endTime ? `${startTime} - ${endTime}` : ''
  const availabilityStartDate = startDate ? dayjs(startDate).format('YYYY-MM-DD') : ''
  const availabilityInput = useMemo(
    () => ({
      restaurantTableId,
      startDate: availabilityStartDate,
      startTime,
      durationMinutes,
    }),
    [availabilityStartDate, durationMinutes, restaurantTableId, startTime],
  )
  const availabilityParams = useDebouncedValue(availabilityInput, 400)
  const shouldCheckAvailability = !!(
    availabilityParams.restaurantTableId &&
    availabilityParams.startDate &&
    availabilityParams.startTime &&
    availabilityParams.durationMinutes
  )
  const { data: availability, isFetching: isCheckingAvailability } = useQuery({
    queryKey: [
      'interest-table-availability',
      restaurant.id,
      availabilityParams.restaurantTableId,
      availabilityParams.startDate,
      availabilityParams.startTime,
      availabilityParams.durationMinutes,
    ],
    queryFn: () =>
      interestTablesService.checkAvailability(restaurant.id, availabilityParams.restaurantTableId, {
        startDate: availabilityParams.startDate,
        startTime: availabilityParams.startTime,
        // Guarded by `enabled` / `shouldCheckAvailability` — never runs while undefined.
        durationMinutes: availabilityParams.durationMinutes!,
      }),
    enabled:
      !!(restaurantTableId && startDate && startTime && durationMinutes) && shouldCheckAvailability,
  })

  // ── Access-step dropdown data — lazy: fetch only once the toggle is on. ──
  // Pro Mingler select: the active-prominglers endpoint returns a flat list, so
  // it is filtered client-side (showSearch + optionFilterProp).
  const { data: activeProminglers = [], isFetching: isLoadingProminglers } =
    useActiveProminglersQuery(!!prominglerEnabled)
  const prominglerOptions = activeProminglers.map((p) => ({
    label: minglerLabel(p.fullName, p.phone),
    value: p.id,
  }))

  // Invite-only select: server-driven, infinite-scrolled, searched by name at
  // ≥3 chars (term in the `name` param); pages accumulate. The dropdown starts
  // empty — the minglers list API is not hit until the user actually searches,
  // so opening the dropdown makes no request (query is enabled only once a
  // ≥3-char search term exists).
  const [inviteSearch, setInviteSearch] = useState('')
  const debouncedInviteSearch = useDebouncedValue(inviteSearch, 400)
  const inviteSearchTerm =
    debouncedInviteSearch.trim().length >= 3 ? debouncedInviteSearch.trim() : undefined
  const inviteQuery = useInfiniteMinglersQuery(
    { name: inviteSearchTerm, pageSize: 25 },
    !!inviteOnly && !!inviteSearchTerm,
  )
  const inviteOptions = (inviteQuery.data?.pages ?? [])
    .flatMap((p) => p.items ?? [])
    // A mingler chosen as the Pro Mingler cannot also be an invitee — keep them
    // out of the invite-only options so they never appear in both dropdowns.
    .filter((m) => m.id !== prominglerMinglerId)
    .map((m) => ({ label: minglerLabel(m.fullName, m.phone), value: m.id }))

  // Load the next page when the dropdown is scrolled near the bottom.
  const handleInviteScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24
    if (nearBottom && inviteQuery.hasNextPage && !inviteQuery.isFetchingNextPage) {
      void inviteQuery.fetchNextPage()
    }
  }

  const reset = () => {
    form.resetFields()
    setActiveKey('basics')
    setInviteSearch('')
    setCoverImageKey(undefined)
  }
  const handleClose = () => {
    reset()
    onClose()
  }
  // Closed by the parent (after a successful create or save): start clean next time.
  const wasOpen = useRef(open)
  useEffect(() => {
    if (wasOpen.current && !open) reset()
    wasOpen.current = open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Picking a cover image requests a signed URL and PUTs the bytes to S3; only
  // then is the storage `key` kept (submitted as coverImageKey) and the base64
  // data URI stored for the local preview thumbnail. The key is set exclusively
  // on success, so a rejected S3 upload never persists a key whose object is
  // missing — that combination is what showed a placeholder in the mobile app
  // (MET-963).
  const beforeCoverUpload = (file: RcFile) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      void message.error(t('form.imageTypeError'))
      return Upload.LIST_IGNORE
    }
    if (file.size > MAX_IMAGE_BYTES) {
      void message.error(t('form.imageSizeError'))
      return Upload.LIST_IGNORE
    }
    uploadMutation.mutate(
      { file, purpose: 'INTEREST_TABLE_COVER' },
      {
        onSuccess: ({ key }) => {
          setCoverImageKey(key)
          const reader = new FileReader()
          reader.onload = () => form.setFieldValue('coverImage', reader.result as string)
          reader.readAsDataURL(file)
        },
        onError: (err) => {
          void message.error(getApiErrorMessage(err, t('form.imageUploadError')))
        },
      },
    )
    return Upload.LIST_IGNORE
  }

  const clearCoverImage = () => {
    form.setFieldValue('coverImage', undefined)
    setCoverImageKey(undefined)
  }

  // Returns the list of invalid fields, or [] when the form is valid. antd can
  // reject validateFields with an empty errorFields list (`outOfDate: true`) when
  // the form re-renders mid-validation — here the debounced availability query
  // resolving triggers exactly that. Treat an empty rejection as "not yet
  // decided" so the caller can re-validate rather than fail a valid form.
  const validateAll = async (): Promise<(string | number)[][]> => {
    try {
      await form.validateFields()
      return []
    } catch (err) {
      return ((err as { errorFields?: { name: (string | number)[] }[] }).errorFields ?? []).map(
        (f) => f.name,
      )
    }
  }

  // Build the real create body. `publish=false` saves a DRAFT; `publish=true`
  // is create-and-publish. The Access-step optional fields are forwarded when
  // their toggles are ON. coverImageKey carries the storage key returned by the
  // signed-url endpoint (set when a cover image was uploaded).
  const submit = async (publish: boolean) => {
    let invalid = await validateAll()
    // Empty list may be a superseded (outOfDate) validation — re-validate once.
    if (invalid.length === 0) invalid = await validateAll()
    if (invalid.length > 0) {
      const first = invalid[0]?.[0]
      if (first && FIELD_PANEL[String(first)]) setActiveKey(FIELD_PANEL[String(first)])
      return
    }
    const v = form.getFieldsValue(true) as FormShape
    const payload: CreateInterestTablePayload = {
      name: v.name.trim(),
      topicId: v.topicId,
      maxGuests: v.maxGuests,
      startDate: dayjs(v.startDate).format('YYYY-MM-DD'),
      startTime: v.startTime,
      durationMinutes: Math.round(v.durationHours * 60) as DurationMinutes,
      restaurantTableId: v.restaurantTableId,
      menuOptionIds: v.menuOptionIds,
      availabilityMode: v.mode === 'coming_soon' ? 'COMING_SOON' : 'AVAILABLE_NOW',
      prominglerEnabled: !!v.prominglerEnabled,
      inviteOnly: !!v.inviteOnly,
      publish,
    }
    if (v.prominglerEnabled && v.prominglerMinglerId) {
      payload.prominglerMinglerId = v.prominglerMinglerId
    }
    if (v.inviteOnly) {
      payload.inviteList = v.inviteList ?? []
    }
    if (coverImageKey) {
      payload.coverImageKey = coverImageKey
    }
    // The form is cleared once the modal closes (see below), not here: clearing it
    // while the create request is still in flight re-ran the pending validation
    // on empty fields and flashed "Required" on Name and Table.
    onCreate(payload)
  }

  // Edit-mode save (DRAFT edit) → PATCH via onUpdate. No `publish` flag.
  const submitEdit = async () => {
    let invalid = await validateAll()
    if (invalid.length === 0) invalid = await validateAll()
    if (invalid.length > 0) {
      const first = invalid[0]?.[0]
      if (first && FIELD_PANEL[String(first)]) setActiveKey(FIELD_PANEL[String(first)])
      return
    }
    const v = form.getFieldsValue(true) as FormShape
    const payload: UpdateInterestTablePayload = {
      name: v.name.trim(),
      topicId: v.topicId,
      maxGuests: v.maxGuests,
      startDate: dayjs(v.startDate).format('YYYY-MM-DD'),
      startTime: v.startTime,
      durationMinutes: Math.round(v.durationHours * 60) as DurationMinutes,
      restaurantTableId: v.restaurantTableId,
      menuOptionIds: v.menuOptionIds,
      availabilityMode: v.mode === 'coming_soon' ? 'COMING_SOON' : 'AVAILABLE_NOW',
      prominglerEnabled: !!v.prominglerEnabled,
      inviteOnly: !!v.inviteOnly,
    }
    if (v.prominglerEnabled && v.prominglerMinglerId) {
      payload.prominglerMinglerId = v.prominglerMinglerId
    }
    if (v.inviteOnly) {
      payload.inviteList = v.inviteList ?? []
    }
    if (coverImageKey) {
      payload.coverImageKey = coverImageKey
    }
    onUpdate?.(payload)
  }

  // Collapsed-state summaries
  const basicsSummary = [name, selectedTopic?.name].filter(Boolean).join(' · ') || t('form.notSet')
  const scheduleSummary =
    maxGuests && startDate
      ? `${t('form.seatsLabel', { count: maxGuests })} · ${dayjs(startDate).format('DD MMM')}${timeRange ? ' · ' + timeRange : ''}`
      : t('form.notSet')
  const tableSummary =
    selectedTable || (menuOptionIds?.length ?? 0) > 0
      ? [
          selectedTable?.name,
          menuOptionIds?.length ? t('form.comboCount', { count: menuOptionIds.length }) : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : t('form.notSet')
  const accessSummary =
    [accessMode ? t(`mode.${accessMode}`) : null, inviteOnly ? t('inviteOnly.yes') : null]
      .filter(Boolean)
      .join(' · ') || t('form.notSet')
  const availabilityFeedback = (() => {
    if (availableTables.length === 0) {
      return (
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-error)',
            fontFamily: 'Poppins, sans-serif',
          }}
        >
          {t('form.noTables')}
        </span>
      )
    }
    if (!shouldCheckAvailability) return undefined
    if (isCheckingAvailability) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'var(--color-text-muted)',
            fontFamily: 'Poppins, sans-serif',
          }}
        >
          <Spin size="small" /> Checking...
        </span>
      )
    }
    if (availability?.assignable) {
      return (
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-success)',
            fontFamily: 'Poppins, sans-serif',
          }}
        >
          Slot available
        </span>
      )
    }
    if (availability && !availability.assignable) {
      return (
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-warning)',
            fontFamily: 'Poppins, sans-serif',
          }}
        >
          Slot unavailable: {availability.reason ?? 'Selected table cannot be assigned'}
        </span>
      )
    }
    return undefined
  })()

  const readOnlyBox: React.CSSProperties = {
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: 12,
    background: 'var(--color-hover-neutral)',
  }

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      title={editing ? t('form.editTitle') : t('form.newTitle')}
      width={640}
      destroyOnClose
      closable
    >
      <Form form={form} layout="vertical" className="app-form" requiredMark={false}>
        <Collapse
          accordion
          activeKey={activeKey}
          onChange={(k) => setActiveKey((Array.isArray(k) ? k[0] : k) as string)}
          className="create-it-accordion"
          items={[
            {
              key: 'basics',
              forceRender: true,
              label: <PanelHeader title={t('form.steps.basics')} summary={basicsSummary} />,
              children: (
                <>
                  <Form.Item
                    name="name"
                    label={t('form.name')}
                    rules={[{ required: true, whitespace: true, message: t('form.required') }]}
                  >
                    <Input
                      placeholder={t('form.namePlaceholder')}
                      style={{ height: 40, borderRadius: 8 }}
                    />
                  </Form.Item>
                  <Form.Item
                    name="topicId"
                    label={t('form.topic')}
                    rules={[{ required: true, message: t('form.required') }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Select
                      placeholder={t('form.topicPlaceholder')}
                      options={topics.map((tp) => ({ label: tp.name, value: tp.id }))}
                    />
                  </Form.Item>
                </>
              ),
            },
            {
              key: 'schedule',
              forceRender: true,
              label: <PanelHeader title={t('form.steps.schedule')} summary={scheduleSummary} />,
              children: (
                <>
                  <Form.Item
                    name="maxGuests"
                    label={t('form.maxGuests')}
                    extra={
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--color-text-subtle)',
                          fontFamily: 'Poppins, sans-serif',
                        }}
                      >
                        {t('form.minGuestsFixed')}
                      </span>
                    }
                    rules={[
                      { required: true, message: t('form.required') },
                      {
                        validator: (_, value?: number) =>
                          typeof value === 'number' &&
                          Number.isInteger(value) &&
                          value >= 4 &&
                          value <= 8
                            ? Promise.resolve()
                            : Promise.reject(new Error(t('form.required'))),
                      },
                    ]}
                  >
                    <GuestChips />
                  </Form.Item>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Form.Item
                      name="startDate"
                      label={t('form.startDate')}
                      style={{ flex: 1, minWidth: 160 }}
                      rules={[{ required: true, message: t('form.required') }]}
                    >
                      <DatePicker
                        style={{ width: '100%' }}
                        format="DD MMM YYYY"
                        // Today is a valid start date — only past days are blocked.
                        disabledDate={(current) => isPastDate(current, pakistanNow())}
                      />
                    </Form.Item>
                    <Form.Item
                      name="startTime"
                      label={t('form.startTimePkt')}
                      style={{ flex: 1, minWidth: 160 }}
                      rules={[
                        { required: true, message: t('form.required') },
                        {
                          pattern: /^\d{2}:\d{2}$/,
                          message: t('form.required'),
                        },
                        {
                          // Today is selectable, so a start time that has already
                          // gone by must be rejected rather than sent to the API.
                          validator: (_, value?: string) =>
                            isPastTimeOnDate(startDate, value, pakistanNow())
                              ? Promise.reject(new Error(t('form.startTimePast')))
                              : Promise.resolve(),
                        },
                      ]}
                      getValueProps={(value?: string) => ({ value: timeStringToDayjs(value) })}
                      normalize={(value: Dayjs | null) => value?.format('HH:mm')}
                    >
                      <TimePicker
                        format="HH:mm"
                        style={{ width: '100%' }}
                        placeholder={t('form.startTimePlaceholder')}
                        // Today is selectable, so hours/minutes already gone by are not.
                        disabledTime={isStartDateToday ? disabledPastTimesToday : undefined}
                      />
                    </Form.Item>
                  </div>
                  <Form.Item
                    name="durationHours"
                    label={t('form.duration')}
                    rules={[{ required: true, message: t('form.required') }]}
                    extra={
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--color-text-subtle)',
                          fontFamily: 'Poppins, sans-serif',
                        }}
                      >
                        {t('form.durationHelper')}
                      </span>
                    }
                    style={{ marginBottom: timeRange ? 12 : 0 }}
                  >
                    <Select
                      className="w-full"
                      placeholder={t('form.durationPlaceholder')}
                      options={DURATION_HOUR_OPTIONS.map((hours) => ({
                        value: hours,
                        label: `${hours} ${hours === 1 ? t('form.hour') : t('form.hours')}`,
                      }))}
                    />
                  </Form.Item>
                  {timeRange && (
                    <div style={readOnlyBox}>
                      <div style={SUBLABEL}>{t('form.runsLabel')}</div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--color-text)',
                          fontFamily: 'Poppins, sans-serif',
                        }}
                      >
                        {dayjs(startDate).format('DD MMM YYYY')} · {timeRange}
                      </div>
                    </div>
                  )}
                </>
              ),
            },
            {
              key: 'table',
              forceRender: true,
              label: <PanelHeader title={t('form.steps.tableCombos')} summary={tableSummary} />,
              children: (
                <>
                  <Form.Item
                    name="restaurantTableId"
                    label={t('form.table')}
                    rules={[{ required: true, message: t('form.required') }]}
                    extra={availabilityFeedback}
                  >
                    <Select
                      placeholder={t('form.tablePlaceholder')}
                      options={availableTables.map((tbl) => {
                        const dayRanges = selectedWeekday
                          ? (tbl.slots.find((s) => s.day === selectedWeekday)?.ranges ?? [])
                          : []
                        const timing = dayRanges.map((r) => `${r.start} – ${r.end}`).join(', ')
                        return {
                          label: timing ? `${tbl.name} · ${timing}` : tbl.name,
                          value: tbl.id,
                        }
                      })}
                    />
                  </Form.Item>
                  <Form.Item
                    name="menuOptionIds"
                    label={t('form.combos')}
                    rules={[
                      {
                        validator: (_, value?: string[]) =>
                          value && value.length >= 1 && value.length <= 3
                            ? Promise.resolve()
                            : Promise.reject(new Error(t('form.combosRequired'))),
                      },
                    ]}
                  >
                    <Select
                      mode="multiple"
                      placeholder={t('form.combosPlaceholder')}
                      options={comboOptions}
                    />
                  </Form.Item>
                  <Form.Item name="coverImage" hidden noStyle>
                    <Input />
                  </Form.Item>
                  <Form.Item label={t('form.coverImage')} style={{ marginBottom: 0 }}>
                    <Upload.Dragger
                      accept=".png,.jpg,.jpeg"
                      showUploadList={false}
                      beforeUpload={beforeCoverUpload}
                      disabled={uploadMutation.isPending}
                      className="app-upload-dragger"
                    >
                      <div
                        style={{
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 8,
                          padding: '4px 0',
                        }}
                      >
                        {uploadMutation.isPending ? (
                          <Spin size="small" />
                        ) : coverImage ? (
                          <div style={{ position: 'relative' }}>
                            <img
                              src={coverImage}
                              alt=""
                              style={{
                                width: 64,
                                height: 48,
                                borderRadius: 8,
                                objectFit: 'cover',
                                border: '1px solid var(--color-border)',
                              }}
                            />
                            <button
                              type="button"
                              aria-label={t('form.imageRemove')}
                              onClick={(e) => {
                                e.stopPropagation()
                                clearCoverImage()
                              }}
                              style={{
                                position: 'absolute',
                                top: -8,
                                right: -8,
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-bg, #fff)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              <X size={12} weight="bold" color="var(--color-text-muted)" />
                            </button>
                          </div>
                        ) : (
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              background: 'var(--color-accent-light)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <UploadSimple size={20} weight="regular" color="var(--color-accent)" />
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--color-text)',
                            fontFamily: 'Poppins, sans-serif',
                          }}
                        >
                          {uploadMutation.isPending
                            ? t('form.imageUploading')
                            : coverImage
                              ? t('form.imageReplace')
                              : t('form.coverImageTitle')}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--color-text-muted)',
                            fontFamily: 'Poppins, sans-serif',
                            lineHeight: 1.5,
                            textAlign: 'center',
                          }}
                        >
                          {t('form.coverImageHint')}
                        </div>
                      </div>
                    </Upload.Dragger>
                  </Form.Item>
                </>
              ),
            },
            {
              key: 'access',
              forceRender: true,
              label: <PanelHeader title={t('form.steps.access')} summary={accessSummary} />,
              children: (
                <>
                  <Form.Item name="mode" label={t('mode.label')} initialValue="available_now">
                    <Radio.Group>
                      <Radio value="available_now">{t('mode.available_now')}</Radio>
                      <Radio value="coming_soon">{t('mode.coming_soon')}</Radio>
                    </Radio.Group>
                  </Form.Item>

                  {hasMinglerAccess && (
                    <>
                      <Form.Item
                        name="inviteOnly"
                        label={t('inviteOnly.label')}
                        valuePropName="checked"
                        extra={
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--color-text-subtle)',
                              fontFamily: 'Poppins, sans-serif',
                            }}
                          >
                            {t('inviteOnly.helper')}
                          </span>
                        }
                      >
                        <Switch />
                      </Form.Item>

                      {inviteOnly && (
                        <Form.Item name="inviteList" label={t('inviteOnly.listLabel')}>
                          <Select
                            mode="multiple"
                            showSearch
                            filterOption={false}
                            onSearch={setInviteSearch}
                            onPopupScroll={handleInviteScroll}
                            loading={inviteQuery.isFetching}
                            placeholder={t('inviteOnly.listPlaceholder')}
                            options={inviteOptions}
                            notFoundContent={inviteQuery.isFetching ? <Spin size="small" /> : null}
                          />
                        </Form.Item>
                      )}

                      <Form.Item
                        name="prominglerEnabled"
                        label={t('promingler.label')}
                        valuePropName="checked"
                        extra={
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--color-text-subtle)',
                              fontFamily: 'Poppins, sans-serif',
                            }}
                          >
                            {t('promingler.helper')}
                          </span>
                        }
                      >
                        <Switch />
                      </Form.Item>

                      {prominglerEnabled && (
                        <Form.Item
                          name="prominglerMinglerId"
                          label={t('promingler.selectLabel')}
                          rules={[{ required: true, message: t('promingler.required') }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Select
                            showSearch
                            optionFilterProp="label"
                            loading={isLoadingProminglers}
                            placeholder={t('promingler.selectPlaceholder')}
                            options={prominglerOptions}
                            notFoundContent={isLoadingProminglers ? <Spin size="small" /> : null}
                          />
                        </Form.Item>
                      )}
                    </>
                  )}
                </>
              ),
            },
          ]}
        />

        <div className="app-modal-footer">
          <AppButton variant="neutral" onClick={handleClose}>
            {t('form.cancel')}
          </AppButton>
          {editing ? (
            <AppButton variant="primary" onClick={() => void submitEdit()} loading={submitting}>
              <Check size={14} weight="bold" />
              {t('form.saveChanges')}
            </AppButton>
          ) : (
            <>
              <AppButton
                variant="secondary"
                onClick={() => void submit(false)}
                disabled={submitting}
              >
                {t('form.saveDraft')}
              </AppButton>
              <AppButton variant="primary" onClick={() => void submit(true)} loading={submitting}>
                <Check size={14} weight="bold" />
                {t('form.createAndPublish')}
              </AppButton>
            </>
          )}
        </div>
      </Form>
    </Modal>
  )
}

const SUBLABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--color-text-subtle)',
  fontFamily: 'Poppins, sans-serif',
  marginBottom: 4,
}
