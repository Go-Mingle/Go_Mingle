import { Flex, Pagination, Grid } from 'antd'
import type { Application, ListApprovalsQueryParams } from '../types'
import { PaginationRow } from './PaginationRow'
import { RejectedTable } from './RejectedTable'
import { RejectedCardList } from './RejectedCardList'

interface RejectedTabContentProps {
  data: Application[]
  loading?: boolean
  total: number
  page: number
  pageSize: number
  onQueryParamsChange: (params: Partial<ListApprovalsQueryParams>) => void
  onView: (id: string) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function RejectedTabContent({
  data,
  loading,
  total,
  page,
  pageSize,
  onQueryParamsChange,
  onView,
  onPageChange,
  onPageSizeChange,
}: RejectedTabContentProps) {
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  return (
    <>
      {isMobile ? (
        <RejectedCardList data={data} onView={onView} />
      ) : (
        <RejectedTable data={data} loading={loading} onQueryParamsChange={onQueryParamsChange} />
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
