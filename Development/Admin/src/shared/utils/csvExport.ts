export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportToCsv(
  filename: string,
  rows: Record<string, unknown>[],
  columns: { key: string; header: string }[],
) {
  const header = columns.map((c) => c.header).join(',')
  const body = rows
    .map((r) => columns.map((c) => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const csv = `${header}\n${body}`
  downloadBlob(filename, new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
}
