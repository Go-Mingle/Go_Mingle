import { describe, it, expect } from 'vitest'
import type { ColumnsType } from 'antd/es/table'
import { pinEndColumns } from '../tableColumns'

interface Row {
  id: string
}

describe('pinEndColumns', () => {
  it('returns undefined unchanged', () => {
    expect(pinEndColumns<Row>(undefined)).toBeUndefined()
  })

  it('is a no-op for fewer than 3 columns (nothing meaningful to anchor)', () => {
    const two: ColumnsType<Row> = [{ key: 'a' }, { key: 'b' }]
    // Same reference returned — not copied — when under the 3-column threshold.
    expect(pinEndColumns(two)).toBe(two)
  })

  it('pins the first column left and the last column right, leaving the middle alone', () => {
    const cols: ColumnsType<Row> = [{ key: 'name' }, { key: 'city' }, { key: 'actions' }]
    const pinned = pinEndColumns(cols)!

    expect(pinned[0]).toMatchObject({ key: 'name', fixed: 'left' })
    expect(pinned[2]).toMatchObject({ key: 'actions', fixed: 'right' })
    // Middle column is untouched — no `fixed` added.
    expect(pinned[1]).not.toHaveProperty('fixed')
    // Original array is not mutated.
    expect(cols[0]).not.toHaveProperty('fixed')
  })
})
