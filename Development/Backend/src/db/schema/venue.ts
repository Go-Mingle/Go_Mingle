import { boolean, customType, doublePrecision, integer, jsonb, pgTable, primaryKey, serial, text } from 'drizzle-orm/pg-core'

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' })

export interface TimeRange {
  /** 'HH:MM', 24-hour */
  start: string
  end: string
}
/** Keys '0' (Sunday) … '6' (Saturday); every key always present. */
export type WeekAvailability = Record<string, TimeRange[]>

export interface ComboCourse {
  course: string
  choose: number
  options: string[]
}

/** Per-restaurant id counters (`t-1`, `c-2`, `mu-3`…), so ids are never reused. */
export const restaurantCounters = pgTable(
  'restaurant_counters',
  {
    restaurantId: text('restaurant_id').notNull(),
    name: text('name').notNull(),
    value: integer('value').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.restaurantId, t.name] })],
)

/** Table areas of a restaurant and when each can be booked. */
export const restaurantTables = pgTable(
  'restaurant_tables',
  {
    restaurantId: text('restaurant_id').notNull(),
    tableId: text('table_id').notNull(),
    seq: serial('seq').notNull(),
    name: text('name').notNull(),
    isHidden: boolean('is_hidden').notNull().default(false),
    availability: jsonb('availability').$type<WeekAvailability>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.restaurantId, t.tableId] })],
)

/** Prix-fixe menu options (combos) a restaurant offers at interest tables. */
export const menuOptions = pgTable(
  'menu_options',
  {
    restaurantId: text('restaurant_id').notNull(),
    comboId: text('combo_id').notNull(),
    seq: serial('seq').notNull(),
    name: text('name').notNull(),
    pricePkr: doublePrecision('price_pkr').notNull(),
    isHidden: boolean('is_hidden').notNull().default(false),
    courses: jsonb('courses').$type<ComboCourse[]>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.restaurantId, t.comboId] })],
)

/** Uploaded menu PDFs. Replaced or removed files are kept; the restaurant row points at the current one. */
export const menuPdfs = pgTable(
  'menu_pdfs',
  {
    restaurantId: text('restaurant_id').notNull(),
    file: text('file').notNull(),
    bytes: bytea('bytes').notNull(),
  },
  (t) => [primaryKey({ columns: [t.restaurantId, t.file] })],
)
