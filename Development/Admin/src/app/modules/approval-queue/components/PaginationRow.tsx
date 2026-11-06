import { Pagination, Select } from 'antd'
import { pageSizeSelectOptions } from '../../../../shared/constants/pagination'

interface PaginationRowProps {
  total: number
  page: number
  pageSize: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
}

export function PaginationRow({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationRowProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

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
        Showing {start}–{end} of {total.toLocaleString()} results
      </span>
      <span style={{ flexShrink: 0, lineHeight: 0 }}>
        <div className="approval-queue-pagination">
          <Pagination
            current={page}
            total={total}
            pageSize={pageSize}
            onChange={onPageChange}
            showSizeChanger={false}
            size="small"
          />
        </div>
      </span>
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
