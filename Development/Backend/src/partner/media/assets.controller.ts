import { Controller, Get, Param, Post, Put, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { MediaService } from './media.service'

/** Stable per path, so a tile keeps its colour across reloads. */
function hueOf(path: string): number {
  let hash = 0
  for (let index = 0; index < path.length; index += 1) hash = (hash * 31 + path.charCodeAt(index)) % 360
  return hash
}

/** A generic photo glyph for anything with no bytes behind it. */
function placeholderSvg(path: string): string {
  const hue = hueOf(path)
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">',
    `<rect width="400" height="300" fill="hsl(${String(hue)} 42% 88%)"/>`,
    `<g fill="none" stroke="hsl(${String(hue)} 38% 52%)" stroke-width="8" stroke-linejoin="round">`,
    '<rect x="118" y="92" width="164" height="122" rx="12"/>',
    '<path d="M130 196l46-48 33 33 27-25 34 40"/>',
    '</g>',
    `<circle cx="245" cy="128" r="12" fill="hsl(${String(hue)} 38% 52%)"/>`,
    '</svg>',
  ].join('')
}

/**
 * The upload target and the media CDN for partner files: /t/<restaurant>/mock-*.
 * Stands in for S3, CloudFront and the video provider until go-live (GM-247).
 */
@Controller('t/:restaurantId')
export class AssetsController {
  constructor(private readonly media: MediaService) {}

  /** A document download: the stored file. */
  @Get('mock-upload/signed-get/:mediaId')
  async download(@Param('restaurantId') restaurantId: string, @Param('mediaId') mediaId: string, @Res() res: Response) {
    const doc = await this.media.find(restaurantId, mediaId, 'document')
    if (doc?.bytes) {
      res.setHeader('Content-Type', doc.contentType)
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.name)}"`)
      return res.status(200).end(doc.bytes)
    }
    return res.status(200).end()
  }

  /** Step 2 of an upload: documents and photos PUT raw bytes, a video POSTs. */
  @Put('mock-upload/:uploadRef')
  put(@Param('restaurantId') restaurantId: string, @Param('uploadRef') uploadRef: string, @Req() req: Request, @Res() res: Response) {
    return this.receive(restaurantId, uploadRef, req, res)
  }

  @Post('mock-upload/:uploadRef')
  post(@Param('restaurantId') restaurantId: string, @Param('uploadRef') uploadRef: string, @Req() req: Request, @Res() res: Response) {
    return this.receive(restaurantId, uploadRef, req, res)
  }

  private async receive(restaurantId: string, uploadRef: string, req: Request, res: Response) {
    const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    return res.status((await this.media.receive(restaurantId, uploadRef, bytes)) ? 200 : 403).end()
  }

  /** Serves the uploaded bytes when we have them, a placeholder when we do not. */
  @Get('mock-cdn/*path')
  cdn(@Param('restaurantId') restaurantId: string, @Req() req: Request, @Res() res: Response) {
    return this.serve(restaurantId, req, res)
  }

  @Get('mock-stream/*path')
  stream(@Param('restaurantId') restaurantId: string, @Req() req: Request, @Res() res: Response) {
    return this.serve(restaurantId, req, res)
  }

  private async serve(restaurantId: string, req: Request, res: Response) {
    const file = req.path.split('/').pop() ?? ''
    const stored = await this.media.find(restaurantId, file.replace(/\.[^.]+$/, ''), 'photo')
    res.setHeader('Cache-Control', 'no-store')
    const menu = req.path.includes('/mock-cdn/menu/') ? await this.media.menuPdf(restaurantId, decodeURIComponent(file)) : null
    if (menu) {
      res.setHeader('Content-Type', 'application/pdf')
      return res.status(200).end(menu)
    }
    if (stored?.bytes && req.path.includes('/mock-cdn/')) {
      res.setHeader('Content-Type', stored.contentType)
      return res.status(200).end(stored.bytes)
    }
    res.setHeader('Content-Type', 'image/svg+xml')
    return res.status(200).end(placeholderSvg(req.path))
  }
}
