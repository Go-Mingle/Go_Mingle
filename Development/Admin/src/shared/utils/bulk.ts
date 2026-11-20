/**
 * Runs `task` for each item with a small concurrency limit, so a bulk action
 * on 50 rows doesn't fire 50 requests at once. Each item is its own API call,
 * so the API writes one audit entry per record. Never throws: failures are
 * collected with their error so the caller can say which rows didn't change.
 */
export interface BulkResult<T> {
  done: T[]
  failed: { item: T; error: unknown }[]
}

export async function runBulk<T>(
  items: readonly T[],
  task: (item: T) => Promise<unknown>,
  {
    concurrency = 3,
    onProgress,
  }: { concurrency?: number; onProgress?: (finished: number) => void } = {},
): Promise<BulkResult<T>> {
  const result: BulkResult<T> = { done: [], failed: [] }
  let next = 0
  let finished = 0
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++]
      try {
        await task(item)
        result.done.push(item)
      } catch (error) {
        result.failed.push({ item, error })
      }
      finished += 1
      onProgress?.(finished)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return result
}

/**
 * Loads every page of a list with the current filters. Stops at `max` rows so
 * an export can never run away; `truncated` says when that happened.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<{ items: T[]; totalPages: number }>,
  { pageSize = 50, max = 5000 }: { pageSize?: number; max?: number } = {},
): Promise<{ items: T[]; truncated: boolean }> {
  const items: T[] = []
  for (let page = 1; ; page++) {
    const res = await fetchPage(page, pageSize)
    items.push(...res.items)
    if (items.length >= max) return { items: items.slice(0, max), truncated: true }
    if (page >= res.totalPages || res.items.length === 0) return { items, truncated: false }
  }
}
