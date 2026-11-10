import { Controller, Get, UseGuards } from '@nestjs/common'
import { ChangeLogService } from '../shared/changelog/changelog.service'
import { AdminGuard } from './access/admin.guard'

/** Change Log screen: /admin/api/v1/change-log (newest first). */
@Controller('admin/api/v1/change-log')
@UseGuards(AdminGuard)
export class ChangeLogController {
  constructor(private readonly changeLog: ChangeLogService) {}

  @Get()
  list() {
    return this.changeLog.list()
  }
}
