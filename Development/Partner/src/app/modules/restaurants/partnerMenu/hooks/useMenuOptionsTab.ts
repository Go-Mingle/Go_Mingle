import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProfileFeedback } from '../../partnerProfile/hooks/useProfileFeedback'
import { isMenuOptionInUse, upcomingTablesCount } from '../errors'
import { hasErrors, mapServerFieldErrors, validateCombo } from '../validation'
import type { ComboFormErrors, SectionErrors } from '../validation'
import type { ComboCourse, ComboDraft, MenuOption } from '../types'
import { useMenuFeedback } from './useMenuFeedback'
import {
  useCreateMenuOptionMutation,
  useDeleteMenuOptionMutation,
  useMenuOptionsQuery,
  useSetMenuOptionVisibilityMutation,
  useUpdateMenuOptionMutation,
} from './usePartnerMenuQueries'

/** A combo blocked from deletion, with the count the dialog names. */
export interface BlockedDelete {
  option: MenuOption
  upcomingTables: number
}

function emptySection(): ComboCourse {
  return { course: '', choose: 1, options: [] }
}

/**
 * A new combo starts with **one** empty section, not the prototype's three
 * pre-named ones: every section now requires at least one item, so three empties
 * would open the modal already carrying three errors.
 */
function emptyDraft(): ComboDraft {
  return { name: '', pricePkr: 0, courses: [emptySection()] }
}

/** Deep-copied, so editing the modal never mutates the cached list. */
function draftFrom(option: MenuOption): ComboDraft {
  return {
    name: option.name,
    pricePkr: option.pricePkr,
    courses: option.courses.map((course) => ({ ...course, options: [...course.options] })),
  }
}

/**
 * The Menu Options half of the tab (US-02 … US-05).
 *
 * Save-on-submit: the modal is a form, not per-field writes (BR-07). Hide/show
 * and delete each sit behind a confirm dialog, and a refused delete opens a
 * third that offers hiding instead — the escape hatch BR-09 intends.
 */
