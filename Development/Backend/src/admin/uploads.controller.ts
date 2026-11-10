import crypto from 'node:crypto'
import { Controller, Get, HttpCode, Inject, Post, Put, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'
import { eq } from 'drizzle-orm'
import { config } from '../config'
import { DB, type Db } from '../db/database'
import { bucketObjects } from '../db/schema'
import { Body } from '../common/http'
import { AdminGuard } from './access/admin.guard'

/** Content type → extension; the caller's file name is never used for the key. */
const CONTENT_TYPE_EXT: Readonly<Record<string, string>> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
/** Purpose → key prefix. */
const PURPOSE_PREFIX: Readonly<Record<string, string>> = { TOPIC_GRAPHIC: 'topics/', INTEREST_TABLE_COVER: 'covers/' }

/** Public URL of an uploaded object. */
export function bucketObjectUrl(key: string): string {
  return `${config.publicUrl}/mock-bucket/${key}`
}

/** Signed-URL uploads for the Admin Panel: /admin/api/v1/uploads/signed-url */
@Controller('admin/api/v1/uploads')
@UseGuards(AdminGuard)
export class UploadsController {
  @Post('signed-url')
  @HttpCode(200)
  signedUrl(@Body() body: { fileName?: string; contentType?: string; purpose?: string }) {
    const prefix = PURPOSE_PREFIX[body.purpose ?? ''] ?? 'covers/'
    const ext = CONTENT_TYPE_EXT[body.contentType ?? ''] ?? 'png'
    const key = `${prefix}${crypto.randomUUID()}.${ext}`
    return { success: true, data: { uploadUrl: `${bucketObjectUrl(key)}?signature=mock`, key } }
  }
}

/**
 * The upload bucket: the client PUTs the bytes to the signed URL, and the
 * public URL serves them back. Stored in PostgreSQL locally; S3 + CloudFront
 * at go-live (GM-247).
 */
@Controller('mock-bucket')
export class BucketController {
  constructor(@Inject(DB) private readonly db: Db) {}

  private key(req: Request) {
    return decodeURIComponent(req.path.replace(/^\/mock-bucket\//, ''))
  }

  @Put('*path')
  async put(@Req() req: Request, @Res() res: Response) {
    const contentType = req.headers['content-type']
    // A signed upload always carries its content type.
    if (!contentType) return res.status(403).end()
    const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    await this.db
      .insert(bucketObjects)
      .values({ key: this.key(req), bytes, contentType })
      .onConflictDoUpdate({ target: bucketObjects.key, set: { bytes, contentType } })
    return res.status(200).end()
  }

  @Get('*path')
  async get(@Req() req: Request, @Res() res: Response) {
    const [object] = await this.db.select().from(bucketObjects).where(eq(bucketObjects.key, this.key(req)))
    if (!object) return res.status(404).end()
    res.setHeader('Content-Type', object.contentType)
    res.setHeader('Cache-Control', 'public, max-age=31536000')
    return res.status(200).end(object.bytes)
  }
}
