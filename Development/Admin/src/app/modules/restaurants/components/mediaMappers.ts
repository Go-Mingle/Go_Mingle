import type { RestaurantMediaItem } from '../restaurantApi.types'
import type { MediaFile, MediaPhoto, MediaVideo } from '../restaurantDetail.types'

function extOf(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? (parts.pop() ?? '') : ''
}

export function toMediaFile(item: RestaurantMediaItem, index: number): MediaFile {
  return {
    id: `${item.kind}-${item.sortOrder}-${index}`,
    filename: item.name,
    ext: extOf(item.name),
    fileType: extOf(item.name),
    caption: item.name,
    size: '',
    url: item.url ?? '#',
  }
}

export function toMediaPhoto(item: RestaurantMediaItem, index: number): MediaPhoto {
  return {
    id: `photo-${item.sortOrder}-${index}`,
    filename: item.name,
    url: item.url ?? '#',
    caption: item.name,
  }
}

export function toMediaVideo(item: RestaurantMediaItem, index: number): MediaVideo {
  return {
    id: `video-${item.sortOrder}-${index}`,
    filename: item.name,
    size: '',
    duration: '',
    url: item.url ?? '#',
    caption: item.name,
  }
}
