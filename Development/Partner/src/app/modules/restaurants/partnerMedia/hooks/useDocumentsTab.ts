import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProfileFeedback } from '../../partnerProfile/hooks/useProfileFeedback'
import { ACCEPTED_TYPES } from '../constants'
import { sanitiseDocumentParams } from '../services'
import type { DocumentItem, DocumentSortBy, SortOrder } from '../types'
import { useMediaFeedback } from './useMediaFeedback'
import { useMediaUpload } from './useMediaUpload'
import {
  useCommitDocumentMutation,
  useDeleteDocumentMutation,
  useDocumentDownloadMutation,
  usePartnerDocumentsQuery,
} from './usePartnerMediaQueries'

/**
 * The Documents tab (US-01).
 *
 * Sorting and searching are server-resolved, and a bad value on those params is
 * a **422** rather than a silent default — so everything goes through
 * `sanitiseDocumentParams` before it reaches the query. Search is name-only.
 */
export function useDocumentsTab(editable: boolean, feedback: ProfileFeedback) {
  const { t } = useTranslation(['restaurants', 'common'])
  const { showSuccess, showErrorText, showMediaError, resolveMediaError } =
    useMediaFeedback(feedback)

  const [sortBy, setSortBy] = useState<DocumentSortBy>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [search, setSearch] = useState('')

  const params = useMemo(
    () => sanitiseDocumentParams({ sortBy, sortOrder, search }),
    [sortBy, sortOrder, search],
  )

  const documentsQuery = usePartnerDocumentsQuery(params)
  const commitDocument = useCommitDocumentMutation()
  const deleteDocument = useDeleteDocumentMutation()
  const downloadDocument = useDocumentDownloadMutation()

  /**
   * One file at a time. BR-07 describes a single pick → preview → submit, and
   * there is no bulk endpoint, so the picker stays single-select.
   */
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  /**
   * Why the last submit failed, shown inside the modal.
   *
   * Kept alongside the toast rather than instead of it: since MET-1148 the
   * commit verifies the uploaded bytes, so a rejection lands *after* the
   * progress bar has run to 100% and vanished, and a modal that simply sits
   * there looks like it worked.
   */
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null)

  const upload = useMediaUpload('document', commitDocument.mutateAsync)

  /**
   * Staged rather than uploaded on pick: BR-07 requires a preview → submit step,
   * so nothing leaves the browser until the partner confirms.
   */
  const stageFile = useCallback(
    (file: File): boolean => {
      if (!ACCEPTED_TYPES.document.includes(file.type as never)) {
        showErrorText(t('restaurants:partnerMedia.errors.badType.document'))
        return false
      }
      setPendingFile(file)
      setUploadError(null)
      // Always false: AntD Upload would otherwise start its own request, and the
      // real upload is the presigned PUT the preview modal triggers.
      return false
    },
    [showErrorText, t],
  )

  const cancelUpload = useCallback(() => {
    setPendingFile(null)
    setUploadError(null)
    upload.reset()
  }, [upload])

  const submitUpload = useCallback(async () => {
    if (!pendingFile) return
    // Cleared up front so a second attempt never shows the previous reason
    // beside a running progress bar.
    setUploadError(null)
    try {
      await upload.run(pendingFile)
      showSuccess(t('restaurants:partnerMedia.documentAdded'))
      setPendingFile(null)
    } catch (cause) {
      // The modal stays open so the partner can retry without re-picking — and
      // that retry is a full restart from step 1, which is the only valid
      // recovery once the server has consumed the uploadRef (MET-1148).
      const reason = resolveMediaError(cause, 'document')
      setUploadError(reason)
      showErrorText(reason)
    }
  }, [pendingFile, upload, showSuccess, t, resolveMediaError, showErrorText])

  /**
   * Two hops: mint a presigned URL, then hand it to the browser.
   *
   * Requested per click rather than cached — the URL expires in about five
   * minutes, and a stale one fails looking like a permissions problem.
   */
  const download = useCallback(
    (document: DocumentItem) => {
      downloadDocument.mutate(document.mediaId, {
        onSuccess: ({ downloadUrl }) => {
          window.location.assign(downloadUrl)
        },
        onError: (cause) => {
          showMediaError(cause, 'document')
        },
      })
    },
    [downloadDocument, showMediaError],
  )

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return
    deleteDocument.mutate(deleteTarget.mediaId, {
      onSuccess: () => {
        showSuccess(t('restaurants:partnerMedia.documentDeleted'))
        setDeleteTarget(null)
      },
      onError: (cause) => {
        showMediaError(cause, 'document')
        setDeleteTarget(null)
      },
    })
  }, [deleteTarget, deleteDocument, showSuccess, t, showMediaError])

  const applySort = useCallback(
    (field: DocumentSortBy) => {
      if (field === sortBy) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        return
      }
      setSortBy(field)
      setSortOrder('asc')
    },
    [sortBy, sortOrder],
  )

  return {
    documents: documentsQuery.data?.items ?? [],
    isPending: documentsQuery.isPending,
    isError: documentsQuery.isError,
    error: documentsQuery.error,
    isFetching: documentsQuery.isFetching,

    sortBy,
    sortOrder,
    applySort,
    search,
    applySearch: setSearch,

    editable,
    pendingFile,
    stageFile,
    cancelUpload,
    submitUpload,
    uploading: upload.uploading,
    progress: upload.progress,
    uploadError,

    download,
    downloading: downloadDocument.isPending,

    deleteTarget,
    requestDelete: setDeleteTarget,
    cancelDelete: () => setDeleteTarget(null),
    confirmDelete,
    deleting: deleteDocument.isPending,
  }
}
