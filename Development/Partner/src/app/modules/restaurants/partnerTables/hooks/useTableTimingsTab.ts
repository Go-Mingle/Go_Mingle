import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { upcomingTablesCount } from '../../../../../shared/utils/apiError'
import type { ProfileFeedback } from '../../partnerProfile/hooks/useProfileFeedback'
import { TABLE_LIMITS, WEEKDAY_KEYS } from '../constants'
import { isTableInUse, isTableMissing, isTableNameDuplicate } from '../errors'
import { availabilityFrom, emptyWeekDraft, weekDraftFrom } from '../format'
import {
  hasErrors,
  mapDuplicateNameError,
  mapServerFieldErrors,
  validateTableDraft,
} from '../validation'
import type { DayErrors, RangeErrors, TableFormErrors } from '../validation'
import type { PartnerTable, TableFormDraft, TimeRange, WeekdayKey } from '../types'
import { useTablesFeedback } from './useTablesFeedback'
import {
  useCreateTableMutation,
  useDeleteTableMutation,
  useSetTableVisibilityMutation,
  useTablesQuery,
  useUpdateTableMutation,
} from './usePartnerTablesQueries'

/** A table blocked from deletion, with the count the dialog names. */
export interface BlockedDelete {
  table: PartnerTable
  upcomingTables: number
}

function emptyDraft(): TableFormDraft {
  return { name: '', days: emptyWeekDraft() }
}

function draftFrom(table: PartnerTable): TableFormDraft {
  return { name: table.name, days: weekDraftFrom(table) }
}

/**
 * The Table Timings tab (US-01 … US-05).
 *
 * Save-on-submit: the modal is a form, not per-field writes. Hide/show and delete
 * each sit behind a confirm dialog, and a refused delete opens a third that offers
 * hiding instead — the escape hatch BR-09 intends.
 */
