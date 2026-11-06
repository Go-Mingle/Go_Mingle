import {
  FolderOpen,
  DownloadSimple,
  FilePdf,
  FileDoc,
  FileXls,
  FileImage,
  File,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { MediaFile } from './restaurantDetail.types'
import { downloadFileFromUrl } from '../../../shared/utils/downloadFile'

interface Props {
  documents: MediaFile[]
}

const getFileIcon = (fileType: string, size: number) => {
  const type = fileType?.toLowerCase()
  const style = { color: 'var(--color-accent)', flexShrink: 0 } as const
  if (type === 'pdf') return <FilePdf size={size} weight="regular" style={style} />
  if (['doc', 'docx'].includes(type)) return <FileDoc size={size} weight="regular" style={style} />
  if (['xls', 'xlsx', 'csv'].includes(type))
    return <FileXls size={size} weight="regular" style={style} />
  if (['jpg', 'jpeg', 'png', 'webp'].includes(type))
    return <FileImage size={size} weight="regular" style={style} />
  return <File size={size} weight="regular" style={style} />
}

export function RestaurantDocumentsTab({ documents }: Props) {
  const { t } = useTranslation('restaurants')

  if (documents.length === 0) {
    return (
      <div className="pt-5">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '48px 0',
            gap: 8,
          }}
        >
          <FolderOpen size={32} color="var(--color-text-subtle)" />
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {t('documents.noDocuments')}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-5">
      <div
        className="documents-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
        }}
      >
        {documents.map((file) => {
          const type = file.fileType ?? file.ext ?? file.filename.split('.').pop() ?? ''
          return (
            <div
              key={file.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'var(--color-card)',
                borderRadius: 12,
                boxShadow: 'var(--shadow-sm)',
                padding: 16,
                minWidth: 0,
              }}
            >
              {getFileIcon(type, 32)}
              <span
                title={file.caption ?? file.filename}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  fontFamily: 'Poppins, sans-serif',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {file.caption ?? file.filename}
              </span>
              <button
                type="button"
                aria-label={t('documents.download')}
                onClick={() => void downloadFileFromUrl(file.url ?? '#', file.filename)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
                  flexShrink: 0,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'var(--color-hover-neutral)',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 150ms ease-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-accent-light)'
                  e.currentTarget.style.color = 'var(--color-accent)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-hover-neutral)'
                  e.currentTarget.style.color = 'var(--color-text-secondary)'
                }}
              >
                <DownloadSimple size={18} weight="bold" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
