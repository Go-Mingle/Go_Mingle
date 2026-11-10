import type { MediaSection } from './restaurantDetail.types'
import { MediaPhotosCard } from './components/MediaPhotosCard'
import { MediaVideosCard } from './components/MediaVideosCard'

interface Props {
  media: MediaSection
}

export function RestaurantMediaTab({ media }: Props) {
  const { photos, videos } = media

  return (
    <div style={{ paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <MediaPhotosCard photos={photos} />
      <MediaVideosCard videos={videos} />
    </div>
  )
}
