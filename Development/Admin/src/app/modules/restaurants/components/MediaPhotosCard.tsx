import { DownloadSimple } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { MediaPhoto } from '../restaurantDetail.types'
import { downloadFileFromUrl } from '../../../../shared/utils/downloadFile'

interface MediaPhotosCardProps {
  photos: MediaPhoto[]
}

export function MediaPhotosCard({ photos }: MediaPhotosCardProps) {
  const { t } = useTranslation('restaurants')
  return (
    <div
      style={{
        background: 'var(--color-card)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-sm)',
        padding: 24,
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>
          {t('media.photos')}
        </h3>
      </div>

      {photos.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '32px 0',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {t('media.noPhotos')}
          </span>
        </div>
      ) : (
        <div
          className="photos-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 10,
          }}
        >
          {photos.slice(0, 10).map((photo: MediaPhoto) => (
            <div
              key={photo.id}
              className="media-cell"
              style={{
                position: 'relative',
                aspectRatio: '1 / 1',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <img
                src={photo.url}
                alt={photo.caption ?? photo.filename}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <div
                className="media-overlay"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(13,34,51,0.72)',
                  opacity: 0,
                  transition: 'opacity 150ms ease-out',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: 8,
                  textAlign: 'center',
                }}
              >
                <span
                  style={{
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  {photo.caption ?? photo.filename}
                </span>
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    void downloadFileFromUrl(photo.url, photo.filename)
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <DownloadSimple size={16} color="var(--color-text)" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
