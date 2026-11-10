import fs from 'node:fs'
import path from 'node:path'
import { Controller, Get, Inject, Param, Res } from '@nestjs/common'
import type { Response } from 'express'
import { eq } from 'drizzle-orm'
import { config } from '../config'
import { DB, type Db } from '../db/database'
import { amenities } from '../db/schema'

/** Brand teal used for catalogue amenity icons (legible on light and dark). */
const AMENITY_ICON_COLOR = '#0FA79D'

/**
 * Amenity icons for the partner catalogue: the admin's custom image, or the
 * Phosphor icon the amenity is named after.
 */
@Controller('amenity-icons')
export class AmenityIconsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get(':file')
  async icon(@Param('file') file: string, @Res() res: Response) {
    const id = file.replace(/\.svg$/, '')
    const [amenity] = await this.db.select().from(amenities).where(eq(amenities.id, id))
    if (!amenity) return res.status(404).end()
    const icon = String(amenity.iconUrl ?? '').trim()
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'")
    if (/^https?:\/\//.test(icon)) return res.redirect(icon)
    const data = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(icon)
    if (data) {
      res.setHeader('Content-Type', data[1])
      return res.send(data[2] ? Buffer.from(data[3], 'base64') : Buffer.from(decodeURIComponent(data[3])))
    }
    res.setHeader('Content-Type', 'image/svg+xml')
    if (icon.startsWith('<svg')) return res.send(icon)
    // A Phosphor icon draws in `currentColor`, which an <img> renders black:
    // unreadable on the dark theme. Paint it in the brand teal instead.
    const kebab = icon.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase() || 'star'
    const named = path.join(config.phosphorDir, `${path.basename(kebab)}.svg`)
    const svg = fs.readFileSync(fs.existsSync(named) ? named : path.join(config.phosphorDir, 'star.svg'), 'utf8')
    return res.send(svg.replace('fill="currentColor"', `fill="${AMENITY_ICON_COLOR}"`))
  }
}
