import { Table, Grid } from 'antd'
import { withFixedEnds } from '../../../molecules/withFixedEnds'
import type { ColumnsType } from 'antd/es/table'
import { ArrowsDownUp, ArrowUp, ArrowDown, MagnifyingGlass } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { TableSearchFilter } from './TableSearchFilter'
import type { RestaurantContact } from '../restaurantApi.types'

/**
 * CR-56 AC-6 — `title`, `email` and `phone` are each nullable on the contacts
 * read; only `name` is guaranteed. Every missing value renders as an em dash.
 */
const EM_DASH = '—'

/** Null-safe accessors: the API sends nulls, so sort/search must not assume strings. */
const asText = (value: string | null) => value ?? ''
const compareText = (a: string | null, b: string | null) => asText(a).localeCompare(asText(b))
const matchesText = (value: string | null, needle: string) =>
  asText(value).toLowerCase().includes(needle.toLowerCase())

const tableSortIcon = ({ sortOrder }: { sortOrder: 'ascend' | 'descend' | null }) => {
  if (sortOrder === 'ascend') return <ArrowUp size={12} weight="bold" color="var(--color-accent)" />
  if (sortOrder === 'descend')
    return <ArrowDown size={12} weight="bold" color="var(--color-accent)" />
  return <ArrowsDownUp size={12} color="var(--color-text-subtle)" />
}

const searchIcon = (filtered: boolean) => (
  <MagnifyingGlass
    size={14}
    weight={filtered ? 'fill' : 'regular'}
    style={{ color: filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)' }}
  />
)

interface ContactDetailsTabProps {
  contacts: RestaurantContact[]
}

export function ContactDetailsTab({ contacts }: ContactDetailsTabProps) {
  const { t } = useTranslation('restaurants')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const columns: ColumnsType<RestaurantContact> = [
    {
      title: t('contacts.headers.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => compareText(a.name, b.name),
      sortIcon: tableSortIcon,
      filterDropdown: (props) => (
        <TableSearchFilter {...props} placeholder={t('contacts.searchNames')} />
      ),
      filterIcon: searchIcon,
      onFilter: (value, record) => matchesText(record.name, value as string),
      render: (v: string) => (
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text)',
            fontFamily: 'Poppins, sans-serif',
          }}
        >
          {v}
        </span>
      ),
    },
    {
      title: t('contacts.headers.title'),
      dataIndex: 'title',
      key: 'title',
      sorter: (a, b) => compareText(a.title, b.title),
      sortIcon: tableSortIcon,
      filterDropdown: (props) => (
        <TableSearchFilter {...props} placeholder={t('contacts.searchTitles')} />
      ),
      filterIcon: searchIcon,
      onFilter: (value, record) => matchesText(record.title, value as string),
      render: (v: string | null) => (
        <span
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
          }}
        >
          {v ?? EM_DASH}
        </span>
      ),
    },
    {
      title: t('contacts.headers.email'),
      dataIndex: 'email',
      key: 'email',
      sorter: (a, b) => compareText(a.email, b.email),
      sortIcon: tableSortIcon,
      filterDropdown: (props) => (
        <TableSearchFilter {...props} placeholder={t('contacts.searchEmails')} />
      ),
      filterIcon: searchIcon,
      onFilter: (value, record) => matchesText(record.email, value as string),
      // No email → plain dash rather than a mailto: link to nothing.
      render: (v: string | null) =>
        v ? (
          <a
            href={`mailto:${v}`}
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--color-accent)',
              textDecoration: 'none',
            }}
          >
            {v}
          </a>
        ) : (
          <span
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--color-text-muted)',
            }}
          >
            {EM_DASH}
          </span>
        ),
    },
    {
      title: t('contacts.headers.phone'),
      dataIndex: 'phone',
      key: 'phone',
      sorter: (a, b) => compareText(a.phone, b.phone),
      sortIcon: tableSortIcon,
      filterDropdown: (props) => (
        <TableSearchFilter {...props} placeholder={t('contacts.searchPhones')} />
      ),
      filterIcon: searchIcon,
      onFilter: (value, record) => matchesText(record.phone, value as string),
      render: (v: string | null) => (
        <span
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text-muted)',
          }}
        >
          {v ?? EM_DASH}
        </span>
      ),
    },
  ]

  // An empty list is a normal state, not a failure: contacts are optional and
  // are written only by the Partner Portal (CR-56 AC-5).
  if (contacts.length === 0) {
    return (
      <div className="pt-5">
        <div
          style={{
            fontSize: 13,
            fontStyle: 'italic',
            color: 'var(--color-text-muted)',
            fontFamily: 'Poppins, sans-serif',
            padding: '32px 0',
            textAlign: 'center',
          }}
        >
          {t('contacts.noContacts')}
        </div>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className="pt-5">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {contacts.map((c) => (
            <div
              key={c.id}
              style={{
                background: 'var(--color-card)',
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--color-text)',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  {c.name}
                </span>
                {/* No title → a bare dash instead of an empty accent chip. */}
                {c.title ? (
                  <span
                    style={{
                      background: 'var(--color-accent-light)',
                      color: 'var(--color-accent-dark)',
                      height: 22,
                      padding: '0 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      fontFamily: 'Poppins, sans-serif',
                    }}
                  >
                    {c.title}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--color-text-muted)',
                      fontFamily: 'Poppins, sans-serif',
                    }}
                  >
                    {EM_DASH}
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--color-text-muted)',
                      fontFamily: 'Poppins, sans-serif',
                      marginBottom: 2,
                    }}
                  >
                    {t('contacts.headers.email').toUpperCase()}
                  </div>
                  {c.email ? (
                    <a
                      href={`mailto:${c.email}`}
                      style={{
                        fontSize: 13,
                        color: 'var(--color-accent)',
                        textDecoration: 'none',
                        fontFamily: 'Poppins, sans-serif',
                      }}
                    >
                      {c.email}
                    </a>
                  ) : (
                    <span
                      style={{
                        fontSize: 13,
                        color: 'var(--color-text-muted)',
                        fontFamily: 'Poppins, sans-serif',
                      }}
                    >
                      {EM_DASH}
                    </span>
                  )}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--color-text-muted)',
                      fontFamily: 'Poppins, sans-serif',
                      marginBottom: 2,
                    }}
                  >
                    {t('contacts.headers.phone').toUpperCase()}
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--color-text-muted)',
                      fontFamily: 'Poppins, sans-serif',
                    }}
                  >
                    {c.phone ?? EM_DASH}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="pt-5">
      <div className="restaurant-contacts-table">
        <Table<RestaurantContact>
          dataSource={contacts}
          columns={withFixedEnds(columns)}
          rowKey="id"
          size="middle"
          pagination={false}
        />
      </div>
    </div>
  )
}
