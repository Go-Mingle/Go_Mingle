import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { saveFileDownload } from '../../../../../shared/utils/fileDownload'
import type { ProfileFeedback } from '../../partnerProfile/hooks/useProfileFeedback'
import { MENU_PDF_CONTENT_TYPE } from '../constants'
import { isMenuPdfMissing } from '../errors'
import { useMenuFeedback } from './useMenuFeedback'
import { useMenuPdfUpload } from './useMenuPdfUpload'
import {
  useCommitMenuPdfMutation,
  useDeleteMenuPdfMutation,
  useMenuPdfQuery,
} from './usePartnerMenuQueries'

/**
 * The Restaurant Menu PDF half of the tab (US-01).
 *
 * One optional public file. Uploading replaces whatever is there — there is no
 * separate replace call (BR-02) — and deleting clears the reference while the
 * stored object is retained (BR-04).
 */
export function useMenuPdfSection(editable: boolean, feedback: ProfileFeedback) {
  const { t } = useTranslation(['restaurants', 'common'])
  const { showSuccess, showErrorText, showMenuError, menuErrorText } = useMenuFeedback(feedback)

  const pdfQuery = useMenuPdfQuery()
  const commitPdf = useCommitMenuPdfMutation()
  const deletePdf = useDeleteMenuPdfMutation()

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const upload = useMenuPdfUpload(commitPdf.mutateAsync)

  /**
   * Reports a refused upload in two places (MET-1258).
   *
   * The toast alone was not an explanation. An over-limit PDF is a state a
   * partner reaches by picking an ordinary design-heavy menu, and the refusal is
   * raised client-side — so by the time they look back at the section the toast
   * has faded and the only thing on screen is an Upload button that appeared to
   * do nothing. The section now says why, and keeps saying it until the next
   * attempt or until it is dismissed.
   */
  const reportUploadFailure = useCallback(
    (text: string) => {
      showErrorText(text)
      setUploadError(text)
    },
    [showErrorText],
  )

  const dismissUploadError = useCallback(() => {
    setUploadError(null)
  }, [])

  /**
   * Picked and uploaded in one step — no preview modal (AC-01.2).
   *
   * Always returns false: AntD's Upload would otherwise start its own request,
   * and the real upload is the presigned PUT this triggers.
   */
  const pickFile = useCallback(
    (file: File): boolean => {
      // A fresh attempt clears the last one's reason, so what is on screen always
      // belongs to the file the partner just picked.
      setUploadError(null)

      if (file.type !== MENU_PDF_CONTENT_TYPE) {
        reportUploadFailure(t('restaurants:partnerMenu.errors.badType'))
        return false
      }

      void (async () => {
        try {
          await upload.run(file)
          showSuccess(t('restaurants:partnerMenu.pdfUploaded'))
        } catch (cause) {
          reportUploadFailure(menuErrorText(cause))
        } finally {
          upload.reset()
        }
      })()

      return false
    },
    [upload, showSuccess, reportUploadFailure, menuErrorText, t],
  )

  const confirmDelete = useCallback(() => {
    deletePdf.mutate(undefined, {
      onSuccess: () => {
        showSuccess(t('restaurants:partnerMenu.pdfRemoved'))
        setConfirmingDelete(false)
      },
      onError: (cause) => {
        setConfirmingDelete(false)
        // A 404 means there was nothing to remove — the row on screen is stale
        // (a double-click, or another tab got there first). The mutation's
        // invalidate does not run on failure, so the truth is re-read here.
        if (isMenuPdfMissing(cause)) {
          showErrorText(t('restaurants:partnerMenu.errors.pdfMissing'))
          void pdfQuery.refetch()
          return
        }
        showMenuError(cause)
      },
    })
  }, [deletePdf, showSuccess, showErrorText, showMenuError, t, pdfQuery])

  const pdf = pdfQuery.data

  /**
   * Saves the PDF and opens it in a new tab.
   *
   * An `<a download>` cannot do this: `menuUrl` is a public CloudFront URL, and
   * the `download` attribute is silently ignored cross-origin — the browser
   * treated it as plain navigation and rendered the PDF over the app. Fetching
   * the bytes first gives a same-origin `blob:` URL, which honours `download`.
   *
   * If CloudFront answers without permissive CORS headers the fetch throws, and
   * the new tab is the honest fallback: the partner still gets the file, just via
   * the viewer. A guaranteed save would need the object served with
   * `Content-Disposition: attachment`.
   */
  const menuUrl = pdf?.menuUrl ?? null
  const pdfName = pdf?.name ?? null

  const downloadPdf = useCallback(async () => {
    if (!menuUrl) return
    const url = menuUrl

    window.open(url, '_blank', 'noopener')

    try {
      const response = await fetch(url)
      if (!response.ok) return
      saveFileDownload({ blob: await response.blob(), filename: pdfName ?? 'menu.pdf' })
    } catch {
      // Already open in the new tab; nothing further to tell the partner.
    }
  }, [menuUrl, pdfName])

  return {
    menuUrl: pdf?.menuUrl ?? null,
    /** The server's derived name — slugified, and the single source of truth. */
    name: pdf?.name ?? null,

    isPending: pdfQuery.isPending,
    isError: pdfQuery.isError,
    error: pdfQuery.error,

    editable,
    downloadPdf,
    pickFile,
    uploading: upload.uploading,
    progress: upload.progress,
    /** Why the last attempt was refused, held until the next one (MET-1258). */
    uploadError,
    dismissUploadError,

    confirmingDelete,
    requestDelete: () => setConfirmingDelete(true),
    cancelDelete: () => setConfirmingDelete(false),
    confirmDelete,
    deleting: deletePdf.isPending,
  }
}
