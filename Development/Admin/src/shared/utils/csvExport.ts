export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * One CSV cell. Text that a spreadsheet would run as a formula (starting with
 * = + - @, tab or carriage return) gets a leading apostrophe, so a restaurant
 * named "=HYPERLINK(…)" can't run anything when the file is opened (OWASP
 * CSV injection). Plain negative numbers are left alone.
 */
export function csvCell(value: unknown): string {
  let s = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export interface CsvColumn {
  key: string
  header: string
}

export function toCsv(rows: Record<string, unknown>[], columns: CsvColumn[]): string {
  const header = columns.map((c) => c.header).join(',')
  const body = rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(',')).join('\n')
  return `${header}\n${body}`
}

/** Downloads rows as CSV, with a byte-order mark so Excel reads Urdu and other non-Latin text. */
export function exportToCsv(
  filename: string,
  rows: Record<string, unknown>[],
  columns: CsvColumn[],
) {
  downloadBlob(filename, new Blob(['﻿', toCsv(rows, columns)], { type: 'text/csv;charset=utf-8;' }))
}

/** `restaurants-2026-11-20.csv` */
export const datedFileName = (base: string, now = new Date()) =>
  `${base}-${now.toISOString().slice(0, 10)}.csv`
