import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { csvCell, datedFileName, exportToCsv } from '../csvExport'

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
    expect((await blob.text()).replace(/^\uFEFF/, '')).toBe('Name\n""')
  })

  it('renders provided cell values as quoted CSV', async () => {
    exportToCsv('report.csv', [{ name: 'Alice' }], [{ key: 'name', header: 'Name' }])
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob
    expect((await blob.text()).replace(/^\uFEFF/, '')).toBe('Name\n"Alice"')
    expect(clickSpy).toHaveBeenCalled()
  })

  it('starts with a byte-order mark so Excel reads UTF-8', async () => {
    exportToCsv('report.csv', [{ name: 'کراچی' }], [{ key: 'name', header: 'Name' }])
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  })
})

describe('csvCell', () => {
  it('defuses text a spreadsheet would run as a formula', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"')
    expect(csvCell('+92 300')).toBe('"\'+92 300"')
    expect(csvCell('@sum')).toBe('"\'@sum"')
  })
  it('leaves numbers and ordinary text alone', () => {
    expect(csvCell(-1200)).toBe('"-1200"')
    expect(csvCell('Kolachi')).toBe('"Kolachi"')
    expect(csvCell(null)).toBe('""')
  })
})

describe('datedFileName', () => {
  it('adds the date', () => {
    expect(datedFileName('restaurants', new Date('2026-11-20T10:00:00Z'))).toBe(
      'restaurants-2026-11-20.csv',
    )
  })
})
