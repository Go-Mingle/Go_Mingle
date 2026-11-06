/**
 * Canonical page-size options for every paginated table in the admin portal.
 * Only 10 / 25 / 50 are offered anywhere. Individual tables keep their own
 * default pageSize — all module defaults fall within this set.
 */
export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const

/**
 * Ready-made antd Select options using the plain "N / page" label style.
 * For modules that localise the label, map PAGE_SIZE_OPTIONS directly with
 * their own `t('pagination.perPage', { n })` formatter instead.
 */
export const pageSizeSelectOptions = PAGE_SIZE_OPTIONS.map((n) => ({
  value: n,
  label: `${n} / page`,
}))
