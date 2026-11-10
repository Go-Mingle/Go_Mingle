import { Pagination, Select } from 'antd'
import { pageSizeSelectOptions } from '../../../../shared/constants/pagination'

interface MinglersPaginationProps {
  currentPage: number
  pageSize: number
  total: number
  startRecord: number
  endRecord: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function MinglersPagination({
  currentPage,
  pageSize,
  total,
  startRecord,
  endRecord,
  onPageChange,
  onPageSizeChange,
}: MinglersPaginationProps) {
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
        <div className="minglers-pagination">
          <Pagination
            current={currentPage}
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
