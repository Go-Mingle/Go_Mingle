import { useState, useCallback, useMemo, useEffect } from 'react'
import DOMPurify from 'dompurify'
import { withFixedEnds } from '../../molecules/withFixedEnds'
import { useTranslation } from 'react-i18next'
import {
  Table,
  Tooltip,
  Input,
  Button,
  Select,
  Pagination,
  Modal,
  Form,
  Grid,
  Upload,
  Spin,
  Alert,
  message,
} from 'antd'
import type { UploadProps } from 'antd'
import type { ColumnsType, TableProps } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import { PAGE_SIZE_OPTIONS } from '../../../shared/constants/pagination'
import {
  Plus,
  PencilSimple,
  Trash,
  MagnifyingGlass,
  ArrowsDownUp,
  ArrowUp,
  ArrowDown,
  Check,
  UploadSimple,
} from '@phosphor-icons/react'
import type { Amenity } from './types'
import {
  useAmenitiesQuery,
  useAmenityQuery,
  useCreateAmenityMutation,
  useUpdateAmenityMutation,
  useDeleteAmenityMutation,
} from './hooks/useAmenitiesQuery'
import { AmenityIconBadge } from './components/AmenityIconBadge'
import { SecondaryActionButton, PrimaryActionButton } from '../../atoms/ModalActions'
import { AppButton } from '../../atoms/AppButton'
import { ConfirmModal } from '../../molecules/ConfirmModal'
import { HttpError } from '../../../shared/api/httpClient'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import { isUnsafeSvgContent } from '../../../shared/utils/svgSafety'

function tableSortIcon({ sortOrder }: { sortOrder: 'ascend' | 'descend' | null }) {
  if (sortOrder === 'ascend') return <ArrowUp size={12} weight="bold" color="var(--color-accent)" />
  if (sortOrder === 'descend')
    return <ArrowDown size={12} weight="bold" color="var(--color-accent)" />
  return <ArrowsDownUp size={12} color="var(--color-text-subtle)" />
}

