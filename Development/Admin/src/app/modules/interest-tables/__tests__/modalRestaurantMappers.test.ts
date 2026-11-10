import { describe, it, expect } from 'vitest'
import { availabilityToSlots, buildModalRestaurant } from '../components/modalRestaurantMappers'
import type { RestaurantTable, MenuOptionItem } from '../../restaurants/restaurantApi.types'

describe('availabilityToSlots', () => {
  it('groups availability windows by weekday (0=Sun..6=Sat)', () => {
    const slots = availabilityToSlots([
      { dayOfWeek: 1, start: '10:00', end: '14:00' },
      { dayOfWeek: 1, start: '18:00', end: '23:00' },
      { dayOfWeek: 5, start: '12:00', end: '15:00' },
    ])
    const mon = slots.find((s) => s.day === 'mon')
    expect(mon?.ranges).toEqual([
      { start: '10:00', end: '14:00' },
      { start: '18:00', end: '23:00' },
    ])
    expect(slots.find((s) => s.day === 'fri')?.ranges).toHaveLength(1)
  })

  it('skips windows with an out-of-range dayOfWeek', () => {
    expect(availabilityToSlots([{ dayOfWeek: 9, start: '10:00', end: '11:00' }])).toEqual([])
  })
})

describe('buildModalRestaurant', () => {
  const tables: RestaurantTable[] = [
    { id: 't1', name: 'Window', availability: [{ dayOfWeek: 0, start: '10:00', end: '22:00' }] },
  ]
  const menuOptions: MenuOptionItem[] = [
    { id: 'm1', name: 'Tasting', pricePkr: 200, courses: [] },
    { id: 'm2', name: 'Free', pricePkr: null, courses: [] },
  ]

  it('maps tables + menu options to the modal restaurant shape', () => {
    const r = buildModalRestaurant('r1', 'Aurelia', tables, menuOptions)
    expect(r.id).toBe('r1')
    expect(r.name).toBe('Aurelia')
    expect(r.tables[0]).toMatchObject({ id: 't1', name: 'Window' })
    expect(r.tables[0].slots[0].day).toBe('sun')
    expect(r.combos).toEqual([
      { id: 'm1', name: 'Tasting', price: 200 },
      { id: 'm2', name: 'Free', price: 0 },
    ])
  })
})
