import { describe, it, expect } from 'vitest'
import type { ColumnsType } from 'antd/es/table'
import { withFixedEnds } from '../withFixedEnds'

interface Row {
  id: string
}

const cols: ColumnsType<Row> = [
  { key: 'name', title: 'Name', dataIndex: 'name' },
  { key: 'city', title: 'City', dataIndex: 'city' },
  { key: 'actions', title: '', width: 96 },
]

describe('withFixedEnds', () => {
  it('pins the first column left and the last column right', () => {
    const result = withFixedEnds(cols)!
    expect(result[0].fixed).toBe('left')
    expect(result[result.length - 1].fixed).toBe('right')
  })

  it('leaves the middle columns untouched', () => {
    const result = withFixedEnds(cols)!
    expect(result[1].fixed).toBeUndefined()
  })

  it('applies default widths when the pinned columns have none', () => {
    const result = withFixedEnds(cols)!
    expect(result[0].width).toBe(200)
    // last column already had width 96 — it is preserved, not overridden
    expect(result[result.length - 1].width).toBe(96)
  })

  it('honours a custom firstWidth', () => {
    const result = withFixedEnds(cols, { firstWidth: 96 })!
    expect(result[0].width).toBe(96)
  })

  it('honours a custom lastWidth when the last column has no width', () => {
    const noWidth: ColumnsType<Row> = [
      { key: 'name', title: 'Name' },
      { key: 'actions', title: '' },
    ]
    const result = withFixedEnds(noWidth, { lastWidth: 140 })!
    expect(result[1].width).toBe(140)
  })

  it('does not pin the last column when pinLast is false', () => {
    const result = withFixedEnds(cols, { pinLast: false })!
    expect(result[0].fixed).toBe('left')
    expect(result[result.length - 1].fixed).toBeUndefined()
  })

  it('does not pin the first column when pinFirst is false', () => {
    const result = withFixedEnds(cols, { pinFirst: false })!
    expect(result[0].fixed).toBeUndefined()
    expect(result[result.length - 1].fixed).toBe('right')
  })

  it('preserves an existing width on the first column', () => {
    const withWidth: ColumnsType<Row> = [
      { key: 'name', title: 'Name', width: 320 },
      { key: 'actions', title: '' },
    ]
    const result = withFixedEnds(withWidth)!
    expect(result[0].width).toBe(320)
  })

  it('no-ops for a single-column table', () => {
    const single: ColumnsType<Row> = [{ key: 'name', title: 'Name' }]
    expect(withFixedEnds(single)).toBe(single)
  })

  it('no-ops for undefined columns', () => {
    expect(withFixedEnds(undefined)).toBeUndefined()
  })
})
