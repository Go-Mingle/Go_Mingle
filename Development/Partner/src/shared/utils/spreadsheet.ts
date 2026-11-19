/**
 * Reads the first sheet of an .xlsx file or a .csv file in the browser and
 * maps its rows to records by header name. Nothing is uploaded: the import
 * dialogs send each valid row through the same endpoints as the forms.
 */

export const IMPORT_MAX_ROWS = 500
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024
export const IMPORT_ACCEPT =
  '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv'

export type SheetError = 'type' | 'size' | 'empty' | 'tooMany' | 'unreadable'

export class SpreadsheetError extends Error {
  readonly reason: SheetError
  constructor(reason: SheetError) {
    super(reason)
    this.reason = reason
  }
}

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/** Escapes one value for a CSV cell. */
export const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n')

/** Starts a download of `content` as a file, with a BOM so Excel reads UTF-8. */
export function downloadCsv(fileName: string, rows: unknown[][]) {
  const blob = new Blob(['\uFEFF' + toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const cellText = (v: unknown): string => {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).trim()
}

/** Reads the file into rows of trimmed strings, header row first. */
export async function readSheet(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase()
  const isCsv = name.endsWith('.csv')
  const isXlsx = name.endsWith('.xlsx')
  if (!isCsv && !isXlsx) throw new SpreadsheetError('type')
  if (file.size > IMPORT_MAX_BYTES) throw new SpreadsheetError('size')

  let rows: string[][]
  try {
    if (isCsv) {
      rows = parseCsv(await file.text()).map((r) => r.map((c) => c.trim()))
    } else {
      const { readSheet: readXlsxSheet } = await import('read-excel-file/browser')
      const raw = (await readXlsxSheet(file)) as unknown[][]
      rows = raw.map((r) => r.map(cellText)).filter((r) => r.some((c) => c !== ''))
    }
  } catch {
    throw new SpreadsheetError('unreadable')
  }
  if (rows.length < 2) throw new SpreadsheetError('empty')
  if (rows.length - 1 > IMPORT_MAX_ROWS) throw new SpreadsheetError('tooMany')
  return rows
}

export interface ImportColumn<K extends string> {
  key: K
  /** Header names accepted for this column, compared without case, spaces or punctuation. */
  headers: string[]
  required?: boolean
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Maps rows to records by header. Returns the required columns that were not found. */
export function mapRows<K extends string>(rows: string[][], columns: ImportColumn<K>[]) {
  const header = rows[0].map(norm)
  const index = new Map<K, number>()
  for (const col of columns) {
    const i = header.findIndex((h) => col.headers.some((alias) => norm(alias) === h))
    if (i >= 0) index.set(col.key, i)
  }
  const missing = columns.filter((c) => c.required && !index.has(c.key)).map((c) => c.key)
  const records = rows.slice(1).map((r) => {
    const rec = {} as Record<K, string>
    for (const col of columns) {
      const i = index.get(col.key)
      rec[col.key] = i === undefined ? '' : (r[i] ?? '').trim()
    }
    return rec
  })
  return { records, missing }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
