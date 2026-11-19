import type { PhotoCrop, PhotoRole } from './types'
import { ROLE_OUTPUT } from './constants'

/** A rectangle in the photo's own pixels, as the cropper reports it. */
export interface PixelArea {
  x: number
  y: number
  width: number
  height: number
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/**
 * The cropper's percentages (0 to 100) as the fractions the API stores, kept
 * inside the photo so rounding never pushes an edge past it.
 */
export function toFractions(area: PixelArea): PhotoCrop {
  const x = clamp01(area.x / 100)
  const y = clamp01(area.y / 100)
  return {
    x,
    y,
    width: Math.min(clamp01(area.width / 100), 1 - x),
    height: Math.min(clamp01(area.height / 100), 1 - y),
  }
}

/** Stored fractions back as the cropper's percentages, to reopen on a saved crop. */
export function toPercentages(crop: PhotoCrop): PixelArea {
  return { x: crop.x * 100, y: crop.y * 100, width: crop.width * 100, height: crop.height * 100 }
}

/** Output size for a role: its target, scaled down to the pixels actually selected so nothing is upscaled. */
export function outputSize(role: PhotoRole, area: PixelArea) {
  const target = ROLE_OUTPUT[role]
  const scale = Math.min(1, area.width / target.width, area.height / target.height)
  return {
    width: Math.max(1, Math.round(target.width * scale)),
    height: Math.max(1, Math.round(target.height * scale)),
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    // The photo is served from the API's media host; the canvas stays readable only with CORS.
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The photo could not be loaded.'))
    image.src = url
  })
}

/**
 * Cuts the chosen part of a photo into a new JPEG, sized for its role. Done in
 * the browser so the API only stores the result.
 */
export async function cropToBlob(url: string, area: PixelArea, role: PhotoRole): Promise<Blob> {
  const image = await loadImage(url)
  const size = outputSize(role, area)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot crop photos.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size.width, size.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The photo could not be cropped.'))),
      'image/jpeg',
      0.9,
    )
  })
}