export function AmenitiesPage() {
  const { t } = useTranslation('amenities')
  const [messageApi, contextHolder] = message.useMessage()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  // Modal state
  const [newOpen, setNewOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Amenity | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Amenity | null>(null)

  // Query params state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  // Name is the only sortable column, so the sort key is always 'name'.
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [q, setQ] = useState('')

  // Form state
  const [amenityForm] = Form.useForm()
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [iconPreviewSvg, setIconPreviewSvg] = useState<string | null>(null)
  // Staged "reset to default" — set when the user clicks Reset while editing an
  // amenity that has an icon. The reset is not sent until the Save CTA fires, so
  // it can be batched with any name edit and cancelled by closing the modal.
  const [resetIconStaged, setResetIconStaged] = useState(false)
  // Content-level SVG validation (missing <svg> tag / unsafe markup) is
  // deferred until submit — beforeUpload only stages the file so the error
  // surfaces when the user presses the CTA, not the instant they pick a file.
  const [pendingSvgError, setPendingSvgError] = useState<'invalidSvg' | 'unsafeSvg' | null>(null)
  // True while FileReader is reading a just-selected file. The submit button
  // is disabled during this window so a fast click can't sneak past
  // validation before pendingSvgError has a chance to be set.
  const [svgProcessing, setSvgProcessing] = useState(false)
  // Cache-busting token per amenity id. The API replaces an icon at a stable
  // CDN key, so a fresh upload leaves iconUrl byte-identical and the browser
  // would keep serving the previously cached file. Bumping the token on a
  // successful upload forces the <img> request to miss the HTTP cache.
  const [iconVersions, setIconVersions] = useState<Record<string, number>>({})

  const isEditing = editTarget !== null
  const modalOpen = newOpen || isEditing

  const { data, isPending, isError } = useAmenitiesQuery({
    page,
    pageSize,
    sortBy: 'name',
    sortOrder,
    q,
  })
  // The edit modal is populated from the detail endpoint (GET /amenities/:id).
  const { data: editDetail } = useAmenityQuery(editTarget?.id)
  const createMutation = useCreateAmenityMutation()
  const updateMutation = useUpdateAmenityMutation()
  const deleteMutation = useDeleteAmenityMutation()

  // Sync the form name from the freshly-fetched amenity detail once it loads.
  useEffect(() => {
    if (editTarget && editDetail) {
      amenityForm.setFieldsValue({ name: editDetail.name })
    }
  }, [editDetail, editTarget, amenityForm])

  // Icon shown in the edit modal preview: prefer the detail response, fall back
  // to the list record while the detail request is in flight.
  const editIconUrl = editDetail?.iconUrl ?? editTarget?.iconUrl ?? null
  // Once a reset is staged the preview should read as icon-less (empty upload
  // state) even though the amenity still has an icon on the server.
  const effectiveEditIconUrl = resetIconStaged ? null : editIconUrl

  // Prefer the locally bumped token (set the moment an upload succeeds), and
  // fall back to the server's updatedAt so a replacement made in another
  // session is not served from cache either.
  const iconVersionFor = useCallback(
    (id: string, updatedAt?: string | null) => iconVersions[id] ?? updatedAt ?? null,
    [iconVersions],
  )
  const editIconVersion = editTarget
    ? iconVersionFor(editTarget.id, editDetail?.updatedAt ?? editTarget.updatedAt)
    : null

  const items = data?.items ?? []
  const totalRecords = data?.pagination?.totalRecords ?? 0
  const startRecord = totalRecords === 0 ? 0 : (page - 1) * pageSize + 1
  const endRecord = Math.min(page * pageSize, totalRecords)

  const handleTableChange: TableProps<Amenity>['onChange'] = useCallback(
    (_paginationInfo, filters, sorter) => {
      const single = Array.isArray(sorter)
        ? (sorter[0] as SorterResult<Amenity>)
        : (sorter as SorterResult<Amenity>)
      setSortOrder(single?.order === 'descend' ? 'desc' : 'asc')
      // Name-column search filter → API `q` param
      const nameFilter = (filters.name?.[0] as string | undefined)?.trim() ?? ''
      setQ(nameFilter)
      setPage(1)
    },
    [],
  )

  const handleMutationError = (error: unknown) => {
    void messageApi.error(getApiErrorMessage(error, t('common:errors.genericError')))
  }

  const handleSubmitAmenity = (values: { name: string }) => {
    if (pendingSvgError) {
      void messageApi.error(t(`form.${pendingSvgError}`))
      setIconFile(null)
      setIconPreviewSvg(null)
      setPendingSvgError(null)
      return
    }

    const trimmed = values.name.trim()
    const fd = new FormData()
    fd.append('name', trimmed)
    if (iconFile) fd.append('icon', iconFile)
    else if (resetIconStaged) fd.append('resetIcon', 'true')

    if (editTarget) {
      const targetId = editTarget.id
      const uploadedIcon = iconFile !== null
      updateMutation.mutate(
        { id: targetId, formData: fd },
        {
          onSuccess: () => {
            // A replaced icon keeps its CDN URL, so the badge needs a new
            // cache-busting token to stop showing the previous file.
            if (uploadedIcon) {
              setIconVersions((prev) => ({ ...prev, [targetId]: Date.now() }))
            }
            setEditTarget(null)
            amenityForm.resetFields()
            setIconFile(null)
            setIconPreviewSvg(null)
            setResetIconStaged(false)
            void messageApi.success(t('form.updatedToast', { name: trimmed }))
          },
          onError: (err) => {
            if (err instanceof HttpError && err.code === 'ERR_AMENITY_NAME_IN_USE') {
              amenityForm.setFields([{ name: 'name', errors: [t('form.nameInUse')] }])
              return
            }
            handleMutationError(err)
          },
        },
      )
      return
    }

    createMutation.mutate(fd, {
      onSuccess: () => {
        setNewOpen(false)
        amenityForm.resetFields()
        setIconFile(null)
        setIconPreviewSvg(null)
        setResetIconStaged(false)
        void messageApi.success(t('form.createdToast', { name: trimmed }))
      },
      onError: (err) => {
        if (err instanceof HttpError && err.code === 'ERR_AMENITY_NAME_IN_USE') {
          amenityForm.setFields([{ name: 'name', errors: [t('form.nameInUse')] }])
          return
        }
        handleMutationError(err)
      },
    })
  }

  const handleCloseFormModal = useCallback(() => {
    setNewOpen(false)
    setEditTarget(null)
    amenityForm.resetFields()
    setIconFile(null)
    setIconPreviewSvg(null)
    setResetIconStaged(false)
    setPendingSvgError(null)
    setSvgProcessing(false)
  }, [amenityForm])

  const handleOpenEdit = useCallback(
    (record: Amenity) => {
      amenityForm.setFieldsValue({ name: record.name })
      setIconFile(null)
      setIconPreviewSvg(null)
      setResetIconStaged(false)
      setPendingSvgError(null)
      setSvgProcessing(false)
      setEditTarget(record)
    },
    [amenityForm],
  )

  const uploadProps: UploadProps = {
    accept: '.svg,image/svg+xml',
    maxCount: 1,
    showUploadList: false,
    beforeUpload: (file) => {
      const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
      if (!isSvg) {
        void messageApi.error(t('form.invalidSvg'))
        return Upload.LIST_IGNORE
      }
      if (file.size > 100 * 1024) {
        void messageApi.error(t('form.svgTooLarge'))
        return Upload.LIST_IGNORE
      }
      setIconFile(file)
      setResetIconStaged(false)
      setPendingSvgError(null)
      setSvgProcessing(true)
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = (e.target?.result as string) ?? ''
        if (!text.trim().toLowerCase().includes('<svg')) {
          // Content-level errors surface at submit time, not immediately —
          // stage the file as-is so the CTA click is what reports the error.
          setPendingSvgError('invalidSvg')
          setSvgProcessing(false)
          return
        }
        if (isUnsafeSvgContent(text)) {
          setPendingSvgError('unsafeSvg')
          setSvgProcessing(false)
          return
        }
        setIconPreviewSvg(text)
        setSvgProcessing(false)
      }
      reader.readAsText(file)
      return Upload.LIST_IGNORE
    },
  }

  const columns = useMemo<ColumnsType<Amenity>>(
    () => [
      {
        title: t('table.headers.amenity'),
        dataIndex: 'name',
        key: 'name',
        align: 'left' as const,
        sorter: true,
        sortOrder: sortOrder === 'asc' ? 'ascend' : 'descend',
        sortIcon: tableSortIcon,
        filteredValue: q ? [q] : null,
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
          <div className="p-3 w-60">
            <Input
              autoFocus
              prefix={<MagnifyingGlass size={14} color="var(--color-text-subtle)" />}
              placeholder={t('table.search.amenities')}
              value={selectedKeys[0] as string}
              onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
              onPressEnter={() => confirm()}
              className="mb-2 rounded-xl"
            />
            <div className="flex gap-2 justify-end">
              <Button
                size="small"
                onClick={() => {
                  clearFilters?.()
                  confirm()
                }}
                className="!rounded-xl !border-[var(--color-border-strong)] !text-[var(--color-text-muted)] !text-xs"
              >
                {t('filters.reset')}
              </Button>
              <button
                type="button"
                onClick={() => confirm()}
                className="h-7 cursor-pointer rounded-xl border-none bg-[var(--color-accent)] px-3 font-[var(--font-ui)] text-xs font-semibold text-white transition-colors duration-150 hover:bg-[var(--color-accent-dark)]"
              >
                {t('filters.search')}
              </button>
            </div>
          </div>
        ),
        filterIcon: (filtered: boolean) => (
          <MagnifyingGlass
            size={14}
            weight={filtered ? 'fill' : 'regular'}
            color={filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)'}
          />
        ),
        render: (name: string, record) => (
          <div className="flex items-center gap-3">
            <AmenityIconBadge
              iconUrl={record.iconUrl}
              version={iconVersionFor(record.id, record.updatedAt)}
              bgClassName="bg-[var(--color-page)]"
            />
            <span className="text-sm font-medium text-[var(--color-text)] font-[var(--font-ui)]">
              {name}
            </span>
          </div>
        ),
      },
      {
        title: '',
        key: 'actions',
        width: 96,
        align: 'center' as const,
        render: (_: unknown, record: Amenity) => (
          <div
            className="inline-flex items-center justify-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Tooltip title={t('tooltips.edit')}>
              <div
                role="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenEdit(record)
                }}
                className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer text-[var(--color-text-muted)] transition-all duration-150 ease-out hover:bg-[var(--color-accent-light)] hover:text-[var(--color-accent)]"
              >
                <PencilSimple size={17} weight="regular" />
              </div>
            </Tooltip>
            <Tooltip title={t('tooltips.delete')}>
              <div
                role="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteTarget(record)
                }}
                className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer text-[var(--color-text-muted)] transition-all duration-150 ease-out hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]"
              >
                <Trash size={17} weight="regular" />
              </div>
            </Tooltip>
          </div>
        ),
      },
    ],
    [t, sortOrder, q, handleOpenEdit, iconVersionFor],
  )

  if (isPending) return <Spin className="flex justify-center mt-20" />
  if (isError) return <Alert type="error" message={t('common:errors.fetchError')} className="m-4" />

  const hasRestaurants = (deleteTarget?.restaurantsCount ?? 0) > 0
  const deleteName = deleteTarget?.name ?? ''
  const deleteCount = deleteTarget?.restaurantsCount ?? 0

  return (
    <div className="flex flex-col">
      {contextHolder}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1
          className={`${isMobile ? 'text-xl' : 'text-[26px]'} font-bold text-[var(--color-text)] m-0 font-[var(--font-ui)] leading-tight`}
        >
          {t('title')}
        </h1>
        <AppButton variant="primary" onClick={() => setNewOpen(true)}>
          <Plus size={15} weight="bold" />
          {t('actions.newAmenity')}
        </AppButton>
      </div>

      {/* Truly empty — no amenities exist and no active search. When a search
          is active the table stays mounted (below) so its column filter
          remains reachable, and no-results is shown via the table emptyText. */}
      {totalRecords === 0 && !q && (
        <div className="flex justify-center items-center py-16 text-sm text-[var(--color-text-muted)] font-[var(--font-ui)]">
          {t('emptyState.noAmenities')}
        </div>
      )}

      {(totalRecords > 0 || q) && (
        <>
          {isMobile ? (
            <div className="amenities-card-list flex flex-col gap-2.5">
              {items.map((amenity) => (
                <div
                  key={amenity.id}
                  className="bg-[var(--color-card)] rounded-xl shadow-[var(--shadow-sm)] p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3 justify-between">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <AmenityIconBadge
                        iconUrl={amenity.iconUrl}
                        version={iconVersionFor(amenity.id, amenity.updatedAt)}
                        bgClassName="bg-[var(--color-page)]"
                      />
                      <span className="text-sm font-medium text-[var(--color-text)] font-[var(--font-ui)] overflow-hidden text-ellipsis whitespace-nowrap">
                        {amenity.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2.5 border-t border-[var(--color-divider)]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenEdit(amenity)
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 bg-[var(--color-accent-light)] text-[var(--color-accent-dark)] border-[1.5px] border-[var(--color-accent)] rounded-xl font-[var(--font-ui)] text-xs font-semibold cursor-pointer"
                    >
                      <PencilSimple size={13} weight="regular" />
                      {t('tooltips.edit')}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(amenity)
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 bg-[var(--color-error-bg)] text-[var(--color-error)] border-[1.5px] border-[var(--color-error-border)] rounded-xl font-[var(--font-ui)] text-xs font-semibold cursor-pointer"
                    >
                      <Trash size={13} weight="regular" />
                      {t('tooltips.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="amenities-table">
              <Table<Amenity>
                dataSource={items}
                columns={withFixedEnds(columns)}
                rowKey="id"
                size="middle"
                pagination={false}
                scroll={{ x: 'max-content' }}
                onChange={handleTableChange}
                locale={{
                  emptyText: (
                    <div className="py-10 text-sm text-[var(--color-text-muted)] font-[var(--font-ui)]">
                      {t('emptyState.noResults')}
                    </div>
                  ),
                }}
              />
            </div>
          )}

          {/* Pagination — only when there are records to page through */}
          {totalRecords > 0 && (
            <div className="flex justify-end items-center gap-4 mt-4">
              {!isMobile && (
                <span className="text-[13px] text-[var(--color-text-muted)] font-[var(--font-ui)]">
                  {t('pagination.showing', {
                    start: startRecord,
                    end: endRecord,
                    total: totalRecords,
                  })}
                </span>
              )}
              <div className="amenities-pagination">
                <Pagination
                  current={page}
                  total={totalRecords}
                  pageSize={pageSize}
                  onChange={setPage}
                  showSizeChanger={false}
                  size={isMobile ? 'small' : undefined}
                />
              </div>
              {!isMobile && (
                <Select
                  value={pageSize}
                  onChange={(val) => {
                    setPageSize(val)
                    setPage(1)
                  }}
                  className="w-[110px]"
                  size="small"
                  options={PAGE_SIZE_OPTIONS.map((n) => ({
                    value: n,
                    label: t('pagination.perPage', { n }),
                  }))}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* New / Edit amenity modal */}
      <Modal
        open={modalOpen}
        onCancel={handleCloseFormModal}
        title={isEditing ? t('form.editTitle') : t('form.newTitle')}
        width={480}
        footer={null}
        closable
        destroyOnClose
        className="amenity-modal"
      >
        <Form
          form={amenityForm}
          layout="vertical"
          className="app-form"
          requiredMark={false}
          onFinish={handleSubmitAmenity}
        >
          <Form.Item
            name="name"
            label={t('form.amenityName')}
            rules={[
              { required: true, message: t('form.nameRequired') },
              { max: 60, message: t('form.nameMaxLength') },
              {
                validator: (_, value: string) =>
                  !value || value.trim().length > 0
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('form.nameInvalid'))),
              },
            ]}
          >
            <Input placeholder={t('form.amenityNamePlaceholder')} className="h-10 rounded-lg" />
          </Form.Item>

          {/* SVG upload */}
          <Form.Item label={t('form.iconLabel')}>
            <Upload.Dragger {...uploadProps} className="app-upload-dragger">
              <div className="flex flex-col items-center gap-2 py-1">
                {iconPreviewSvg ? (
                  <div className="w-12 h-12 rounded-lg bg-[var(--color-page)] flex items-center justify-center border border-[var(--color-border)] text-[var(--color-accent)] overflow-hidden">
                    <div
                      aria-hidden
                      className="w-6 h-6 flex items-center justify-center text-[var(--color-accent)]"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(iconPreviewSvg, {
                          USE_PROFILES: { svg: true, svgFilters: true },
                        }),
                      }}
                    />
                  </div>
                ) : isEditing && effectiveEditIconUrl ? (
                  <AmenityIconBadge
                    iconUrl={effectiveEditIconUrl}
                    version={editIconVersion}
                    containerSize={48}
                    size={22}
                    bgClassName="bg-[var(--color-page)]"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--color-accent-light)] flex items-center justify-center">
                    <UploadSimple size={20} weight="regular" color="var(--color-accent)" />
                  </div>
                )}
                <div className="text-[13px] font-semibold text-[var(--color-text)] font-[var(--font-ui)]">
                  {iconPreviewSvg || (isEditing && effectiveEditIconUrl)
                    ? t('form.iconReplace')
                    : t('form.iconUploadTitle')}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] font-[var(--font-ui)] leading-normal text-center">
                  {t('form.iconHelper')}
                </div>
              </div>
            </Upload.Dragger>
            {iconPreviewSvg && (
              <button
                type="button"
                onClick={() => {
                  setIconFile(null)
                  setIconPreviewSvg(null)
                }}
                className="mt-2 bg-transparent border-none p-0 text-[var(--color-error)] font-[var(--font-ui)] text-xs font-medium cursor-pointer"
              >
                {t('form.removeButton')}
              </button>
            )}
            {isEditing && effectiveEditIconUrl && (
              <button
                type="button"
                onClick={() => {
                  // Stage the reset only — it is sent with the Save CTA so it can
                  // be batched with a name edit and cancelled by closing the modal.
                  setResetIconStaged(true)
                  setIconFile(null)
                  setIconPreviewSvg(null)
                }}
                className="mt-2 block bg-transparent border-none p-0 text-(--color-text-muted) text-xs font-medium cursor-pointer hover:text-(--color-error) transition-colors duration-150"
              >
                {t('form.resetToDefault')}
              </button>
            )}
          </Form.Item>

          <div className="app-modal-footer">
            <SecondaryActionButton onClick={handleCloseFormModal}>
              {t('form.cancel')}
            </SecondaryActionButton>
            <PrimaryActionButton
              type="submit"
              disabled={svgProcessing}
              loading={createMutation.isPending || updateMutation.isPending}
            >
              <Check size={14} weight="bold" />
              {isEditing ? t('form.saveAmenity') : t('form.createAmenity')}
            </PrimaryActionButton>
          </div>
        </Form>
      </Modal>

      {/* Delete amenity modal */}
      <ConfirmModal
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          const name = deleteTarget.name
          deleteMutation.mutate(deleteTarget.id, {
            onSuccess: () => {
              setDeleteTarget(null)
              void messageApi.success(t('delete.deletedToast', { name }))
            },
          })
        }}
        danger
        icon={<Trash size={24} weight="fill" color="var(--color-error)" />}
        title={t('delete.title')}
        content={
          hasRestaurants
            ? t('delete.withAssignments', {
                name: deleteName,
                count: deleteCount,
                plural: deleteCount === 1 ? '' : 's',
              })
            : t('delete.confirm', { name: deleteName })
        }
        cancelText={t('delete.cancel')}
        confirmText={t('delete.confirmButton')}
      />
    </div>
  )
}
