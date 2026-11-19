import { afterEach, describe, expect, it, vi } from 'vitest'
import { cropToBlob, outputSize, toFractions, toPercentages } from '../cropImage'

describe('crop maths', () => {
  it('turns the cropper percentages into fractions, kept inside the photo', () => {
    expect(toFractions({ x: 10, y: 25, width: 50, height: 50 })).toEqual({
      x: 0.1,
      y: 0.25,
      width: 0.5,
      height: 0.5,
    })
    // Rounding can push an edge past 100%: it is pulled back in.
    expect(toFractions({ x: 60, y: -0.0001, width: 40.01, height: 100.2 })).toEqual({
      x: 0.6,
      y: 0,
      width: 0.4,
      height: 1,
    })
  })

  it('reopens a saved crop as percentages', () => {
    expect(toPercentages({ x: 0.1, y: 0.2, width: 0.5, height: 0.25 })).toEqual({
      x: 10,
      y: 20,
      width: 50,
      height: 25,
    })
  })

  it('sizes the cut for its role without upscaling a small selection', () => {
    expect(outputSize('cover', { x: 0, y: 0, width: 3200, height: 1200 })).toEqual({
      width: 1600,
      height: 600,
    })
    expect(outputSize('cover', { x: 0, y: 0, width: 800, height: 300 })).toEqual({
      width: 800,
      height: 300,
    })
    expect(outputSize('profile', { x: 0, y: 0, width: 2000, height: 2000 })).toEqual({
      width: 640,
      height: 640,
    })
    expect(outputSize('profile', { x: 0, y: 0, width: 320, height: 320 })).toEqual({
      width: 320,
      height: 320,
    })
  })
})

describe('cropToBlob', () => {
  const realImage = globalThis.Image
  afterEach(() => {
    globalThis.Image = realImage
    vi.restoreAllMocks()
  })

  function fakeImage(fail = false) {
    class FakeImage {
      crossOrigin = ''
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        queueMicrotask(() => (fail ? this.onerror?.() : this.onload?.()))
      }
    }
    globalThis.Image = FakeImage as unknown as typeof Image
  }

  it('draws the chosen part onto a canvas sized for the role and returns a JPEG', async () => {
    fakeImage()
    const drawImage = vi.fn()
    const toBlob = vi.fn((cb: BlobCallback, type?: string) => cb(new Blob(['x'], { type })))
    vi.spyOn(document, 'createElement').mockImplementation(
      () =>
        ({
          width: 0,
          height: 0,
          getContext: () => ({ drawImage, imageSmoothingQuality: 'low' }),
          toBlob,
        }) as unknown as HTMLCanvasElement,
    )
    const blob = await cropToBlob(
      'https://cdn.example/p.jpg',
      { x: 10, y: 20, width: 1600, height: 600 },
      'cover',
    )
    expect(blob.type).toBe('image/jpeg')
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 10, 20, 1600, 600, 0, 0, 1600, 600)
    expect(toBlob.mock.calls[0][1]).toBe('image/jpeg')
  })

  it('fails clearly when the photo cannot be loaded or the canvas cannot be read', async () => {
    fakeImage(true)
    await expect(
      cropToBlob('https://cdn.example/p.jpg', { x: 0, y: 0, width: 10, height: 10 }, 'profile'),
    ).rejects.toThrow('The photo could not be loaded.')
    fakeImage()
    vi.spyOn(document, 'createElement').mockImplementation(
      () => ({ getContext: () => null }) as unknown as HTMLCanvasElement,
    )
    await expect(
      cropToBlob('https://cdn.example/p.jpg', { x: 0, y: 0, width: 10, height: 10 }, 'profile'),
    ).rejects.toThrow('This browser cannot crop photos.')
  })

  it('fails when the canvas produces nothing', async () => {
    fakeImage()
    vi.spyOn(document, 'createElement').mockImplementation(
      () =>
        ({
          getContext: () => ({ drawImage: vi.fn() }),
          toBlob: (cb: BlobCallback) => cb(null),
        }) as unknown as HTMLCanvasElement,
    )
    await expect(
      cropToBlob('https://cdn.example/p.jpg', { x: 0, y: 0, width: 10, height: 10 }, 'profile'),
    ).rejects.toThrow('The photo could not be cropped.')
  })
})
