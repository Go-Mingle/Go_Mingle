import { Flex, Pagination, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import { REVIEWS_PAGE_SIZES } from '../constants'

interface ReviewsPaginationProps {
  isMobile: boolean
  total: number
  currentPage: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

/**
 * The reviews pager.
 *
 * Module-local rather than the shared `UsersPagination`, deliberately: that control's
 * size dropdown is built from `USERS_PAGE_SIZE_OPTIONS` (10/25/50/**100**), and this
 * endpoint accepts only 10/25/50. Offering 100 would let a partner pick a size the
 * server refuses and our own sanitiser then drops — a control that reports a page size
 * which never took effect, which is exactly what `UsersPaginationRow`'s own comment
 * warns against. J5 Finances hit the same mismatch and rendered its own row for the
 * same reason.
 *
 * `total` is the **filtered** count (`pagination.totalRecords`), never the summary's
 * all-time total.
 */
export function ReviewsPagination({
  isMobile,
  total,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: ReviewsPaginationProps) {
  const { t } = useTranslation(['restaurants', 'common'])

  if (isMobile) {
    return (
      <Flex justify="center" className="pt-4">
        <Pagination
          current={currentPage}
          total={total}
          pageSize={pageSize}
          onChange={onPageChange}
          showSizeChanger={false}
          size="small"
        />
      </Flex>
    )
  }

  const startRecord = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, total)

  return (
    <div className="mt-4 flex flex-row flex-nowrap items-center justify-end gap-4">
      <span className="shrink-0 whitespace-nowrap text-[13px] text-[var(--color-text-muted)]">
        {t('restaurants:partnerReviews.pagination.showing', {
          start: startRecord,
          end: endRecord,
          total: total.toLocaleString(),
        })}
      </span>

      <div className="shrink-0 leading-[0]">
        <Pagination
          current={currentPage}
          total={total}
          pageSize={pageSize}
          onChange={onPageChange}
          showSizeChanger={false}
          size="small"
        />
      </div>

      <Select
        value={pageSize}
        // Wrapped rather than passed directly: AntD calls `onChange(value, option)`, and
        // the controller's API takes a size, not an AntD option object.
        onChange={(value) => onPageSizeChange(value)}
        className="w-[100px] shrink-0"
        size="small"
        options={REVIEWS_PAGE_SIZES.map((value) => ({
          value,
          label: t('restaurants:partnerReviews.pagination.perPage', { size: value }),
        }))}
      />
    </div>
  )
}
