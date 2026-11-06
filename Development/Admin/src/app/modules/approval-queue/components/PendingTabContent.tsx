import { Flex, Pagination, Grid } from 'antd'
import type { Application, ListApprovalsQueryParams } from '../types'
import { PaginationRow } from './PaginationRow'
import { PendingTable } from './PendingTable'
import { PendingCardList } from './PendingCardList'

interface PendingTabContentProps {
  data: Application[]
  loading?: boolean
  total: number
  page: number
  pageSize: number
  onQueryParamsChange: (params: Partial<ListApprovalsQueryParams>) => void
  onApprove: (r: Application) => void
  onReject: (r: Application) => void
  onView: (id: string) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function PendingTabContent({
  data,
  loading,
  total,
  page,
  pageSize,
  onQueryParamsChange,
  onApprove,
  onReject,
  onView,
  onPageChange,
  onPageSizeChange,
}: PendingTabContentProps) {
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  return (
    <>
      {isMobile ? (
        <PendingCardList data={data} onApprove={onApprove} onReject={onReject} onView={onView} />
      ) : (
        <PendingTable
          data={data}
          loading={loading}
          onQueryParamsChange={onQueryParamsChange}
          onApprove={onApprove}
          onReject={onReject}
        />
      )}

      {isMobile ? (
        <Flex justify="center" className="pt-4">
          <Pagination
            current={page}
            total={total}
            pageSize={pageSize}
            onChange={onPageChange}
            showSizeChanger={false}
            size="small"
          />
        </Flex>
      ) : (
        <PaginationRow
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </>
  )
}
