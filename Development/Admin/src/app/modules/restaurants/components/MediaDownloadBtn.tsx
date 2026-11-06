import { DownloadSimple } from '@phosphor-icons/react'
import { downloadFileFromUrl } from '../../../../shared/utils/downloadFile'

interface DownloadBtnProps {
  url: string
  filename: string
}

export function DownloadBtn({ url, filename }: DownloadBtnProps) {
  return (
    <div
      className="download-btn"
      onClick={(e) => {
        e.stopPropagation()
        void downloadFileFromUrl(url, filename)
      }}
      style={{
        width: 28,
        height: 28,
        borderRadius: 12,
        border: '1px solid var(--color-border)',
        background: 'var(--color-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 150ms ease-out',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-accent)'
        e.currentTarget.style.background = 'var(--color-accent-light)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border)'
        e.currentTarget.style.background = 'var(--color-card)'
      }}
    >
      <DownloadSimple size={14} color="var(--color-text-muted)" />
    </div>
  )
}
