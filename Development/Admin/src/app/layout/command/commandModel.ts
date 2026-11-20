import type { ModuleKey, Role } from '../../../shared/services/permissions'
import { hasAccess } from '../../../shared/services/permissions'

/** A place in the Admin Panel the palette can open, and the module it needs. */
export interface PageCommand {
  key: string
  path: string
  /** `null` = every signed-in admin can open it. */
  module: ModuleKey | null
  /** i18n key (common namespace) of the label. */
  labelKey: string
  /** Extra words people type for this page. */
  keywords: string[]
}

export const PAGE_COMMANDS: readonly PageCommand[] = [
  {
    key: 'dashboard',
    path: '/dashboard',
    module: 'FINANCES',
    labelKey: 'nav.dashboard',
    keywords: ['home', 'insights', 'overview', 'stats'],
  },
  {
    key: 'restaurants',
    path: '/restaurants',
    module: 'MANAGE_RESTAURANTS',
    labelKey: 'nav.restaurants',
    keywords: ['partners', 'venues'],
  },
  {
    key: 'approval-queue',
    path: '/approval-queue',
    module: 'RESTAURANT_APPROVALS',
    labelKey: 'nav.approvalQueue',
    keywords: ['pending', 'applications', 'review'],
  },
  {
    key: 'interest-tables',
    path: '/interest-tables',
    module: 'MANAGE_RESTAURANTS',
    labelKey: 'nav.interestTables',
    keywords: ['bookings', 'events', 'tables'],
  },
  {
    key: 'minglers',
    path: '/minglers',
    module: 'MANAGE_MINGLERS',
    labelKey: 'nav.minglers',
    keywords: ['guests', 'customers', 'members'],
  },
  {
    key: 'finances',
    path: '/finances',
    module: 'FINANCES',
    labelKey: 'nav.finances',
    keywords: ['payouts', 'money', 'revenue'],
  },
  {
    key: 'escrow',
    path: '/finances/escrow',
    module: 'FINANCES',
    labelKey: 'command.pages.escrow',
    keywords: ['holds', 'penalties', 'ledger'],
  },
  {
    key: 'change-log',
    path: '/change-log',
    module: 'CHANGE_LOG',
    labelKey: 'nav.changeLog',
    keywords: ['audit', 'history'],
  },
  {
    key: 'notifications',
    path: '/notifications',
    module: null,
    labelKey: 'command.pages.notifications',
    keywords: ['alerts', 'inbox', 'broadcast'],
  },
  {
    key: 'amenities',
    path: '/amenities',
    module: 'AMENITIES',
    labelKey: 'nav.amenities',
    keywords: ['features'],
  },
  {
    key: 'categories',
    path: '/categories',
    module: 'CATEGORIES',
    labelKey: 'nav.categories',
    keywords: ['tiers'],
  },
  {
    key: 'email-templates',
    path: '/email-templates',
    module: 'EMAIL_TEMPLATES',
    labelKey: 'nav.emailTemplates',
    keywords: ['mail', 'messages'],
  },
  {
    key: 'loyalty',
    path: '/loyalty',
    module: 'LOYALTY_CONFIGURATION',
    labelKey: 'nav.loyalty',
    keywords: ['points', 'rewards'],
  },
  {
    key: 'preference-questions',
    path: '/preference-questions',
    module: 'PREFERENCE_QUESTIONS',
    labelKey: 'nav.preferenceQuestions',
    keywords: ['questions', 'onboarding'],
  },
  {
    key: 'roles-access',
    path: '/roles-access',
    module: 'ROLES_AND_ACCESS',
    labelKey: 'nav.rolesAccess',
    keywords: ['permissions', 'roles'],
  },
  {
    key: 'interests',
    path: '/interests',
    module: 'INTEREST_TOPICS',
    labelKey: 'nav.interests',
    keywords: ['hobbies'],
  },
  {
    key: 'interest-topics',
    path: '/interest-topics',
    module: 'INTEREST_TOPICS',
    labelKey: 'nav.interestTopics',
    keywords: ['topics', 'conversation'],
  },
  {
    key: 'timer-settings',
    path: '/timer-settings',
    module: 'TIMER_SETTINGS',
    labelKey: 'nav.timerSettings',
    keywords: ['timers', 'windows', 'cancel'],
  },
  {
    key: 'users',
    path: '/users',
    module: 'USERS',
    labelKey: 'nav.users',
    keywords: ['admins', 'team', 'staff'],
  },
]

/** Pages the role may open. */
export const pagesFor = (role: Role | null) =>
  PAGE_COMMANDS.filter((p) => p.module === null || hasAccess(role, p.module))

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')

/**
 * How well `text` matches `query`: 3 = starts with it, 2 = a word starts with
 * it, 1 = contains it, 0 = no match. Empty queries match everything (1).
 */
export function matchScore(text: string, query: string): number {
  const q = fold(query.trim())
  if (!q) return 1
  const s = fold(text)
  if (s.startsWith(q)) return 3
  if (s.split(/[\s\-&/]+/).some((w) => w.startsWith(q))) return 2
  return s.includes(q) ? 1 : 0
}

/** Pages ranked for a query: label matches beat keyword matches. */
export function rankPages(
  pages: readonly PageCommand[],
  query: string,
  label: (p: PageCommand) => string,
) {
  return pages
    .map((p) => ({
      page: p,
      score: Math.max(
        matchScore(label(p), query) * 2,
        ...p.keywords.map((k) => matchScore(k, query)),
      ),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.page)
}

/** `gm123456`, `GM 123456` or `gm-123456` → `GM-123456`; anything else → null. */
export function bookingRefFrom(query: string): string | null {
  const m = /^\s*gm[\s-]?(\d{6})\s*$/i.exec(query)
  return m ? `GM-${m[1]}` : null
}

// ── Recently opened ────────────────────────────────────────────────────────

export interface RecentItem {
  kind: 'page' | 'restaurant' | 'mingler' | 'booking' | 'user'
  title: string
  subtitle?: string
  path: string
}

const RECENT_KEY = 'gm-admin-command-recent'
const RECENT_MAX = 5

export function readRecent(): RecentItem[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? (parsed as RecentItem[]).filter((r) => r && typeof r.path === 'string').slice(0, RECENT_MAX)
      : []
  } catch {
    return []
  }
}

export function pushRecent(item: RecentItem) {
  try {
    const next = [item, ...readRecent().filter((r) => r.path !== item.path)].slice(0, RECENT_MAX)
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked (private window): recents are a convenience only.
  }
}

/** Shows ⌘K on Apple devices, Ctrl K elsewhere. */
export const isApple = () =>
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
