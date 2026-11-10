import { Injectable } from '@nestjs/common'

export interface AmenityUsage {
  restaurantsCount: number
  sampleRestaurants: { id: string; name: string }[]
}

type Counter<T> = (id: string) => Promise<T>
/** How many upcoming interest tables hold a restaurant's table area or menu option. */
/** A Mingler's display name, once the Minglers module provides it. */
type MinglerLookup = (id: string) => Promise<{ id: string; name: string } | null>
type HoldCounter = (restaurantId: string, id: string) => Promise<number>

/**
 * Live usage numbers shown on the catalogue screens: restaurants per category
 * and amenity, interest tables per topic. The modules that own those records
 * plug their counters in; until they do, everything counts as unused.
 */
@Injectable()
export class UsageService {
  private categoryCounter: Counter<number> = async () => 0
  private amenityCounter: Counter<AmenityUsage> = async () => ({ restaurantsCount: 0, sampleRestaurants: [] })
  private topicCounter: Counter<number> = async () => 0
  private tableHolds: HoldCounter = async () => 0
  private comboHolds: HoldCounter = async () => 0
  private minglerLookup: MinglerLookup = async () => null

  provide(counters: { category?: Counter<number>; amenity?: Counter<AmenityUsage>; topic?: Counter<number>; tableHolds?: HoldCounter; comboHolds?: HoldCounter; mingler?: MinglerLookup }) {
    if (counters.category) this.categoryCounter = counters.category
    if (counters.amenity) this.amenityCounter = counters.amenity
    if (counters.topic) this.topicCounter = counters.topic
    if (counters.tableHolds) this.tableHolds = counters.tableHolds
    if (counters.comboHolds) this.comboHolds = counters.comboHolds
    if (counters.mingler) this.minglerLookup = counters.mingler
  }

  restaurantsInCategory(id: string) {
    return this.categoryCounter(id)
  }
  amenity(id: string) {
    return this.amenityCounter(id)
  }
  interestTablesForTopic(id: string) {
    return this.topicCounter(id)
  }
  upcomingTablesUsingTable(restaurantId: string, tableId: string) {
    return this.tableHolds(restaurantId, tableId)
  }
  upcomingTablesUsingCombo(restaurantId: string, comboId: string) {
    return this.comboHolds(restaurantId, comboId)
  }
  mingler(id: string) {
    return this.minglerLookup(id)
  }
}
