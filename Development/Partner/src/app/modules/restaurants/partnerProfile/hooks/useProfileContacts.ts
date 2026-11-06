import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { omitEmpty, toE164 } from '../format'
import { sanitiseContactsParams } from '../services'
import { hasCardErrors, mapProfileFieldErrors, validateContact } from '../validation'
import type { CardErrors } from '../validation'
import type { ContactInput, ContactSortBy, PartnerContact } from '../types'
import {
  useCreateContactMutation,
  useDeleteContactMutation,
  usePartnerContactsQuery,
  useUpdateContactMutation,
} from './usePartnerProfileQueries'
import type { ProfileFeedback } from './useProfileFeedback'

export interface ContactForm {
  name: string
  title: string
  email: string
  phone: string
}

const EMPTY_FORM: ContactForm = { name: '', title: '', email: '', phone: '' }

/**
 * The Contacts tab (US-05).
 *
 * Sorting and searching are server-resolved, and a bad value on those params is a
 * **422** rather than a silent default — so everything goes through
 * `sanitiseContactsParams` before it reaches the query.
 *
 * Only Name is required; a bare name is a valid contact. Deleting the last one
 * is refused server-side with `ERR_LAST_CONTACT`.
 */
export function useProfileContacts(editable: boolean, { showSuccess, showError }: ProfileFeedback) {
  const { t } = useTranslation(['restaurants', 'common'])

  const [sortBy, setSortBy] = useState<ContactSortBy>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [searchField, setSearchField] = useState<ContactSortBy | undefined>()
  const [search, setSearch] = useState('')

  const params = useMemo(
    () => sanitiseContactsParams({ sortBy, sortOrder, searchField, search }),
    [sortBy, sortOrder, searchField, search],
  )

  const contactsQuery = usePartnerContactsQuery(params)
  const createContact = useCreateContactMutation()
  const updateContact = useUpdateContactMutation()
  const deleteContact = useDeleteContactMutation()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PartnerContact | null>(null)
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<CardErrors>({})
  const [deleteTarget, setDeleteTarget] = useState<PartnerContact | null>(null)

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setFormOpen(true)
  }

  const openEdit = (contact: PartnerContact) => {
    setEditing(contact)
    setForm({
      name: contact.name,
      title: contact.title ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
    })
    setErrors({})
    setFormOpen(true)
  }

  const submitForm = () => {
    const found = validateContact(form, t)
    if (hasCardErrors(found)) {
      setErrors(found)
      return
    }
    setErrors({})

    // Optional fields are omitted when blank rather than sent empty.
    const payload = {
      name: form.name.trim(),
      ...omitEmpty({ title: form.title, email: form.email, phone: toE164(form.phone) }),
    } as ContactInput

    const onSuccess = () => {
      showSuccess(editing ? t('restaurants:contacts.updated') : t('restaurants:contacts.added'))
      setFormOpen(false)
    }
    const onError = (cause: unknown) => {
      setErrors(mapProfileFieldErrors(cause))
      showError(cause)
    }

    if (editing) updateContact.mutate({ id: editing.id, data: payload }, { onSuccess, onError })
    else createContact.mutate(payload, { onSuccess, onError })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteContact.mutate(deleteTarget.id, {
      onSuccess: () => {
        showSuccess(t('restaurants:contacts.deleted'))
        setDeleteTarget(null)
      },
      onError: (cause) => {
        // The last-contact guard is a rule, not a failure — but it still reads
        // as a message rather than silently doing nothing.
        showError(cause)
        setDeleteTarget(null)
      },
    })
  }

  const applySort = (field: ContactSortBy) => {
    if (field === sortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortBy(field)
    setSortOrder('asc')
  }

  const applySearch = (field: ContactSortBy | undefined, term: string) => {
    setSearchField(field)
    setSearch(term)
  }

  return {
    contacts: contactsQuery.data?.items ?? [],
    isPending: contactsQuery.isPending,
    isError: contactsQuery.isError,
    error: contactsQuery.error,
    isFetching: contactsQuery.isFetching,

    sortBy,
    sortOrder,
    applySort,
    searchField,
    search,
    applySearch,

    editable,
    formOpen,
    editing,
    form,
    // Any edit clears the errors, so a corrected form re-enables Save.
    setForm: (next: ContactForm) => {
      setErrors({})
      setForm(next)
    },
    errors,
    blocked: hasCardErrors(errors),
    openAdd,
    openEdit,
    closeForm: () => {
      setFormOpen(false)
      setErrors({})
    },
    submitForm,
    saving: createContact.isPending || updateContact.isPending,

    deleteTarget,
    requestDelete: setDeleteTarget,
    cancelDelete: () => setDeleteTarget(null),
    confirmDelete,
    deleting: deleteContact.isPending,
    /**
     * False on the last remaining contact (BR-15).
     *
     * The server refuses it with `ERR_LAST_CONTACT` regardless — this just stops
     * the partner reaching for a control that can only fail.
     */
    canDelete: (contactsQuery.data?.items.length ?? 0) > 1,
  }
}
