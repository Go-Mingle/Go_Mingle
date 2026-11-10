import { CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { from, lastValueFrom, Observable } from 'rxjs'
import { jsonBody } from '../../common/http'
import type { AdminRequest } from '../../admin/access/admin.guard'
import { ChangeLogService } from './changelog.service'

const NO_AUDIT = 'gomingle:no-audit'

/** Routes that write their own change-log row (or none). */
export const NoAudit = () => SetMetadata(NO_AUDIT, true)

/** `/admin/api/v1/roles/r2` → `/api/v1/roles/r2` (the paths the change log knows). */
export const adminPath = (req: { path: string }) => req.path.replace(/^\/admin(?=\/)/, '')

/**
 * Records every successful admin change in the change log: looks up the
 * target before the change, runs it, and logs the outcome.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly changeLog: ChangeLogService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AdminRequest>()
    const mutation = req.method !== 'GET' && req.method !== 'HEAD'
    const skip = this.reflector.getAllAndOverride<boolean>(NO_AUDIT, [context.getHandler(), context.getClass()])
    if (!mutation || skip) return next.handle()

    const path = adminPath(req)
    return from(
      (async () => {
        const target = await this.changeLog.describeTarget(path)
        const value = await lastValueFrom(next.handle(), { defaultValue: undefined })
        const res = context.switchToHttp().getResponse<{ statusCode: number }>()
        if (res.statusCode < 400) {
          const result =
            value && typeof value === 'object' && 'data' in (value as object) ? ((value as { data: unknown }).data ?? value) : value ?? null
          await this.changeLog.record({ method: req.method, path, body: jsonBody(req), adminUser: req.admin, target, result })
        }
        return value
      })(),
    )
  }
}
