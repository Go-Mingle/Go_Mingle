// ── Roles ────────────────────────────────────────────────
export const mockRoles = [
  { id: 'r1', name: 'Super Admin', fullAccess: true, modules: [], usersCount: 2 },
  {
    id: 'r2',
    name: 'Operations Manager',
    fullAccess: false,
    modules: ['restaurants', 'booking', 'minglers', 'finances'],
    usersCount: 3,
  },
  {
    id: 'r3',
    name: 'Finance Manager',
    fullAccess: false,
    modules: ['finances', 'notifications'],
    usersCount: 1,
  },
  {
    id: 'r4',
    name: 'Content Reviewer',
    fullAccess: false,
    modules: ['minglers'],
    usersCount: 0,
  },
]

// ── Admin Users ──────────────────────────────────────────
export const mockUsers = [
  {
    id: 'u1',
    name: 'Hira Mansoor',
    username: 'hira.mansoor',
    email: 'hira@gomingle.com',
    role: 'Super Admin',
    roleId: 'r1',
    designation: 'Owner',
    status: 'active',
    lastActive: '2026-05-05',
    initials: 'HM',
  },
  {
    id: 'u2',
    name: 'Yasmeen Iqbal',
    username: 'yasmeen.iqbal',
    email: 'yasmeen@gomingle.com',
    role: 'Operations Manager',
    roleId: 'r2',
    designation: 'General Manager',
    status: 'active',
    lastActive: '2026-05-04',
    initials: 'YI',
  },
  {
    id: 'u3',
    name: 'Nadeem Sharif',
    username: 'nadeem.sharif',
    email: 'nadeem@gomingle.com',
    role: 'Operations Manager',
    roleId: 'r2',
    designation: 'Floor Manager',
    status: 'active',
    lastActive: '2026-05-03',
    initials: 'NS',
  },
  {
    id: 'u4',
    name: 'Raheel Chaudhry',
    username: 'raheel.chaudhry',
    email: 'raheel@gomingle.com',
    role: 'Finance Manager',
    roleId: 'r3',
    designation: 'Finance Lead',
    status: 'active',
    lastActive: '2026-04-30',
    initials: 'RC',
  },
  {
    id: 'u5',
    name: 'Erum Vohra',
    username: 'erum.vohra',
    email: 'erum@gomingle.com',
    role: 'Operations Manager',
    roleId: 'r2',
    designation: 'Shift Supervisor',
    status: 'suspended',
    lastActive: '2026-03-12',
    initials: 'EV',
  },
  {
    id: 'u6',
    name: 'Karim Baloch',
    username: 'karim.baloch',
    email: 'karim@gomingle.com',
    role: 'Content Reviewer',
    roleId: 'r4',
    designation: 'Marketing Lead',
    status: 'active',
    lastActive: '2026-05-01',
    initials: 'KB',
  },
]

// ── Categories ───────────────────────────────────────────
// Pricing rule (display utility only — actual calculation is server-side):
// For both commission and penalty, the charge applied is the GREATER of
// (bill × percent) and the minimum PKR value.
export const mockCategories = [
  {
    id: 'c1',
    name: 'Premium',
    description: 'Fine dining and luxury experiences',
    bookingCommissionPercent: 12,
    restaurantCount: 4,
  },
  {
    id: 'c2',
    name: 'Standard',
    description: 'Everyday dining and casual restaurants',
    bookingCommissionPercent: 9,
    restaurantCount: 2,
  },
  {
    id: 'c3',
    name: 'Casual',
    description: 'Cafes, fast casual, and quick bites',
    bookingCommissionPercent: 7,
    restaurantCount: 1,
  },
  {
    id: 'c4',
    name: 'Pop-up',
    description: 'Temporary and event-based dining concepts',
    bookingCommissionPercent: 6,
    restaurantCount: 0,
  },
]

// ── Interest Topics (a.k.a. "Topics") ─────────────────────
export interface InterestTopic {
  id: string
  name: string
  description: string
  image: string
  interestIds: string[]
  tablesCount: number
}

export const mockInterestTopics: InterestTopic[] = [
  {
    id: 't1',
    name: 'Wine & Dine',
    description:
      'An evening pairing fine wines with curated small plates, for guests who enjoy relaxed conversation over good food.',
    image: 'https://picsum.photos/seed/wine-dine/80/80',
    interestIds: ['i1', 'i2', 'i10'],
    tablesCount: 4,
  },
  {
    id: 't2',
    name: 'Startup Founders',
    description:
      'A table for early-stage founders to swap notes on building, fundraising, and the realities of running a company.',
    image: 'https://picsum.photos/seed/startup-founders/80/80',
    interestIds: ['i3', 'i4', 'i11'],
    tablesCount: 2,
  },
  {
    id: 't3',
    name: 'Book Club',
    description:
      'Readers gather to discuss a chosen title over dinner. Each session focuses on one book agreed in advance.',
    image: 'https://picsum.photos/seed/book-club/80/80',
    interestIds: ['i5', 'i6'],
    tablesCount: 3,
  },
  {
    id: 't4',
    name: 'Tech & AI',
    description:
      'Conversations on the latest in technology and artificial intelligence, open to enthusiasts and professionals alike.',
    image: 'https://picsum.photos/seed/tech-ai/80/80',
    interestIds: ['i7', 'i8'],
    tablesCount: 5,
  },
  {
    id: 't5',
    name: 'Foodies Unite',
    description:
      'For people who plan trips around restaurants. Share recommendations and discover hidden culinary gems together.',
    image: 'https://picsum.photos/seed/foodies-unite/80/80',
    interestIds: ['i10', 'i9', 'i12'],
    tablesCount: 1,
  },
]
