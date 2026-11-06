import type { ReactNode } from 'react'
import { Alert, Modal, Spin, Table, Tooltip } from 'antd'
import type { ColumnsType, TableProps } from 'antd/es/table'
import type { FilterDropdownProps, SortOrder } from 'antd/es/table/interface'
import { AddressBook, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import { AppButton } from '../../../../atoms/AppButton'
import { ConfirmModal } from '../../../../molecules/ConfirmModal'
import { pinEndColumns } from '../../../../molecules/tableColumns'
import { TabEmptyState } from '../../components/TabEmptyState'
import { CONTACT_SORT_FIELDS, PROFILE_LIMITS } from '../constants'
import { formatPhoneForDisplay } from '../format'
import type { ContactSortBy, PartnerContact } from '../types'
import type { useProfileContacts } from '../hooks/useProfileContacts'
import { LabelledInput, ModalFooter } from './OverviewModals'
import { ContactSearchDropdown } from './ContactSearchDropdown'
import {
  ariaSortFor,
  contactSearchIcon,
  contactSortIcon,
  sortOrderFor,
} from './contactsColumnIcons'

type Contacts = ReturnType<typeof useProfileContacts>

const CELL = 'font-[Poppins,sans-serif] text-sm font-medium text-[var(--color-text-secondary)]'

/** antd's third click clears the sort; the endpoint has no unsorted state. */
const TWO_WAY_SORT: SortOrder[] = ['ascend', 'descend']

function ContactFormModal({ c }: { c: Contacts }) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <Modal
      open={c.formOpen}
      onCancel={c.closeForm}
      title={t(c.editing ? 'restaurants:contacts.editTitle' : 'restaurants:contacts.addTitle')}
      footer={null}
      width={480}
      destroyOnHidden
    >
      <div className="mt-3 flex flex-col gap-4">
        {/* Only Name is required — a bare name is a valid contact (BR-15). */}
        <LabelledInput
          label={t('restaurants:contacts.name')}
          value={c.form.name}
          maxLength={PROFILE_LIMITS.contactName}
          error={c.errors.name}
          onChange={(name) => c.setForm({ ...c.form, name })}
        />
        <LabelledInput
          label={t('restaurants:contacts.title')}
          value={c.form.title}
          maxLength={PROFILE_LIMITS.contactTitle}
          error={c.errors.title}
          onChange={(title) => c.setForm({ ...c.form, title })}
        />
        <LabelledInput
          label={t('restaurants:contacts.email')}
          value={c.form.email}
          error={c.errors.email}
          onChange={(email) => c.setForm({ ...c.form, email })}
        />
        <LabelledInput
          label={t('restaurants:contacts.phone')}
          value={c.form.phone}
          placeholder="+923001234567"
          error={c.errors.phone}
          onChange={(phone) => c.setForm({ ...c.form, phone })}
        />
      </div>

      <ModalFooter
        onCancel={c.closeForm}
        onSave={c.submitForm}
        saving={c.saving}
        blocked={c.blocked}
      />
    </Modal>
  )
}

/**
 * The Contacts tab (US-05).
 *
 * Sorting and searching are server-resolved — a bad value on those params is a
 * 422 rather than a silent default, so the controller sanitises them first.
 * Every column carries both controls (AC-05.1); search is a single
 * `searchField` + `search` pair, so one column's term replaces another's.
 * Deleting the only remaining contact is refused server-side.
 */
