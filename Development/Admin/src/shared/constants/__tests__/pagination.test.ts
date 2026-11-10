import { describe, it, expect } from 'vitest'
import { PAGE_SIZE_OPTIONS, pageSizeSelectOptions } from '../pagination'

describe('pagination constants', () => {
  it('offers only 10 / 25 / 50 page sizes', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 25, 50])
  })

  it('builds "N / page" select options aligned with PAGE_SIZE_OPTIONS', () => {
    expect(pageSizeSelectOptions).toEqual([
      { value: 10, label: '10 / page' },
      { value: 25, label: '25 / page' },
      { value: 50, label: '50 / page' },
    ])
  })
})
