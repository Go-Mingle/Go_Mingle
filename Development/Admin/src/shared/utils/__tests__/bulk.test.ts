import { describe, expect, it } from 'vitest'
import { fetchAllPages, runBulk } from '../bulk'

describe('runBulk', () => {
  it('runs every item, at most `concurrency` at a time, and collects failures', async () => {
    let running = 0
    let peak = 0
    const progress: number[] = []
    const res = await runBulk(
      [1, 2, 3, 4, 5, 6, 7],
      async (n) => {
        running++
        peak = Math.max(peak, running)
        await new Promise((r) => setTimeout(r, 5))
        running--
        if (n % 3 === 0) throw new Error(`no ${n}`)
      },
      { concurrency: 3, onProgress: (f) => progress.push(f) },
    )
    expect(peak).toBe(3)
    expect(res.done.sort()).toEqual([1, 2, 4, 5, 7])
    expect(res.failed.map((f) => f.item).sort()).toEqual([3, 6])
    expect((res.failed[0].error as Error).message).toMatch(/^no /)
    expect(progress).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('does nothing for an empty list', async () => {
    expect(await runBulk([], async () => undefined)).toEqual({ done: [], failed: [] })
  })
})

describe('fetchAllPages', () => {
  const pages = (total: number, size: number) => async (page: number) => ({
    items: Array.from(
      { length: Math.max(0, Math.min(size, total - (page - 1) * size)) },
      (_, i) => (page - 1) * size + i,
    ),
    totalPages: Math.ceil(total / size),
  })

  it('reads every page', async () => {
    const res = await fetchAllPages(pages(120, 50), { pageSize: 50 })
    expect(res.items).toHaveLength(120)
    expect(res.truncated).toBe(false)
  })

  it('stops at the limit and says so', async () => {
    const res = await fetchAllPages(pages(400, 50), { pageSize: 50, max: 120 })
    expect(res.items).toHaveLength(120)
    expect(res.truncated).toBe(true)
  })

  it('handles an empty list', async () => {
    const res = await fetchAllPages(async () => ({ items: [], totalPages: 0 }))
    expect(res).toEqual({ items: [], truncated: false })
  })
})
