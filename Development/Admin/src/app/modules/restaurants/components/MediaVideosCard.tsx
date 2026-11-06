import { DownloadSimple, VideoCamera, Play } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { MediaVideo } from '../restaurantDetail.types'
import { downloadFileFromUrl } from '../../../../shared/utils/downloadFile'

interface MediaVideosCardProps {
  videos: MediaVideo[]
}

export function MediaVideosCard({ videos }: MediaVideosCardProps) {
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
          {t('media.videos')}
        </h3>
      </div>

      {videos.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '32px 0',
            gap: 8,
          }}
        >
          <VideoCamera size={32} color="var(--color-text-subtle)" />
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {t('media.noVideos')}
          </span>
        </div>
      ) : (
        <div
          className="videos-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 10,
          }}
        >
          {videos.map((video: MediaVideo) => (
            <div
              key={video.id}
              className="media-cell"
              style={{
                position: 'relative',
                aspectRatio: '3 / 2',
                borderRadius: 8,
                overflow: 'hidden',
                background: '#0D2233',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <video
                src={video.url}
                preload="metadata"
                muted
                playsInline
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <Play size={16} weight="fill" color="white" />
              </div>
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
                  {video.caption ?? video.filename}
                </span>
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    void downloadFileFromUrl(video.url, video.filename)
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
