import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { amenitiesService } from '../services'
import type { ListAmenitiesParams } from '../types'

export function useAmenitiesQuery(params?: ListAmenitiesParams) {
  return useQuery({
    queryKey: ['amenities', params],
    queryFn: () => amenitiesService.getAll(params),
  })
}

export function useAmenityQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['amenity', id],
    queryFn: () => amenitiesService.getById(id!),
    enabled: !!id,
  })
}

export function useActiveAmenitiesQuery() {
  return useQuery({
    queryKey: ['amenities', 'active'],
    queryFn: () => amenitiesService.getActive(),
  })
}

export function useCreateAmenityMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formData: FormData) => amenitiesService.create(formData),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['amenities'] })
    },
  })
}

export function useUpdateAmenityMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      amenitiesService.update(id, formData),
    onSuccess: (data, variables) => {
      void qc.invalidateQueries({ queryKey: ['amenities'] })
      // Seed the detail cache from the PATCH response so reopening the edit
      // modal shows the server's authoritative icon/name straight away instead
      // of racing a refetch, then invalidate so it is re-confirmed on remount.
      if (data) qc.setQueryData(['amenity', variables.id], data)
      void qc.invalidateQueries({ queryKey: ['amenity', variables.id] })
    },
  })
}

export function useDeleteAmenityMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => amenitiesService.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['amenities'] })
    },
  })
}
