import { Pagination, Select } from 'antd'
import { USERS_PAGE_SIZE_OPTIONS } from '../constants'

interface UsersPaginationRowProps {
  total: number
  currentPage: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function UsersPaginationRow({
  total,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: UsersPaginationRowProps) {
  const startRecord = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, total)

  return (
    <div className="users-pagination flex flex-row flex-nowrap items-center justify-end gap-4 mt-4">
      <span className="text-[13px] text-[var(--color-text-muted)] whitespace-nowrap shrink-0">
        Showing {startRecord}–{endRecord} of {total.toLocaleString()} results
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
        onChange={(val) => onPageSizeChange(val)}
        className="w-[112px] shrink-0"
        size="small"
        // 10/25/50/100 are the sizes the API accepts; anything else silently
        // falls back to its default of 25, which would make this control lie.
        options={USERS_PAGE_SIZE_OPTIONS.map((value) => ({
          value,
          label: `${value} / page`,
        }))}
      />
    </div>
  )
}
