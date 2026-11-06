import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Spin, Alert, Form, Modal, Button, Grid, message } from 'antd'
import { Trash, PencilSimple, Plus } from '@phosphor-icons/react'
import { CategoryFormModal } from './CategoryFormModal'
import { PageHeader } from '../../molecules/PageHeader'
import { AppButton } from '../../atoms/AppButton'
import { CategoriesTable } from './components/CategoriesTable'
import { CategoriesPagination } from './components/CategoriesPagination'
import type { Category, CategoryFormValues } from './types'
import { HttpError } from '../../../shared/api/httpClient'
import {
  useCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
} from './hooks/useCategoriesQuery'

const CARD_CLS = 'bg-(--color-card) rounded-xl p-4 flex flex-col gap-3'

const LABEL_CLS =
  'text-[10px] font-semibold uppercase tracking-[0.06em] text-(--color-text-subtle) [font-family:var(--font-ui)] mb-[3px]'

const VALUE_BASE_CLS =
  'text-[13px] font-medium text-(--color-text-secondary) [font-family:var(--font-ui)]'

const ACTION_BTN_CLS =
  'h-8.5 px-[14px] inline-flex items-center gap-1.5 rounded-xl text-xs font-semibold [font-family:var(--font-ui)] cursor-pointer border-[1.5px]'

