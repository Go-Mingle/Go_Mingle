import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal, Spin } from 'antd'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  ChartLineUp,
  ChatCircleText,
  ClipboardText,
  ClockCounterClockwise,
  ClockClockwise,
  Bell,
  EnvelopeSimple,
  ForkKnife,
  Heart,
  MagnifyingGlass,
  Moon,
  PicnicTable,
  Question,
  Scroll,
  ShieldCheck,
  Sparkle,
  Star,
  Sun,
  Tag,
  Ticket,
  UserCircle,
  UserGear,
  Users,
  Vault,
  Wallet,
  type IconProps,
} from '@phosphor-icons/react'
import { useAppSelector } from '../../../shared/store/hooks'
import { getRoleFromUser } from '../../../shared/services/permissions'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import { useThemeStore } from '../../../shared/theme/themeStore'
import { transitionTheme } from '../../../shared/theme/themeTransition'
import {
  matchScore,
  pagesFor,
  pushRecent,
  rankPages,
  readRecent,
  type PageCommand,
  type RecentItem,
} from './commandModel'
import { MIN_RECORD_QUERY, useCommandSearch, type RecordHit } from './useCommandSearch'

type Icon = ComponentType<IconProps>

const PAGE_ICONS: Record<string, Icon> = {
  dashboard: ChartLineUp,
  restaurants: ForkKnife,
  'approval-queue': ClipboardText,
  'interest-tables': PicnicTable,
  minglers: Users,
  finances: Wallet,
  escrow: Vault,
  'change-log': Scroll,
  notifications: Bell,
  amenities: Sparkle,
  categories: Tag,
  'email-templates': EnvelopeSimple,
  loyalty: Star,
  'preference-questions': Question,
  'roles-access': ShieldCheck,
  interests: Heart,
  'interest-topics': ChatCircleText,
  'timer-settings': ClockClockwise,
  users: UserGear,
}

const KIND_ICONS: Record<RecentItem['kind'], Icon> = {
  page: ArrowRight,
  restaurant: ForkKnife,
  mingler: UserCircle,
  booking: Ticket,
  user: UserGear,
}

interface Item {
  id: string
  icon: Icon
  title: string
  subtitle?: string
  /** Shown at the right of the row, e.g. "Page". */
  hint?: string
  run: () => void
}

interface Group {
  id: string
  label: string
  items: Item[]
}

interface Props {
  open: boolean
  onClose: () => void
}

/** Wraps the part of `text` that matches `query` in a highlight. */
function Highlight({ text, query }: { text: string; query: string }): ReactNode {
  const q = query.trim()
  if (!q) return text
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[3px] bg-[var(--color-accent-light)] px-[1px] text-inherit">
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  )
}

/**
 * Global search for the Admin Panel (GM-344): pages, restaurants, Minglers,
 * bookings (by reference) and admin users, limited to what the admin's role
 * may open. Ctrl/Cmd+K opens it from anywhere.
 */
