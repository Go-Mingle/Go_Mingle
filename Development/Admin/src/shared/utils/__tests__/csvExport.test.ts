import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportToCsv } from '../csvExport'

describe('exportToCsv', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    })
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clickSpy.mockRestore()
  })

  it('falls back to an empty string for missing cell values', async () => {
    exportToCsv('report.csv', [{ name: undefined }], [{ key: 'name', header: 'Name' }])
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob
    expect(await blob.text()).toBe('Name\n""')
  })

  it('renders provided cell values as quoted CSV', async () => {
    exportToCsv('report.csv', [{ name: 'Alice' }], [{ key: 'name', header: 'Name' }])
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob
    expect(await blob.text()).toBe('Name\n"Alice"')
    expect(clickSpy).toHaveBeenCalled()
  })
})
