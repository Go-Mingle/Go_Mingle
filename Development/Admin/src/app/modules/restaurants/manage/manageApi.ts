import { httpClient, restaurantClient } from '../../../../shared/api/httpClient'

/**
 * A super admin working on a restaurant's own screens (GM-342). Everything here
 * goes through the Partner restaurant routes with the act-as header, so the
 * restaurant's own rules apply and each change is logged on its behalf.
 */

export interface ManagedProfile {
  id: string
  name: string | null
  cuisine: string | null
  description: string | null
  location: {
    areaDistrict: string | null
    city: string | null
    fullAddress: string | null
    latitude: number | null
    longitude: number | null
  }
  owner: { name: string | null; email: string | null; phone: string | null }
  restaurant: { phone: string | null; email: string | null; website: string | null }
  rules: { houseRules: string | null; dressCode: string | null; servesAlcohol: boolean | null }
  status: string
  visibleOnApp: boolean
  editable: boolean
}

export interface ProfilePatch {
  name?: string
  cuisine?: string
  description?: string
  location?: Partial<ManagedProfile['location']>
  owner?: Partial<ManagedProfile['owner']>
  restaurant?: Partial<ManagedProfile['restaurant']>
  rules?: Partial<ManagedProfile['rules']>
  visibleOnApp?: boolean
}

export interface ManagedContact {
  id: string
  name: string
  title: string | null
  email: string | null
  phone: string | null
}
export type ContactInput = { name: string; title?: string; email?: string; phone?: string }

export interface ManagedTable {
  tableId: string
  name: string
  isHidden: boolean
}

export interface MenuCourse {
  course: string
  choose: number
  options: string[]
}
export interface ManagedMenuOption {
  comboId: string
  name: string
  pricePkr: number
  isHidden: boolean
  courses: MenuCourse[]
}
export type MenuOptionInput = { name: string; pricePkr: number; courses: MenuCourse[] }

export interface ManagedAmenity {
  amenityId: string
  name: string
  iconUrl?: string
  selected: boolean
}

export interface ManagedPhoto {
  mediaId: string
  url: string
  isCover: boolean
  name?: string
}

export function manageApi(restaurantId: string) {
  const r = restaurantClient(restaurantId)
  return {
    profile: () => r.get<ManagedProfile>(''),
    saveProfile: (patch: ProfilePatch) => r.patch<ManagedProfile>('', patch),

    contacts: () => r.get<{ items: ManagedContact[] }>('/contacts').then((d) => d.items),
    addContact: (c: ContactInput) => r.post<ManagedContact>('/contacts', c),
    updateContact: (id: string, c: Partial<ContactInput>) =>
      r.patch<ManagedContact>(`/contacts/${encodeURIComponent(id)}`, c),
    removeContact: (id: string) => r.delete(`/contacts/${encodeURIComponent(id)}`),

    tables: () =>
      r
        .get<{ items: ManagedTable[] } | ManagedTable[]>('/tables')
        .then((d) => (Array.isArray(d) ? d : d.items)),
    addTable: (name: string) => r.post<ManagedTable>('/tables', { name }),
    renameTable: (id: string, name: string) =>
      r.patch<ManagedTable>(`/tables/${encodeURIComponent(id)}`, { name }),
    setTableHidden: (id: string, hidden: boolean) =>
      r.patch(`/tables/${encodeURIComponent(id)}/visibility`, { hidden }),
    removeTable: (id: string) => r.delete(`/tables/${encodeURIComponent(id)}`),

    menuOptions: () => r.get<{ items: ManagedMenuOption[] }>('/menu-options').then((d) => d.items),
    addMenuOption: (m: MenuOptionInput) => r.post<ManagedMenuOption>('/menu-options', m),
    updateMenuOption: (id: string, m: MenuOptionInput) =>
      r.patch<ManagedMenuOption>(`/menu-options/${encodeURIComponent(id)}`, m),
    setMenuOptionHidden: (id: string, hidden: boolean) =>
      r.patch(`/menu-options/${encodeURIComponent(id)}/visibility`, { hidden }),
    removeMenuOption: (id: string) => r.delete(`/menu-options/${encodeURIComponent(id)}`),

    amenities: () => r.get<{ items: ManagedAmenity[] }>('/amenities').then((d) => d.items),
    setAmenity: (id: string, selected: boolean) =>
      r.put(`/amenities/${encodeURIComponent(id)}`, { selected }),

    photos: () =>
      r.get<{ photos: { items: ManagedPhoto[]; max: number } }>('/media').then((d) => d.photos),
    setCover: (mediaId: string) => r.patch(`/photos/${encodeURIComponent(mediaId)}/cover`),
    removePhoto: (mediaId: string) => r.delete(`/photos/${encodeURIComponent(mediaId)}`),
    /** The restaurant's three-step upload: ask for a target, send the bytes, record it. */
    uploadPhoto: async (file: File) => {
      const target = await r.post<{ uploadUrl: string; uploadRef: string }>('/photos/upload-url', {
        name: file.name,
        contentType: file.type || 'image/jpeg',
        size: file.size,
      })
      const put = await fetch(target.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'image/jpeg' },
        body: file,
      })
      if (!put.ok) throw new Error('upload failed')
      return r.post<ManagedPhoto>('/photos', { uploadRef: target.uploadRef })
    },
  }
}

/** Archive and restore live on the admin restaurant routes. */
export const archiveApi = {
  archive: (id: string, reason: string) =>
    httpClient.post<{ id: string; status: string }>(
      `/api/v1/restaurants/${encodeURIComponent(id)}/archive`,
      { reason },
    ),
  restore: (id: string) =>
    httpClient.post<{ id: string; status: string }>(
      `/api/v1/restaurants/${encodeURIComponent(id)}/restore`,
      {},
    ),
}