export function ContactsTab({ c }: { c: Contacts }) {
  const { t } = useTranslation(['restaurants', 'common'])

  const searching = Boolean(c.search)

  /**
   * Sorting stays server-resolved: the column is declared `sorter: true` so antd
   * owns the header affordance and its keyboard handling, but never reorders the
   * rows itself — the click is forwarded to the controller through `onChange`.
   */
  const column = (
    field: ContactSortBy,
    label: string,
    placeholder: string,
    render: (value: string | null) => ReactNode,
  ) => {
    const sorted = c.sortBy === field
    return {
      title: label,
      dataIndex: field,
      key: field,
      sorter: true,
      // Two-way only — antd's third click would clear the sort, and the endpoint
      // has no unsorted state to clear it to.
      sortDirections: TWO_WAY_SORT,
      sortOrder: sortOrderFor(sorted, c.sortOrder),
      sortIcon: contactSortIcon(t('restaurants:contacts.sortBy', { column: label })),
      onHeaderCell: () => ({ 'aria-sort': ariaSortFor(sorted, c.sortOrder) }),
      // The dropdown drives the controller's server-side search, so there is
      // deliberately no client-side `onFilter`.
      filtered: c.searchField === field && searching,
      filterIcon: contactSearchIcon(t('restaurants:contacts.searchBy', { column: label })),
      filterDropdown: (props: FilterDropdownProps) => (
        <ContactSearchDropdown
          // Keyed on the open state so each open remounts and re-seeds its input
          // from the live term rather than from whatever was last typed here.
          key={String(props.visible)}
          {...props}
          field={field}
          placeholder={placeholder}
          activeField={c.searchField}
          activeTerm={c.search}
          onApply={c.applySearch}
        />
      ),
      render,
    }
  }

  const columns: ColumnsType<PartnerContact> = [
    column(
      'name',
      t('restaurants:contacts.name'),
      t('restaurants:contacts.searchNames'),
      (value) => <span className={CELL}>{value}</span>,
    ),
    column(
      'title',
      t('restaurants:contacts.title'),
      t('restaurants:contacts.searchTitles'),
      (value) => <span className={CELL}>{value || '—'}</span>,
    ),
    column(
      'email',
      t('restaurants:contacts.email'),
      t('restaurants:contacts.searchEmails'),
      (value) =>
        value ? (
          <a
            href={`mailto:${value}`}
            className="font-[Poppins,sans-serif] text-sm font-medium text-[var(--color-accent)] no-underline"
          >
            {value}
          </a>
        ) : (
          <span className={CELL}>—</span>
        ),
    ),
    column(
      'phone',
      t('restaurants:contacts.phone'),
      t('restaurants:contacts.searchPhones'),
      (value) => <span className={CELL}>{value ? formatPhoneForDisplay(value) : '—'}</span>,
    ),
  ]

  if (c.editable) {
    columns.push({
      title: '',
      key: 'actions',
      width: 90,
      align: 'center',
      render: (_value: unknown, contact: PartnerContact) => (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            aria-label={t('common:buttons.edit')}
            onClick={() => c.openEdit(contact)}
            className="border-none bg-transparent p-1.5 text-[var(--color-text-muted)] cursor-pointer md:hover:text-[var(--color-accent)]"
          >
            <PencilSimple size={16} />
          </button>
          {/* Disabled on the last remaining contact (BR-15). The server refuses
              it with ERR_LAST_CONTACT regardless; this stops the partner
              reaching for a control that can only fail. */}
          <Tooltip title={c.canDelete ? '' : t('restaurants:contacts.lastContactHint')}>
            <button
              type="button"
              aria-label={t('common:buttons.delete')}
              onClick={() => c.requestDelete(contact)}
              disabled={!c.canDelete}
              className="border-none bg-transparent p-1.5 text-[var(--color-text-muted)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 md:hover:text-[var(--color-error)]"
            >
              <Trash size={16} />
            </button>
          </Tooltip>
        </div>
      ),
    })
  }

  /**
   * antd reports the column it wants sorted; the controller decides the
   * direction. Filter changes come through here too — those are already handled
   * by the dropdown, so only the sort action is forwarded.
   */
  const handleChange: TableProps<PartnerContact>['onChange'] = (
    _pagination,
    _filters,
    sorter,
    extra,
  ) => {
    if (extra.action !== 'sort') return
    const active = Array.isArray(sorter) ? sorter[0] : sorter
    const field = active?.columnKey
    // An unrecognised field is a 422 on this endpoint, so it never leaves here.
    if (typeof field === 'string' && (CONTACT_SORT_FIELDS as readonly string[]).includes(field)) {
      c.applySort(field as ContactSortBy)
    }
  }

  if (c.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    )
  }

  if (c.isError) {
    return (
      <Alert type="error" message={getApiErrorMessage(c.error, t('common:errors.fetchError'))} />
    )
  }

  const addButton = c.editable ? (
    <AppButton variant="primary" onClick={c.openAdd} className="justify-center">
      <Plus size={15} />
      {t('restaurants:contacts.add')}
    </AppButton>
  ) : undefined

  return (
    <div>
      {/* A truly empty tab (no contacts and no active search) gets the rich
          first-time prompt; a search that returns nothing keeps the table so the
          Name filter stays reachable. */}
      {c.contacts.length === 0 && !searching ? (
        <TabEmptyState
          IconComp={AddressBook}
          title={t('restaurants:contacts.emptyTitle')}
          description={t('restaurants:contacts.emptyDesc')}
          action={addButton}
        />
      ) : (
        <>
          {addButton && <div className="mb-5 flex justify-end">{addButton}</div>}
          <div className="profile-data-table">
            <Table<PartnerContact>
              dataSource={c.contacts}
              columns={pinEndColumns(columns)}
              rowKey="id"
              size="middle"
              loading={c.isFetching}
              pagination={false}
              onChange={handleChange}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: t('restaurants:contacts.empty') }}
            />
          </div>
        </>
      )}

      <ContactFormModal c={c} />

      <ConfirmModal
        open={!!c.deleteTarget}
        onCancel={c.cancelDelete}
        onConfirm={c.confirmDelete}
        danger
        title={t('restaurants:contacts.deleteTitle')}
        content={t('restaurants:contacts.deleteBody', { name: c.deleteTarget?.name ?? '' })}
        cancelText={t('common:buttons.cancel')}
        confirmText={t('common:buttons.delete')}
      />
    </div>
  )
}
