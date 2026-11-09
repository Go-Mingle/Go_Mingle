import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Starter catalogues for a new GoMingle install.
 *
 * A clean release ships with no restaurants, Minglers, interest tables,
 * bookings or finance records. These four catalogues are the exception:
 * they are the lists admins and partners pick from, so the platform is usable
 * from the first sign-in. Admins can edit or delete any of it.
 *
 *   Amenities             what partners tick on their restaurant profile
 *   Interests             what Minglers choose, grouped
 *   Topics                themes for interest tables, each linked to interests
 *   Preference questions  the Mingler app's onboarding questions
 */

const ICONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../node_modules/@phosphor-icons/core/assets/fill')

const SEEDED_AT = '2026-11-09T09:00:00.000Z'

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// ── Amenities (icon = Phosphor icon name) ───────────────────────────────────

const AMENITIES = [
  ['Free Wi-Fi', 'WifiHigh'],
  ['Valet parking', 'Car'],
  ['Wheelchair accessible', 'Wheelchair'],
  ['Family seating', 'UsersThree'],
  ['Prayer area', 'HandsPraying'],
  ['Air conditioned', 'Snowflake'],
  ['Generator / UPS backup', 'Lightning'],
  ['Card payments accepted', 'CreditCard'],
  ['Outdoor seating', 'Tree'],
  ['Rooftop seating', 'Buildings'],
  ['Sea view', 'Waves'],
  ['Private dining room', 'DoorOpen'],
  ['Kids play area', 'Baby'],
  ['Live music', 'MusicNote'],
  ['Laptop friendly', 'Laptop'],
  ['Designated smoking area', 'Cigarette'],
]

export function starterAmenities() {
  return AMENITIES.map(([name, icon]) => ({
    id: `am-${slug(name)}`,
    name,
    iconUrl: icon,
    restaurantsCount: 0,
    sampleRestaurants: [],
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  }))
}

// ── Interests ───────────────────────────────────────────────────────────────

const INTERESTS = {
  'Food & Drink': ['Desi Food', 'BBQ & Grills', 'Street Food', 'Seafood', 'Fine Dining', 'Desserts', 'Coffee', 'Chai', 'Vegetarian'],
  'Business & Careers': ['Startups', 'Entrepreneurship', 'Investing', 'Marketing', 'Freelancing', 'Networking', 'Leadership'],
  Technology: ['Technology', 'Artificial Intelligence', 'Product Design', 'Gaming'],
  'Arts & Culture': ['Books', 'Urdu Poetry', 'Film', 'Music', 'Art & Design', 'Photography', 'Theatre'],
  'Sports & Fitness': ['Cricket', 'Football', 'Padel', 'Running', 'Fitness'],
  Lifestyle: ['Travel', 'Fashion', 'Wellness', 'Parenting', 'Pets'],
  'Learning & Ideas': ['History', 'Languages', 'Science', 'Personal Finance'],
  Community: ['Volunteering', 'Sustainability'],
}

export function starterInterests() {
  return Object.entries(INTERESTS).flatMap(([groupName, names]) =>
    names.map((name) => ({ id: `in-${slug(name)}`, name, groupName, createdAt: SEEDED_AT, updatedAt: null })),
  )
}

// ── Topics ──────────────────────────────────────────────────────────────────

const TOPICS = [
  {
    name: 'Karachi Food Trail',
    description: 'For people who plan their week around where to eat next: nihari, karahi, BBQ and the city’s best street food.',
    interests: ['Desi Food', 'BBQ & Grills', 'Street Food'],
    icon: 'bowl-food',
    colour: '#E5503F',
  },
  {
    name: 'Founders’ Table',
    description: 'Early-stage founders and operators swap notes on building, hiring and raising in Pakistan.',
    interests: ['Startups', 'Entrepreneurship', 'Investing', 'Networking'],
    icon: 'rocket-launch',
    colour: '#0C8C84',
  },
  {
    name: 'Tech & AI Night',
    description: 'What’s new in software and AI, and what it means for work here. Open to builders and the curious alike.',
    interests: ['Technology', 'Artificial Intelligence', 'Product Design'],
    icon: 'cpu',
    colour: '#3D5AFE',
  },
  {
    name: 'Book Club',
    description: 'One book, agreed in advance, discussed over dinner. English and Urdu titles alternate.',
    interests: ['Books', 'Urdu Poetry'],
    icon: 'books',
    colour: '#8E44AD',
  },
  {
    name: 'Chai & Conversations',
    description: 'Unhurried evenings over chai on history, ideas and the stories that shaped the city.',
    interests: ['Chai', 'History', 'Urdu Poetry'],
    icon: 'coffee',
    colour: '#A0522D',
  },
  {
    name: 'Cricket Talk',
    description: 'Match analysis, fantasy picks and old rivalries, for fans who can talk cricket all night.',
    interests: ['Cricket', 'Football'],
    icon: 'cricket',
    colour: '#2F9E6A',
  },
  {
    name: 'Creative Minds',
    description: 'Designers, photographers, filmmakers and artists sharing work in progress and what inspires them.',
    interests: ['Art & Design', 'Photography', 'Film'],
    icon: 'palette',
    colour: '#D81B60',
  },
  {
    name: 'Wellness & Fitness',
    description: 'Runners, padel players and anyone building healthier habits, over a balanced meal.',
    interests: ['Fitness', 'Running', 'Padel', 'Wellness'],
    icon: 'heartbeat',
    colour: '#00897B',
  },
  {
    name: 'Travel Stories',
    description: 'Northern Areas road trips to Istanbul layovers: trade travel stories, tips and plans.',
    interests: ['Travel', 'Photography', 'Languages'],
    icon: 'airplane-tilt',
    colour: '#1565C0',
  },
  {
    name: 'Money Matters',
    description: 'Saving, investing and planning ahead, in plain language, without the sales pitch.',
    interests: ['Personal Finance', 'Investing'],
    icon: 'coins',
    colour: '#B06000',
  },
  {
    name: 'Women Who Lead',
    description: 'Women building careers and businesses in Karachi share wins, setbacks and advice.',
    interests: ['Leadership', 'Entrepreneurship', 'Networking'],
    icon: 'crown-simple',
    colour: '#6A1B9A',
  },
  {
    name: 'Giving Back',
    description: 'Volunteers and people looking to help: local causes, sustainability and how to get involved.',
    interests: ['Volunteering', 'Sustainability'],
    icon: 'hand-heart',
    colour: '#43A047',
  },
]

