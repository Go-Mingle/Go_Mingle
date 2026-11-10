import { useState, type CSSProperties, type ReactNode } from 'react'

interface ImageWithFallbackProps {
  src?: string | null
  alt: string
  style?: CSSProperties
  className?: string
  /** Rendered when there is no src, or when the image fails to load. */
  fallback: ReactNode
}

/**
 * An <img> that swaps to `fallback` (e.g. an initials avatar) when the URL is
 * missing or the image fails to load, instead of showing a broken-image icon
 * with its alt text spilling out.
 */
export function ImageWithFallback({
  src,
  alt,
  style,
  className,
  fallback,
}: ImageWithFallbackProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  if (!src || failedSrc === src) return <>{fallback}</>
  return (
    <img
      src={src}
      alt={alt}
      style={style}
      className={className}
      onError={() => setFailedSrc(src)}
    />
  )
}
