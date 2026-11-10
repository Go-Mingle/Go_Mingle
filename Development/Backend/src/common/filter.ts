import { ArgumentsHost, Catch, ExceptionFilter, HttpException, NotFoundException } from '@nestjs/common'
import type { Request, Response } from 'express'
import { ApiError } from './errors'

/**
 * Turns every error into the portals' error envelope:
 * ApiError → its body; unknown route → ERR_NOT_FOUND; anything else → 500.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest<Request>()
    if (res.headersSent) return

    if (exception instanceof ApiError) {
      res.status(exception.status).json(exception.toBody())
      return
    }
    if (exception instanceof NotFoundException) {
      res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` },
      })
      return
    }
    if (exception instanceof HttpException && exception.getStatus() < 500) {
      res.status(exception.getStatus()).json({
        success: false,
        error: { code: 'ERR_VALIDATION', message: exception.message },
      })
      return
    }
    console.error(exception)
    res.status(500).json({ success: false, error: { code: 'ERR_INTERNAL', message: 'Internal server error' } })
  }
}
