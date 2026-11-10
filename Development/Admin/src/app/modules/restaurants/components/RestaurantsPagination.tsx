import { Pagination, Select } from 'antd'
import { pageSizeSelectOptions } from '../../../../shared/constants/pagination'

interface RestaurantsPaginationProps {
  currentPage: number
  pageSize: 10 | 25 | 50
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: 10 | 25 | 50) => void
}

export function RestaurantsPagination({
  currentPage,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: RestaurantsPaginationProps) {
  const startRecord = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, total)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
        paddingTop: 12,
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: 'var(--color-text-muted)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Showing {startRecord}–{endRecord} of {total.toLocaleString()} results
      </span>

      <span style={{ flexShrink: 0, lineHeight: 0 }}>
        <Pagination
          current={currentPage}
          total={total}
          pageSize={pageSize}
          onChange={onPageChange}
          showSizeChanger={false}
          size="small"
        />
      </span>

      <Select<10 | 25 | 50>
        value={pageSize}
        onChange={(val) => {
          onPageSizeChange(val)
        }}
        style={{ width: 100, flexShrink: 0 }}
        size="small"
        options={pageSizeSelectOptions}
      />
    </div>
  )
}
