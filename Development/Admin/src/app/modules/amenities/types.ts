export interface Amenity {
  id: string
  name: string
  /** CDN URL to the uploaded SVG; null means render built-in default shield */
  iconUrl: string | null
  restaurantsCount: number
  sampleRestaurants?: { id: string; name: string }[] | null
  createdAt: string
  updatedAt?: string
}

export interface PaginationMeta {
  page: number
  pageSize: number
  totalRecords: number
  totalPages: number
}

export interface ActiveAmenity {
  id: string
  name: string
  iconUrl: string | null
}

export interface AmenitiesListResponse {
  items: Amenity[]
  pagination: PaginationMeta
}

export interface ListAmenitiesParams {
  page?: number
  pageSize?: number
  sortBy?: 'name' | 'count'
  sortOrder?: 'asc' | 'desc'
  q?: string
}

export interface CreateAmenityDto {
  name: string
}

export interface UpdateAmenityDto {
  name?: string
  resetIcon?: boolean
}