export function useMenuOptionsTab(editable: boolean, feedback: ProfileFeedback) {
  const { t } = useTranslation(['restaurants', 'common'])
  const { showSuccess, showMenuError } = useMenuFeedback(feedback)

  const optionsQuery = useMenuOptionsQuery()
  const createOption = useCreateMenuOptionMutation()
  const updateOption = useUpdateMenuOptionMutation()
  const setVisibility = useSetMenuOptionVisibilityMutation()
  const deleteOption = useDeleteMenuOptionMutation()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MenuOption | null>(null)
  const [draft, setDraft] = useState<ComboDraft>(emptyDraft)
  const [errors, setErrors] = useState<ComboFormErrors>({})

  const [visibilityTarget, setVisibilityTarget] = useState<MenuOption | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MenuOption | null>(null)
  const [blocked, setBlocked] = useState<BlockedDelete | null>(null)

  // ── The add/edit modal ───────────────────────────────────────
  const openAdd = useCallback(() => {
    setEditing(null)
    setDraft(emptyDraft())
    setErrors({})
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((option: MenuOption) => {
    setEditing(option)
    setDraft(draftFrom(option))
    setErrors({})
    setFormOpen(true)
  }, [])

  const closeForm = useCallback(() => {
    setFormOpen(false)
    setErrors({})
  }, [])

  const setName = useCallback((name: string) => {
    setDraft((prev) => ({ ...prev, name }))
  }, [])

  const setPrice = useCallback((pricePkr: number) => {
    setDraft((prev) => ({ ...prev, pricePkr }))
  }, [])

  const addSection = useCallback(() => {
    setDraft((prev) => ({ ...prev, courses: [...prev.courses, emptySection()] }))
  }, [])

  const removeSection = useCallback((index: number) => {
    setDraft((prev) => ({ ...prev, courses: prev.courses.filter((_, i) => i !== index) }))
  }, [])

  const patchSection = useCallback((index: number, patch: Partial<ComboCourse>) => {
    setDraft((prev) => ({
      ...prev,
      courses: prev.courses.map((course, i) => (i === index ? { ...course, ...patch } : course)),
    }))
  }, [])

  /**
   * Validates client-side first, so the seven documented rules never cost a
   * round trip. A 422 that still comes back is client/server drift, and its
   * `details.fields` is mapped onto the same inline errors rather than only
   * raising a toast.
   */
  const submit = useCallback(() => {
    const trimmed: ComboDraft = {
      name: draft.name.trim(),
      pricePkr: draft.pricePkr,
      courses: draft.courses.map((course) => ({
        course: course.course.trim(),
        choose: course.choose,
        options: course.options.map((item) => item.trim()).filter(Boolean),
      })),
    }

    const found = validateCombo(trimmed, t)
    if (hasErrors(found)) {
      setErrors(found)
      return
    }
    setErrors({})

    const onError = (cause: unknown) => {
      setErrors(mapServerFieldErrors(cause))
      showMenuError(cause)
    }
    const onSuccess = (message: string) => () => {
      showSuccess(message)
      setFormOpen(false)
    }

    if (editing) {
      updateOption.mutate(
        { comboId: editing.comboId, draft: trimmed },
        { onSuccess: onSuccess(t('restaurants:partnerMenu.optionUpdated')), onError },
      )
      return
    }
    createOption.mutate(trimmed, {
      onSuccess: onSuccess(t('restaurants:partnerMenu.optionAdded')),
      onError,
    })
  }, [draft, editing, createOption, updateOption, showSuccess, showMenuError, t])

  // ── Hide / show (US-04) ──────────────────────────────────────
  const confirmVisibility = useCallback(() => {
    if (!visibilityTarget) return
    const hidden = !visibilityTarget.isHidden

    setVisibility.mutate(
      { comboId: visibilityTarget.comboId, hidden },
      {
        onSuccess: () => {
          showSuccess(
            t(
              hidden
                ? 'restaurants:partnerMenu.optionHidden'
                : 'restaurants:partnerMenu.optionShown',
            ),
          )
          setVisibilityTarget(null)
        },
        onError: (cause) => {
          showMenuError(cause)
          setVisibilityTarget(null)
        },
      },
    )
  }, [visibilityTarget, setVisibility, showSuccess, showMenuError, t])

  // ── Delete, and the in-use guard (US-05) ─────────────────────
  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return
    const target = deleteTarget

    deleteOption.mutate(target.comboId, {
      onSuccess: () => {
        showSuccess(t('restaurants:partnerMenu.optionDeleted'))
        setDeleteTarget(null)
      },
      onError: (cause) => {
        setDeleteTarget(null)
        // Not a failure so much as an instruction: the combo is committed to an
        // upcoming interest table, and hiding is the intended alternative.
        if (isMenuOptionInUse(cause)) {
          setBlocked({ option: target, upcomingTables: upcomingTablesCount(cause) })
          return
        }
        showMenuError(cause)
      },
    })
  }, [deleteTarget, deleteOption, showSuccess, showMenuError, t])

  /**
   * The blocked dialog's primary action. Hides straight away rather than opening
   * the ordinary hide confirm — the dialog has already explained what hiding
   * does, so a second confirmation would only be friction.
   */
  const hideFromBlocked = useCallback(() => {
    if (!blocked) return

    setVisibility.mutate(
      { comboId: blocked.option.comboId, hidden: true },
      {
        onSuccess: () => {
          showSuccess(t('restaurants:partnerMenu.optionHidden'))
          setBlocked(null)
        },
        onError: (cause) => {
          showMenuError(cause)
          setBlocked(null)
        },
      },
    )
  }, [blocked, setVisibility, showSuccess, showMenuError, t])

  return {
    /** Hidden combos included — the card badges them (AC-02.2). */
    options: optionsQuery.data?.items ?? [],
    isPending: optionsQuery.isPending,
    isError: optionsQuery.isError,
    error: optionsQuery.error,
    isFetching: optionsQuery.isFetching,

    editable,

    formOpen,
    editing,
    draft,
    errors,
    openAdd,
    openEdit,
    closeForm,
    setName,
    setPrice,
    addSection,
    removeSection,
    patchSection,
    submit,
    saving: createOption.isPending || updateOption.isPending,

    visibilityTarget,
    requestVisibility: setVisibilityTarget,
    cancelVisibility: () => setVisibilityTarget(null),
    confirmVisibility,
    togglingVisibility: setVisibility.isPending,

    deleteTarget,
    requestDelete: setDeleteTarget,
    cancelDelete: () => setDeleteTarget(null),
    confirmDelete,
    deleting: deleteOption.isPending,

    blocked,
    dismissBlocked: () => setBlocked(null),
    hideFromBlocked,
  }
}

/** Convenience for the modal: the errors for one section, or an empty object. */
export function sectionErrorsAt(errors: ComboFormErrors, index: number): SectionErrors {
  return errors.sections?.[index] ?? {}
}
