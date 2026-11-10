import { Flex, Pagination } from 'antd'
import { UsersPaginationRow } from './UsersPaginationRow'

interface UsersPaginationProps {
  isMobile: boolean
  total: number
  currentPage: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function UsersPagination({
  isMobile,
  total,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: UsersPaginationProps) {
  return isMobile ? (
    <Flex justify="center" className="pt-4">
      <Pagination
        current={currentPage}
        total={total}
        pageSize={pageSize}
        onChange={(page) => onPageChange(page)}
        showSizeChanger={false}
        size="small"
      />
    </Flex>
  ) : (
    <UsersPaginationRow
      total={total}
      currentPage={currentPage}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
    />
  )
}