export function CommandPalette({ open, onClose }: Props) {
  const { t } = useTranslation()
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={640}
      destroyOnHidden
      className="gm-command"
      wrapClassName="gm-command-wrap"
      title={null}
      aria-label={t('command.title')}
    >
      {/* Mounted per opening, so every search starts empty. */}
      <PaletteBody onClose={onClose} />
    </Modal>
  )
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const open = true
  const { t } = useTranslation()
  const navigate = useNavigate()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const user = useAppSelector((s) => s.auth.user)
  const role = getRoleFromUser(user)
  const mode = useThemeStore((s) => s.mode)

  const [query, setQuery] = useState('')
  const [activeRaw, setActive] = useState(0)
  const [recent] = useState<RecentItem[]>(readRecent)
  const debounced = useDebouncedValue(query, 200)
  const search = useCommandSearch(debounced, role, open)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [])

  const go = (item: RecentItem) => {
    pushRecent(item)
    onClose()
    navigate(item.path)
  }

  const groups = useMemo<Group[]>(() => {
    const q = query.trim()
    const pageLabel = (p: PageCommand) => t(p.labelKey)
    const pageItem = (p: PageCommand): Item => ({
      id: `page-${p.key}`,
      icon: PAGE_ICONS[p.key] ?? ArrowRight,
      title: pageLabel(p),
      hint: t('command.kinds.page'),
      run: () => go({ kind: 'page', title: pageLabel(p), path: p.path }),
    })
    const recordItems = (kind: RecentItem['kind'], hits: RecordHit[]): Item[] =>
      hits.map((h) => ({
        id: `${kind}-${h.id}`,
        icon: KIND_ICONS[kind],
        title: h.title,
        subtitle: h.subtitle || undefined,
        run: () => go({ kind, title: h.title, subtitle: h.subtitle, path: h.path }),
      }))

    const themeLabel = mode === 'dark' ? t('topbar.switchToLight') : t('topbar.switchToDark')
    const actions: Item[] = [
      {
        id: 'action-theme',
        icon: mode === 'dark' ? Sun : Moon,
        title: themeLabel,
        hint: t('command.kinds.action'),
        run: () => {
          onClose()
          transitionTheme(mode === 'dark' ? 'light' : 'dark')
        },
      },
    ].filter((a) => matchScore(`${a.title} theme dark light`, q) > 0)

    const pages = pagesFor(role)
    const out: Group[] = []
    if (!q) {
      if (recent.length)
        out.push({
          id: 'recent',
          label: t('command.groups.recent'),
          items: recent.map((r, i) => ({
            id: `recent-${i}`,
            icon: r.kind === 'page' ? ClockCounterClockwise : KIND_ICONS[r.kind],
            title: r.title,
            subtitle: r.subtitle,
            run: () => go(r),
          })),
        })
      out.push({ id: 'pages', label: t('command.groups.pages'), items: pages.map(pageItem) })
    } else {
      out.push({
        id: 'pages',
        label: t('command.groups.pages'),
        items: rankPages(pages, q, pageLabel).slice(0, 6).map(pageItem),
      })
      // Only show record groups for the query the results belong to.
      if (debounced.trim() === q) {
        out.push({
          id: 'bookings',
          label: t('command.groups.bookings'),
          items: recordItems('booking', search.bookings),
        })
        out.push({
          id: 'restaurants',
          label: t('command.groups.restaurants'),
          items: recordItems('restaurant', search.restaurants),
        })
        out.push({
          id: 'minglers',
          label: t('command.groups.minglers'),
          items: recordItems('mingler', search.minglers),
        })
        out.push({
          id: 'users',
          label: t('command.groups.users'),
          items: recordItems('user', search.users),
        })
      }
    }
    out.push({ id: 'actions', label: t('command.groups.actions'), items: actions })
    return out.filter((g) => g.items.length > 0)
    // `go` only closes over stable values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    query,
    debounced,
    search.bookings,
    search.restaurants,
    search.minglers,
    search.users,
    recent,
    role,
    mode,
    t,
  ])

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])

  // Keep the highlighted row in range and in view.
  const active = Math.min(activeRaw, Math.max(0, flat.length - 1))
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!flat.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((active + 1) % flat.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((active - 1 + flat.length) % flat.length)
    } else if (e.key === 'Home' && e.ctrlKey) {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End' && e.ctrlKey) {
      e.preventDefault()
      setActive(flat.length - 1)
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      flat[active]?.run()
    }
  }

  const q = query.trim()
  const waiting = q.length >= MIN_RECORD_QUERY && (debounced.trim() !== q || search.loading)
  const optionId = (i: number) => `${listId}-opt-${i}`
  let index = -1

  return (
    <div onKeyDown={onKeyDown}>
      <div className="flex items-center gap-3 border-b border-[var(--color-divider)] px-4">
        <MagnifyingGlass
          size={18}
          aria-hidden
          className="shrink-0 text-[var(--color-text-muted)]"
        />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          placeholder={t('command.placeholder')}
          aria-label={t('command.title')}
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={flat.length ? optionId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          data-testid="command-input"
          className="h-14 min-w-0 flex-1 border-none bg-transparent text-[15px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-placeholder)]"
        />
        {waiting && <Spin size="small" aria-hidden />}
        <kbd className="hidden rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-text-muted)] sm:inline">
          Esc
        </kbd>
      </div>

      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={t('command.results')}
        className="max-h-[min(60vh,440px)] overflow-y-auto overscroll-contain px-2 py-2"
      >
        {groups.map((g) => (
          <div
            key={g.id}
            role="group"
            aria-labelledby={`${listId}-${g.id}`}
            className="mb-1 last:mb-0"
          >
            <div
              id={`${listId}-${g.id}`}
              className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[0.06em] text-[var(--color-text-muted)] uppercase"
            >
              {g.label}
            </div>
            {g.items.map((item) => {
              index += 1
              const i = index
              const Icon = item.icon
              const selected = i === active
              return (
                <div
                  key={item.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={selected}
                  data-index={i}
                  data-testid={`command-item-${item.id}`}
                  onMouseMove={() => !selected && setActive(i)}
                  onClick={() => item.run()}
                  className={clsx(
                    'gm-command-item flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 transition-colors duration-150',
                    selected ? 'bg-[var(--color-selected)]' : 'bg-transparent',
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] transition-colors duration-150',
                      selected
                        ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                        : 'bg-[var(--color-hover-neutral)] text-[var(--color-text-secondary)]',
                    )}
                  >
                    <Icon size={16} weight="bold" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-[var(--color-text)]">
                      <Highlight text={item.title} query={q} />
                    </span>
                    {item.subtitle && (
                      <span className="block truncate text-[12px] text-[var(--color-text-muted)]">
                        {item.subtitle}
                      </span>
                    )}
                  </span>
                  {item.hint && (
                    <span className="hidden shrink-0 text-[12px] text-[var(--color-text-muted)] sm:inline">
                      {item.hint}
                    </span>
                  )}
                  <ArrowRight
                    size={14}
                    aria-hidden
                    className={clsx(
                      'shrink-0 text-[var(--color-text-muted)] transition-[opacity,transform] duration-150',
                      selected ? 'translate-x-0 opacity-100' : '-translate-x-1 opacity-0',
                    )}
                  />
                </div>
              )
            })}
          </div>
        ))}

        {q && !waiting && flat.filter((i) => !i.id.startsWith('action-')).length === 0 && (
          <div className="px-4 py-10 text-center" role="status">
            <p className="m-0 text-[14px] font-semibold text-[var(--color-text)]">
              {t('command.empty.title', { query: q })}
            </p>
            <p className="m-0 mt-1 text-[13px] text-[var(--color-text-muted)]">
              {q.length < MIN_RECORD_QUERY ? t('command.empty.short') : t('command.empty.hint')}
            </p>
          </div>
        )}
        {search.failed && !waiting && (
          <p className="m-0 px-4 pb-2 text-[12px] text-[var(--color-warning)]" role="status">
            {t('command.partial')}
          </p>
        )}
      </div>

      <div className="hidden items-center gap-4 border-t border-[var(--color-divider)] px-4 py-2 text-[12px] text-[var(--color-text-muted)] sm:flex">
        <span>
          <kbd className="gm-kbd inline-flex">↑</kbd> <kbd className="gm-kbd inline-flex">↓</kbd>{' '}
          {t('command.keys.move')}
        </span>
        <span>
          <kbd className="gm-kbd inline-flex">↵</kbd> {t('command.keys.open')}
        </span>
        <span>
          <kbd className="gm-kbd inline-flex">Esc</kbd> {t('command.keys.close')}
        </span>
      </div>
    </div>
  )
}