export function CategoriesPage() {
  const { t } = useTranslation('categories')
  const [messageApi, contextHolder] = message.useMessage()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [form] = Form.useForm()

  const { data: categories = [], isPending, isError } = useCategoriesQuery()
  const createMutation = useCreateCategoryMutation()
  const updateMutation = useUpdateCategoryMutation()
  const deleteMutation = useDeleteCategoryMutation()

  const handleSave = (v: CategoryFormValues) => {
    const id = editing?.id
    const name = v.name
    if (id) {
      updateMutation.mutate(
        { id, data: v },
        {
          onSuccess: () => {
            closeModal()
            void messageApi.success(t('form.updatedToast', { name }))
          },
        },
      )
    } else {
      createMutation.mutate(v, {
        onSuccess: () => {
          closeModal()
          void messageApi.success(t('form.createdToast', { name }))
        },
      })
    }
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setDeleteTarget(null)
        void messageApi.success(t('delete.deletedToast'))
      },
      onError: (error: unknown) => {
        if (error instanceof HttpError) {
          if (error.status === 409 && deleteTarget) {
            // Race condition: a restaurant was assigned between the UI check and DELETE.
            // Re-render as Cannot Delete modal with the server-reported count.
            const body = error.responseBody as {
              error?: { details?: { restaurantsCount?: number } }
            } | null
            const count = body?.error?.details?.restaurantsCount ?? 1
            setDeleteTarget({ ...deleteTarget, restaurantsCount: count })
          } else if (error.status === 404) {
            setDeleteTarget(null)
            void messageApi.error(t('common:errors.fetchError'))
          }
        }
      },
    })
  }

  if (isPending) return <Spin className="flex justify-center mt-20" />
  if (isError) return <Alert type="error" message={t('common:errors.fetchError')} className="m-4" />

  const openNew = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }
  const openEdit = (cat: Category) => {
    setEditing(cat)
    setModalOpen(true)
    // setTimeout(0) ensures the form is mounted before setFieldsValue runs;
    // otherwise the values can be silently discarded on first edit-open.
    setTimeout(() => {
      form.setFieldsValue({
        name: cat.name,
        commissionRate: cat.commissionRate,
      })
    }, 0)
  }
  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    form.resetFields()
  }

  const data = categories as Category[]
  const total = data.length
  const startRecord = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, total)
  const pagedData = data.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const hasRestaurants = ((deleteTarget?.restaurantsCount as number) ?? 0) > 0
  const restaurantsCount = (deleteTarget?.restaurantsCount as number) ?? 0
  const deleteName = (deleteTarget?.name as string) ?? ''

  return (
    <div className="flex flex-col">
      {contextHolder}
      <PageHeader
        title={t('title')}
        action={
          <AppButton variant="primary" onClick={openNew}>
            <Plus size={15} weight="bold" />
            {t('actions.newCategory')}
          </AppButton>
        }
      />

      {isMobile ? (
        <div className="categories-card-list">
          {pagedData.map((record) => {
            return (
              <div key={record.id} className={CARD_CLS}>
                {/* Row 1 — Name + restaurant count */}
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-(--color-text) [font-family:var(--font-ui)]">
                    {record.name}
                  </span>
                  <span className="text-xs text-(--color-text-muted)">
                    {record.restaurantsCount ?? 0} restaurant
                    {record.restaurantsCount === 1 ? '' : 's'}
                  </span>
                </div>

                {/* Row 2 — Commission */}
                <div>
                  <div className={LABEL_CLS}>{t('table.headers.commissionPercent')}</div>
                  <div className={VALUE_BASE_CLS}>{record.commissionRate ?? 0}%</div>
                </div>

                {/* Row 6 — Actions */}
                <div className="flex justify-end gap-2 pt-2.5 border-t border-(--color-divider)">
                  <button
                    onClick={() => openEdit(record)}
                    className={`${ACTION_BTN_CLS} bg-(--color-accent-light) text-accent-dark border-accent`}
                  >
                    <PencilSimple size={13} weight="regular" />
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(record)}
                    className={`${ACTION_BTN_CLS} bg-(--color-error-bg) text-(--color-error) border-(--color-error-border)`}
                  >
                    <Trash size={13} weight="regular" />
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <CategoriesTable pagedData={pagedData} onEdit={openEdit} onDeleteTarget={setDeleteTarget} />
      )}

      <CategoriesPagination
        currentPage={currentPage}
        pageSize={pageSize}
        total={total}
        startRecord={startRecord}
        endRecord={endRecord}
        onPageChange={setCurrentPage}
        onPageSizeChange={(val) => {
          setPageSize(val)
          setCurrentPage(1)
        }}
      />

      <CategoryFormModal
        open={modalOpen}
        editing={editing}
        form={form}
        submitting={createMutation.isPending || updateMutation.isPending}
        onClose={closeModal}
        onFinish={handleSave}
      />

      {/* Delete category — declarative Modal with 36/12 buttons */}
      <Modal
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        title={hasRestaurants ? t('delete.blockedTitle') : t('delete.confirmTitle')}
        width={420}
        footer={null}
        closable
        destroyOnClose
      >
        <p className="m-0 mt-1 text-sm text-(--color-text-muted) leading-[1.6]">
          {hasRestaurants
            ? t('delete.blockedContent', { name: deleteName, count: restaurantsCount })
            : t('delete.confirmContent', { name: deleteName })}
        </p>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-(--color-divider)">
          {hasRestaurants ? (
            <Button
              onClick={() => setDeleteTarget(null)}
              className="h-9! rounded-xl! [font-family:var(--font-ui)] text-[13px]!"
            >
              {t('delete.gotIt')}
            </Button>
          ) : (
            <>
              <Button
                onClick={() => setDeleteTarget(null)}
                className="h-9! rounded-xl! [font-family:var(--font-ui)] text-[13px]!"
              >
                {t('delete.cancel')}
              </Button>
              {deleteTarget && (
                <button
                  onClick={() => handleDelete(deleteTarget.id as string)}
                  className="inline-flex items-center gap-1.5 h-9 px-5 bg-(--color-error) hover:bg-(--color-error-dark) text-white border-none rounded-xl [font-family:var(--font-ui)] text-[13px] font-semibold cursor-pointer transition-[background] duration-150 ease-out whitespace-nowrap"
                >
                  <Trash size={14} weight="regular" color="white" />
                  {t('delete.confirm')}
                </button>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
