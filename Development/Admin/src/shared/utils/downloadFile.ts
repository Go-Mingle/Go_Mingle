import { downloadBlob } from './csvExport'

export async function downloadFileFromUrl(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Download failed with status ${response.status}`)
    const blob = await response.blob()
    downloadBlob(filename, blob)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