/** A 80×80 rounded tile in the topic's colour with its white Phosphor icon. */
function topicGraphic(icon, colour) {
  let inner = ''
  try {
    const svg = fs.readFileSync(path.join(ICONS, `${icon}-fill.svg`), 'utf8')
    inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  } catch {
    return null
  }
  const tile =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">' +
    `<rect width="80" height="80" rx="18" fill="${colour}"/>` +
    `<svg x="20" y="20" width="40" height="40" viewBox="0 0 256 256" fill="#ffffff">${inner}</svg>` +
    '</svg>'
  return `data:image/svg+xml;base64,${Buffer.from(tile).toString('base64')}`
}

export function starterTopics(interests = starterInterests()) {
  const byName = new Map(interests.map((i) => [i.name, i]))
  return TOPICS.map((t) => ({
    id: `tp-${slug(t.name)}`,
    name: t.name,
    description: t.description,
    graphicUrl: topicGraphic(t.icon, t.colour),
    interests: t.interests.map((n) => byName.get(n)).filter(Boolean).map((i) => ({ ...i })),
    interestTablesCount: 0,
    createdAt: SEEDED_AT,
  }))
}

// ── Preference questions (Mingler app onboarding) ───────────────────────────

const QUESTIONS = [
  ['How often do you eat out?', 'SINGLE_SELECT', ['Rarely', 'Once or twice a month', 'Every week', 'A few times a week']],
  [
    'Which cuisines do you enjoy?',
    'MULTI_SELECT',
    ['Pakistani / Desi', 'BBQ & grills', 'Chinese', 'Continental', 'Italian', 'Thai', 'Japanese', 'Lebanese / Arabic', 'Seafood', 'Fast food'],
  ],
  [
    'Do you have any dietary requirements?',
    'MULTI_SELECT',
    ['None', 'Vegetarian', 'Vegan', 'Gluten-free', 'Nut allergy', 'Dairy-free', 'Prefer mild spice'],
  ],
  ['When do you prefer to meet?', 'MULTI_SELECT', ['Weekday lunch', 'Weekday dinner', 'Weekend brunch', 'Weekend dinner']],
  ['What table size feels right for you?', 'SINGLE_SELECT', ['Small (4–5 people)', 'Medium (6–7 people)', 'Full table (8 people)']],
  [
    'What kind of atmosphere do you enjoy?',
    'MULTI_SELECT',
    ['Quiet and cosy', 'Lively and buzzing', 'Rooftop or outdoor', 'Family friendly', 'Fine dining'],
  ],
  [
    'Which areas of Karachi are easiest for you?',
    'MULTI_SELECT',
    ['DHA', 'Clifton', 'Gulshan-e-Iqbal', 'PECHS / Tariq Road', 'Bahadurabad', 'North Nazimabad', 'Saddar'],
  ],
  [
    'What is your usual budget per person?',
    'SINGLE_SELECT',
    ['Under PKR 2,000', 'PKR 2,000 – 4,000', 'PKR 4,000 – 7,000', 'Over PKR 7,000'],
  ],
  [
    'What are you hoping to get from GoMingle?',
    'MULTI_SELECT',
    ['New friends', 'Professional networking', 'Great food', 'Learning something new', 'Getting out more'],
  ],
]

export function starterPreferenceQuestions() {
  const questions = []
  const optionsById = {}
  QUESTIONS.forEach(([question, type, options], i) => {
    const id = `pq-${i + 1}`
    questions.push({ id, question, type, questionOrder: i + 1, optionsCount: options.length, createdAt: SEEDED_AT })
    optionsById[id] = options.map((text, n) => ({ id: `${id}-opt${n + 1}`, text, displayOrder: n }))
  })
  return { questions, optionsById }
}
