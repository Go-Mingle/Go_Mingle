import { Pagination, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import { INTERESTS_PAGE_SIZE_OPTIONS } from '../constants'

interface InterestsPaginationProps {
  currentPage: number
  pageSize: number
  total: number
  startRecord: number
  endRecord: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function InterestsPagination({
  currentPage,
  pageSize,
  total,
  startRecord,
  endRecord,
  onPageChange,
  onPageSizeChange,
}: InterestsPaginationProps) {
  const { t } = useTranslation('interests')
  return (
    <div
      className="interests-pagination"
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
        {t('pagination.showing', {
          start: startRecord,
          end: endRecord,
          total: total.toLocaleString(),
        })}
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
      <Select
        value={pageSize}
        onChange={onPageSizeChange}
        style={{ width: 100, flexShrink: 0 }}
        size="small"
        options={INTERESTS_PAGE_SIZE_OPTIONS.map((n) => ({
          value: n,
          label: t('pagination.perPage', { n }),
        }))}
      />
    </div>
  )
}
