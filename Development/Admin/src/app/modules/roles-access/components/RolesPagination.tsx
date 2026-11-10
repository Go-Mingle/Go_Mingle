import { Pagination, Select } from 'antd'
import { pageSizeSelectOptions } from '../../../../shared/constants/pagination'

interface RolesPaginationProps {
  currentPage: number
  pageSize: number
  total: number
  startRecord: number
  endRecord: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function RolesPagination({
  currentPage,
  pageSize,
  total,
  startRecord,
  endRecord,
  onPageChange,
  onPageSizeChange,
}: RolesPaginationProps) {
  return (
    <div
      className="roles-pagination"
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