export function useTableTimingsTab(editable: boolean, feedback: ProfileFeedback) {
  const { t } = useTranslation(['restaurants', 'common'])
  const { showSuccess, showTablesError } = useTablesFeedback(feedback)

  const tablesQuery = useTablesQuery()
  const createTable = useCreateTableMutation()
  const updateTable = useUpdateTableMutation()
  const setVisibility = useSetTableVisibilityMutation()
  const deleteTable = useDeleteTableMutation()

  /**
   * Toasts a failed write, and re-reads the grid when the table turns out to be
   * gone.
   *
   * A 404 here means the **view is stale**, not that the partner did anything
   * wrong: another tab deleted the table, or an admin did. The mutations only
   * invalidate on success, so without this the card the partner just acted on
   * would sit there until something else happened to refresh it. Same shape as
   * J6A's `reportStaleOrFail`.
   */
  const refetchTables = tablesQuery.refetch
  const reportFailure = useCallback(
    (cause: unknown) => {
      showTablesError(cause)
      if (isTableMissing(cause)) void refetchTables()
    },
    [showTablesError, refetchTables],
  )

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PartnerTable | null>(null)
  const [draft, setDraft] = useState<TableFormDraft>(emptyDraft)
  const [errors, setErrors] = useState<TableFormErrors>({})

  const [visibilityTarget, setVisibilityTarget] = useState<PartnerTable | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PartnerTable | null>(null)
  const [blocked, setBlocked] = useState<BlockedDelete | null>(null)

  // ── The add/edit modal ───────────────────────────────────────
  const openAdd = useCallback(() => {
    setEditing(null)
    setDraft(emptyDraft())
    setErrors({})
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((table: PartnerTable) => {
    setEditing(table)
    setDraft(draftFrom(table))
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

  /** Patches one weekday, leaving the other six alone. */
  const patchDay = useCallback(
    (
      day: WeekdayKey,
      next: (ranges: TimeRange[], open: boolean) => { open: boolean; ranges: TimeRange[] },
    ) => {
      setDraft((prev) => {
        const current = prev.days[day]
        return { ...prev, days: { ...prev.days, [day]: next(current.ranges, current.open) } }
      })
    },
    [],
  )

  /**
   * Opens or closes a weekday.
   *
   * Opening a day with no rows seeds one empty range, so the partner has somewhere
   * to type rather than having to find "+ Add time range" first. Closing keeps the
   * rows — `availabilityFrom` drops them on submit — so toggling back does not
   * lose what was already entered.
   */
  const toggleDay = useCallback(
    (day: WeekdayKey, open: boolean) => {
      patchDay(day, (ranges) => ({
        open,
        ranges: open && ranges.length === 0 ? [{ start: '', end: '' }] : ranges,
      }))
    },
    [patchDay],
  )

  const setRange = useCallback(
    (day: WeekdayKey, index: number, patch: Partial<TimeRange>) => {
      patchDay(day, (ranges, open) => ({
        open,
        ranges: ranges.map((range, i) => (i === index ? { ...range, ...patch } : range)),
      }))
    },
    [patchDay],
  )

  /** A no-op at the cap; the modal hides the affordance there too (BR-05). */
  const addRange = useCallback(
    (day: WeekdayKey) => {
      patchDay(day, (ranges, open) => ({
        open,
        ranges:
          ranges.length >= TABLE_LIMITS.rangesPerDayMax
            ? ranges
            : [...ranges, { start: '', end: '' }],
      }))
    },
    [patchDay],
  )

  const removeRange = useCallback(
    (day: WeekdayKey, index: number) => {
      patchDay(day, (ranges, open) => ({ open, ranges: ranges.filter((_, i) => i !== index) }))
    },
    [patchDay],
  )

  /**
   * Applies one day's hours to the whole week.
   *
   * Ranges are cloned per day rather than shared: the draft is edited in place by
   * index, so a shared array would make editing Monday silently rewrite Tuesday.
   *
   * Errors are keyed by day and index, and every day's rows have just been
   * replaced, so any existing ones now point at rows that no longer exist —
   * clearing them is more honest than re-anchoring them.
   */
  const copyDayToAll = useCallback(
    (day: WeekdayKey) => {
      setDraft((prev) => {
        const source = prev.days[day]
        const days = { ...prev.days }
        for (const key of WEEKDAY_KEYS) {
          days[key] = { open: source.open, ranges: source.ranges.map((range) => ({ ...range })) }
        }
        return { ...prev, days }
      })
      setErrors({})
      // Nothing visibly moves on the day that was copied *from*, so the toast is
      // what tells the partner the other six changed.
      showSuccess(t('restaurants:partnerTables.copiedToAll'))
    },
    [showSuccess, t],
  )

  /**
   * Validates client-side first, so the documented rules never cost a round trip.
   *
   * A 422 that still comes back is client/server drift, and its `details.fields`
   * is mapped onto the same inline errors rather than only raising a toast. A 409
   * duplicate name is put on the name field for the same reason — the backend
   * sends `details.field: "name"` precisely so it can be.
   */
  const submit = useCallback(() => {
    const trimmed: TableFormDraft = { name: draft.name.trim(), days: draft.days }

    const found = validateTableDraft(trimmed, t)
    if (hasErrors(found)) {
      setErrors(found)
      return
    }
    setErrors({})

    // Always the complete seven-day set: PATCH replaces the week, so an omitted
    // day would be read as "the partner closed it" (BR-07).
    const payload = { name: trimmed.name, availability: availabilityFrom(trimmed.days) }

    const onError = (cause: unknown) => {
      setErrors(
        isTableNameDuplicate(cause)
          ? mapDuplicateNameError(cause, t('restaurants:partnerTables.errors.nameDuplicate'))
          : mapServerFieldErrors(cause),
      )
      reportFailure(cause)
    }
    const onSuccess = (message: string) => () => {
      showSuccess(message)
      setFormOpen(false)
    }

    if (editing) {
      updateTable.mutate(
        { tableId: editing.tableId, draft: payload },
        { onSuccess: onSuccess(t('restaurants:partnerTables.tableUpdated')), onError },
      )
      return
    }
    createTable.mutate(payload, {
      onSuccess: onSuccess(t('restaurants:partnerTables.tableAdded')),
      onError,
    })
  }, [draft, editing, createTable, updateTable, showSuccess, reportFailure, t])

  // ── Hide / show (US-04) ──────────────────────────────────────
  const confirmVisibility = useCallback(() => {
    if (!visibilityTarget) return
    const hidden = !visibilityTarget.isHidden

    setVisibility.mutate(
      { tableId: visibilityTarget.tableId, hidden },
      {
        onSuccess: () => {
          showSuccess(
            t(
              hidden
                ? 'restaurants:partnerTables.tableHidden'
                : 'restaurants:partnerTables.tableShown',
            ),
          )
          setVisibilityTarget(null)
        },
        onError: (cause) => {
          reportFailure(cause)
          setVisibilityTarget(null)
        },
      },
    )
  }, [visibilityTarget, setVisibility, showSuccess, reportFailure, t])

  // ── Delete, and the in-use guard (US-05) ─────────────────────
  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return
    const target = deleteTarget

    deleteTable.mutate(target.tableId, {
      onSuccess: () => {
        showSuccess(t('restaurants:partnerTables.tableDeleted'))
        setDeleteTarget(null)
      },
      onError: (cause) => {
        setDeleteTarget(null)
        // Not a failure so much as an instruction: the table is assigned to an
        // upcoming interest table, and hiding is the intended alternative — so it
        // gets a dialog with a real button, not a toast.
        if (isTableInUse(cause)) {
          setBlocked({ table: target, upcomingTables: upcomingTablesCount(cause) })
          return
        }
        reportFailure(cause)
      },
    })
  }, [deleteTarget, deleteTable, showSuccess, reportFailure, t])

  /**
   * The blocked dialog's primary action. Hides straight away rather than opening
   * the ordinary hide confirm — the dialog has already explained what hiding
   * does, so a second confirmation would only be friction.
   */
  const hideFromBlocked = useCallback(() => {
    if (!blocked) return

    setVisibility.mutate(
      { tableId: blocked.table.tableId, hidden: true },
      {
        onSuccess: () => {
          showSuccess(t('restaurants:partnerTables.tableHidden'))
          setBlocked(null)
        },
        onError: (cause) => {
          reportFailure(cause)
          setBlocked(null)
        },
      },
    )
  }, [blocked, setVisibility, showSuccess, reportFailure, t])

  return {
    /** Hidden tables included — the card badges them (AC-01.2). */
    tables: tablesQuery.data?.items ?? [],
    isPending: tablesQuery.isPending,
    isError: tablesQuery.isError,
    error: tablesQuery.error,
    isFetching: tablesQuery.isFetching,

    editable,

    formOpen,
    editing,
    draft,
    errors,
    openAdd,
    openEdit,
    closeForm,
    setName,
    toggleDay,
    setRange,
    addRange,
    removeRange,
    copyDayToAll,
    submit,
    saving: createTable.isPending || updateTable.isPending,

    visibilityTarget,
    requestVisibility: setVisibilityTarget,
    cancelVisibility: () => setVisibilityTarget(null),
    confirmVisibility,
    togglingVisibility: setVisibility.isPending,

    deleteTarget,
    requestDelete: setDeleteTarget,
    cancelDelete: () => setDeleteTarget(null),
    confirmDelete,
    deleting: deleteTable.isPending,

    blocked,
    dismissBlocked: () => setBlocked(null),
    hideFromBlocked,
  }
}

export type TableTimingsTabController = ReturnType<typeof useTableTimingsTab>

/** Convenience for the modal: the errors for one weekday, or an empty object. */
export function dayErrorsAt(errors: TableFormErrors, day: WeekdayKey): DayErrors {
  return errors.days?.[day] ?? {}
}

/** Convenience for the modal: the errors for one range, or an empty object. */
export function rangeErrorsAt(day: DayErrors, index: number): RangeErrors {
  return day.ranges?.[index] ?? {}
}
