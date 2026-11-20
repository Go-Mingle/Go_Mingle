import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { archiveApi, manageApi } from './manageApi'

const key = (id: string, part: string) => ['restaurant', id, 'manage', part] as const

/** Reads one part of the restaurant's own data, only while its drawer is open. */
export function useManaged<T>(
  id: string,
  part: string,
  read: (api: ReturnType<typeof manageApi>) => Promise<T>,
  enabled: boolean,
) {
  return useQuery({ queryKey: key(id, part), queryFn: () => read(manageApi(id)), enabled })
}

/**
 * A change on the restaurant's behalf. Afterwards every view of the restaurant
 * reloads (detail, its tabs, the directory), since one edit can show in several.
 */
export function useManageMutation<V, R = unknown>(
  id: string,
  run: (api: ReturnType<typeof manageApi>, vars: V) => Promise<R>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: V) => run(manageApi(id), vars),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['restaurant', id] })
      void qc.invalidateQueries({ queryKey: ['restaurants'] })
    },
  })
}

export function useArchiveMutations(id: string) {
  const qc = useQueryClient()
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['restaurant', id] })
    void qc.invalidateQueries({ queryKey: ['restaurants'] })
  }
  return {
    archive: useMutation({
      mutationFn: (reason: string) => archiveApi.archive(id, reason),
      onSuccess: done,
    }),
    restore: useMutation({ mutationFn: () => archiveApi.restore(id), onSuccess: done }),
  }
}
