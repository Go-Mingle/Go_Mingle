import type {
  RestaurantTable,
  MenuOptionItem,
  TableAvailabilityWindow,
} from '../../restaurants/restaurantApi.types'
import type {
  ModalRestaurant,
  TableDay,
  TableDaySlots,
  TableDayRange,
} from './CreateInterestTableModal'

// Real tables API returns per-window availability keyed by numeric dayOfWeek
// (0=Sun..6=Sat); the create/edit modal filters by weekday `slots`, so group
// windows by day into that shape.
const DAY_KEYS: TableDay[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function availabilityToSlots(availability: TableAvailabilityWindow[]): TableDaySlots[] {
  const byDay = new Map<TableDay, TableDayRange[]>()
  for (const w of availability) {
    const day = DAY_KEYS[w.dayOfWeek]
    if (!day) continue
    const ranges = byDay.get(day) ?? []
    ranges.push({ start: w.start, end: w.end })
    byDay.set(day, ranges)
  }
  return Array.from(byDay.entries()).map(([day, ranges]) => ({ day, ranges }))
}

/** Build the create/edit modal's `restaurant` prop from the real tables + menu-options APIs. */
export function buildModalRestaurant(
  id: string,
  name: string,
  tables: RestaurantTable[],
  menuOptions: MenuOptionItem[],
): ModalRestaurant {
  return {
    id,
    name,
    combos: menuOptions.map((m) => ({ id: m.id, name: m.name, price: m.pricePkr ?? 0 })),
    tables: tables.map((tb) => ({
      id: tb.id,
      name: tb.name,
      slots: availabilityToSlots(tb.availability),
    })),
  }
}
