import React, { useEffect, useState } from 'react'

interface TopicGraphicProps {
  graphicUrl: string | null
  name: string
}

/**
 * Renders a topic's 40×40 graphic. When `graphicUrl` is missing or the image
 * fails to load (e.g. an expired presigned S3 URL), it falls back to a letter
 * avatar showing the topic's first initial — so the raw `alt` text is never
 * surfaced to the user.
 */
export const TopicGraphic = React.memo(function TopicGraphic({
  graphicUrl,
  name,
}: TopicGraphicProps) {
  const [failed, setFailed] = useState(false)

  // Reset the error state when the source changes (e.g. row reused across pages).
  useEffect(() => {
    setFailed(false)
  }, [graphicUrl])

  if (graphicUrl && !failed) {
    return (
      <img
        src={graphicUrl}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-10 w-10 shrink-0 rounded-lg bg-[var(--color-divider)] object-cover"
      />
    )
  }

  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <div
      aria-label={name}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-coral-light)] font-[Poppins] text-sm font-semibold text-[var(--color-coral-dark)]"
    >
      {initial}
    </div>
  )
})
