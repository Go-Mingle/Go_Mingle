import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../../mocks/server'
import { resetMockProfile } from '../../../../../../mocks/data/partnerRestaurantProfile'
import { resetMockMedia } from '../../../../../../mocks/data/partnerMedia'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import { PARTNER_MEDIA_ENDPOINTS } from '../../constants'

/**
 * The gallery poll.
 *
 * There is no webhook — the provider reports readiness only when asked — so the
 * `processing` → `ready` transition is picked up by polling. The interval is
 * shortened here so the test does not sit for five seconds; what matters is that
 * it polls *while* something is processing and stops once nothing is.
 */
vi.mock('../../constants', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../constants')>()),
  VIDEO_POLL_MS: 40,
}))

const { usePartnerMediaQuery } = await import('../usePartnerMediaQueries')

function renderGallery() {
  const queryClient = makeQueryClient()
  return renderHook(() => usePartnerMediaQuery(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  })
}

/** Serves `processing` until the given read, then `ready`. */
function galleryThatBecomesReadyOnRead(readyOnRead: number): () => number {
  let reads = 0
  server.use(
    http.get(`*${PARTNER_MEDIA_ENDPOINTS.media}`, () => {
      reads += 1
      const ready = reads >= readyOnRead
      return HttpResponse.json({
        success: true,
        data: {
          photos: { count: 0, max: 20, items: [] },
          videos: {
            count: 1,
            max: 5,
            items: [
              {
                mediaId: 'v-1',
                name: 'clip.mp4',
                status: ready ? 'ready' : 'processing',
                url: ready ? 'https://stream/v-1.m3u8' : null,
                thumbnailUrl: ready ? 'https://stream/v-1.jpg' : null,
                size: 4096,
                uploadedAt: '2026-08-11T10:00:00Z',
                sortOrder: 1,
              },
            ],
          },
        },
      })
    }),
  )
  return () => reads
}

beforeEach(() => {
  resetMockProfile()
  resetMockMedia()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('usePartnerMediaQuery — the video poll', () => {
  it('keeps polling until a processing video reports ready', async () => {
    const readCount = galleryThatBecomesReadyOnRead(3)
    const { result } = renderGallery()

    await waitFor(
      () => {
        expect(result.current.data?.videos.items[0].status).toBe('ready')
      },
      { timeout: 3000 },
    )
    // Took more than the initial read, so it genuinely polled.
    expect(readCount()).toBeGreaterThanOrEqual(3)
  })

  /** A gallery with nothing processing must not leave a timer running. */
  it('stops polling once every video is ready', async () => {
    const readCount = galleryThatBecomesReadyOnRead(1)
    const { result } = renderGallery()

    await waitFor(() => {
      expect(result.current.data?.videos.items[0].status).toBe('ready')
    })

    const afterReady = readCount()
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(readCount()).toBe(afterReady)
  })

  it('does not poll a gallery with no videos at all', async () => {
    let reads = 0
    server.use(
      http.get(`*${PARTNER_MEDIA_ENDPOINTS.media}`, () => {
        reads += 1
        return HttpResponse.json({
          success: true,
          data: {
            photos: { count: 0, max: 20, items: [] },
            videos: { count: 0, max: 5, items: [] },
          },
        })
      }),
    )

    const { result } = renderGallery()
    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })

    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(reads).toBe(1)
  })

  it('picks up the url and thumbnail once ready', async () => {
    galleryThatBecomesReadyOnRead(2)
    const { result } = renderGallery()

    await waitFor(
      () => {
        expect(result.current.data?.videos.items[0].url).toBeTruthy()
      },
      { timeout: 3000 },
    )
    expect(result.current.data?.videos.items[0].thumbnailUrl).toBeTruthy()
  })

  it('does not fetch without a session', () => {
    tokenStore.clear()
    const { result } = renderGallery()
    expect(result.current.data).toBeUndefined()
  })
})
