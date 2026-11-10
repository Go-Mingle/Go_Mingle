export interface Review {
  id: string
  date: string
  mingler: string
  minglerId?: string
  minglerInitials: string
  minglerColor: string
  rating: number
  text: string
  visible: boolean
  bookingId?: string
  photos?: string[]
}

export interface MediaPhoto {
  id: string
  filename: string
  url: string
  caption?: string
  isCover?: boolean
}

export interface MediaVideo {
  id: string
  filename: string
  size: string
  duration: string
  url: string
  caption?: string
}

export interface MediaFile {
  id: string
  filename: string
  ext: string
  fileType?: string
  caption?: string
  size: string
  url: string
}

export interface MediaSection {
  photos: MediaPhoto[]
  videos: MediaVideo[]
  files: MediaFile[]
}
