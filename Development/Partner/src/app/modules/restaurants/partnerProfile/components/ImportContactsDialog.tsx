import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ImportDialog } from '../../../../molecules/ImportDialog'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import { PARTNER_CONTACTS_QUERY_KEY } from '../constants'
import { omitEmpty, toE164 } from '../format'
import { partnerProfileService } from '../services'
import { hasCardErrors, validateContact } from '../validation'

type Col = 'name' | 'title' | 'email' | 'phone'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Adds many restaurant contacts from a spreadsheet, so GoMingle's team can see
 * who to reach. Each row is checked with the same rules as the contact form and
 * sent through the same create endpoint.
 */
export function ImportContactsDialog({ open, onClose }: Props) {
  const { t } = useTranslation(['restaurants', 'common'])
  const qc = useQueryClient()

  return (
    <ImportDialog<Col>
      open={open}
      onClose={onClose}
      onImported={() => void qc.invalidateQueries({ queryKey: PARTNER_CONTACTS_QUERY_KEY })}
      title={t('restaurants:contacts.import.title')}
      intro={t('restaurants:contacts.import.intro')}
      templateFileName="gomingle-restaurant-contacts.csv"
      columns={[
        {
          key: 'name',
          label: t('restaurants:contacts.import.columns.name'),
          headers: ['name', 'full name', 'contact name'],
          required: true,
          example: 'Bilal Ahmed',
        },
        {
          key: 'title',
          label: t('restaurants:contacts.import.columns.title'),
          headers: ['title', 'designation', 'job title', 'role'],
          example: 'Head chef',
        },
        {
          key: 'email',
          label: t('restaurants:contacts.import.columns.email'),
          headers: ['email', 'email address'],
          example: 'bilal@restaurant.pk',
        },
        {
          key: 'phone',
          label: t('restaurants:contacts.import.columns.phone'),
          headers: ['phone', 'phone number', 'mobile', 'contact number'],
          example: '+92 300 1234567',
        },
      ]}
      validate={(r, seen) => {
        const errors = validateContact(r, t)
        if (hasCardErrors(errors)) return Object.values(errors).find(Boolean) ?? null
        const key = `${r.name.toLowerCase()}|${r.email.toLowerCase()}|${toE164(r.phone)}`
        if (seen.has(key)) return t('common:import.problems.duplicate')
        seen.add(key)
        return null
      }}
      importRow={async (r) => {
        await partnerProfileService.createContact({
          name: r.name.trim(),
          ...omitEmpty({ title: r.title, email: r.email, phone: toE164(r.phone) }),
        })
      }}
      errorMessage={(e) => getApiErrorMessage(e, t('common:import.errors.unreadable'))}
    />
  )
}
