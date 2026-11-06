interface ReviewPhotoStripProps {
  photos: string[]
  size?: number
  maxVisible?: number
}

export function ReviewPhotoStrip({ photos, size = 40, maxVisible = 3 }: ReviewPhotoStripProps) {
  if (!photos || photos.length === 0) return null
  const visible = photos.slice(0, maxVisible)
  const overflow = photos.length - visible.length

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {visible.map((url, i) => {
        const isLast = i === visible.length - 1
        return (
          <div
            key={`${url}-${i}`}
            style={{
              width: size,
              height: size,
              borderRadius: 6,
              overflow: 'hidden',
              background: 'var(--color-page)',
              border: '1px solid var(--color-border)',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <img
              src={url}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {isLast && overflow > 0 && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.55)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                +{overflow}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
