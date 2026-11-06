import { Pagination, Select } from 'antd'
import { pageSizeSelectOptions } from '../../../../shared/constants/pagination'

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
    <div
      className="users-pagination"
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 16,
        marginTop: 16,
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

      <div style={{ flexShrink: 0, lineHeight: 0 }}>
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
        style={{ width: 100, flexShrink: 0 }}
        size="small"
        options={pageSizeSelectOptions}
      />
    </div>
  )
}
