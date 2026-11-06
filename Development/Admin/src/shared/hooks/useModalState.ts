import { useState } from 'react'

interface ModalState<T> {
  open: boolean
  editTarget: T | null
  deleteTarget: T | null
  openCreate: () => void
  openEdit: (item: T) => void
  closeModal: () => void
  setDeleteTarget: (item: T | null) => void
}

export function useModalState<T>(): ModalState<T> {
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<T | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null)

  return {
    open,
    editTarget,
    deleteTarget,
    openCreate: () => setOpen(true),
    openEdit: (item: T) => {
      setEditTarget(item)
      setOpen(true)
    },
    closeModal: () => {
      setOpen(false)
      setEditTarget(null)
    },
    setDeleteTarget,
  }
}
