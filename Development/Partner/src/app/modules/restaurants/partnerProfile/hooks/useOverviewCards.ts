import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { hasProfileValue, omitEmpty, toE164 } from '../format'
import {
  hasCardErrors,
  mapProfileFieldErrors,
  validateDetails,
  validateLocation,
  validateOwner,
  validateRules,
} from '../validation'
import type { CardErrors } from '../validation'
import type { PartnerRestaurantProfile, UpdateProfileDto } from '../types'
import { useUpdateProfileMutation } from './usePartnerProfileQueries'
import type { ProfileFeedback } from './useProfileFeedback'

export type OverviewCard = 'details' | 'location' | 'owner' | 'rules'

export interface DetailsForm {
  cuisine: string
  description: string
}

export interface LocationForm {
  fullAddress: string
  areaDistrict: string
  city: string
  /**
   * Held as strings, not numbers: an empty field has to stay distinguishable
   * from a legal `0`, which is a valid coordinate on both axes.
   */
  latitude: string
  longitude: string
  phone: string
  email: string
  website: string
}

export interface OwnerForm {
  name: string
  email: string
  phone: string
}

export interface RulesForm {
  houseRules: string
  dressCode: string
  servesAlcohol: boolean | undefined
}

/**
 * The four Overview cards (BR-06) and their edit modals.
 *
 * Each card sends **only its own fields** — an absent key is left untouched, and
 * a blank input is omitted rather than sent as null, which the API does not
 * accept as a way to clear a field.
 *
 * Phones are normalised to compact E.164 on the way out: the design shows
 * `+92 300 123 4567`, and that spacing is rejected on the wire.
 */
export function useOverviewCards(
  profile: PartnerRestaurantProfile | undefined,
  { showSuccess, showError }: ProfileFeedback,
) {
  const { t } = useTranslation(['restaurants', 'common'])
  const updateProfile = useUpdateProfileMutation()

  const [openCard, setOpenCard] = useState<OverviewCard | null>(null)
  const [errors, setErrors] = useState<CardErrors>({})
  const [details, setDetails] = useState<DetailsForm>({ cuisine: '', description: '' })
  const [location, setLocation] = useState<LocationForm>({
    fullAddress: '',
    areaDistrict: '',
    city: '',
    latitude: '',
    longitude: '',
    phone: '',
    email: '',
    website: '',
  })
  const [owner, setOwner] = useState<OwnerForm>({ name: '', email: '', phone: '' })
  const [rules, setRules] = useState<RulesForm>({
    houseRules: '',
    dressCode: '',
    servesAlcohol: undefined,
  })

  const openCardModal = (card: OverviewCard) => {
    if (!profile) return
    // A reopened modal starts clean; last attempt's errors are not this one's.
    setErrors({})
    if (card === 'details') {
      setDetails({ cuisine: profile.cuisine ?? '', description: profile.description ?? '' })
    }
    if (card === 'location') {
      setLocation({
        fullAddress: profile.location.fullAddress ?? '',
        areaDistrict: profile.location.areaDistrict ?? '',
        city: profile.location.city ?? '',
        // `?? ''` rather than `String(x ?? '')` on purpose: 0 is a legal
        // coordinate and must render as "0", not as an empty field.
        latitude: profile.location.latitude === null ? '' : String(profile.location.latitude),
        longitude: profile.location.longitude === null ? '' : String(profile.location.longitude),
        phone: profile.restaurant.phone ?? '',
        email: profile.restaurant.email ?? '',
        website: profile.restaurant.website ?? '',
      })
    }
    if (card === 'owner') {
      setOwner({
        name: profile.owner.name ?? '',
        email: profile.owner.email ?? '',
        phone: profile.owner.phone ?? '',
      })
    }
    if (card === 'rules') {
      setRules({
        houseRules: profile.rules.houseRules ?? '',
        dressCode: profile.rules.dressCode ?? '',
        servesAlcohol: profile.rules.servesAlcohol ?? undefined,
      })
    }
    setOpenCard(card)
  }

  /**
   * Validates, then writes.
   *
   * A client-side failure never leaves the browser — the seven documented rules
   * should not cost a round trip. A 422 that still comes back is client/server
   * drift, and its `details.fields` is mapped onto the same inline errors so the
   * partner is told *which* field, not just that something was wrong.
   */
  const persist = (found: CardErrors, build: () => UpdateProfileDto) => {
    if (hasCardErrors(found)) {
      setErrors(found)
      return
    }
    setErrors({})

    updateProfile.mutate(build(), {
      onSuccess: () => {
        showSuccess(t('restaurants:profile.saved'))
        setOpenCard(null)
      },
      onError: (cause) => {
        setErrors(mapProfileFieldErrors(cause))
        showError(cause)
      },
    })
  }

  const saveDetails = () =>
    persist(validateDetails(details, t), () =>
      omitEmpty({ cuisine: details.cuisine, description: details.description }),
    )

  const saveLocation = () =>
    persist(validateLocation(location, t), () => {
      const patch: UpdateProfileDto = {}
      const loc: NonNullable<UpdateProfileDto['location']> = omitEmpty({
        fullAddress: location.fullAddress,
        areaDistrict: location.areaDistrict,
        city: location.city,
      })
      // Validated as a pair, so if one is present both are.
      if (location.latitude.trim() && location.longitude.trim()) {
        loc.latitude = Number(location.latitude)
        loc.longitude = Number(location.longitude)
      }
      if (Object.keys(loc).length) patch.location = loc

      const rest = omitEmpty({
        phone: toE164(location.phone),
        email: location.email,
        website: location.website,
      })
      if (Object.keys(rest).length) patch.restaurant = rest

      return patch
    })

  const saveOwner = () =>
    persist(validateOwner(owner, t), () => {
      const group = omitEmpty({
        name: owner.name,
        email: owner.email,
        phone: toE164(owner.phone),
      })
      return Object.keys(group).length ? { owner: group } : {}
    })

  const saveRules = () =>
    persist(validateRules(rules, t), () => {
      // servesAlcohol is a real boolean, so false must survive `omitEmpty`.
      const group: Record<string, unknown> = omitEmpty({
        houseRules: rules.houseRules,
        dressCode: rules.dressCode,
      })
      if (rules.servesAlcohol !== undefined) group.servesAlcohol = rules.servesAlcohol
      return Object.keys(group).length ? { rules: group as UpdateProfileDto['rules'] } : {}
    })

  /** Drives the Draft empty-states — driven off null, not empty string. */
  const filled = {
    details: hasProfileValue(profile?.cuisine) || hasProfileValue(profile?.description),
    location:
      hasProfileValue(profile?.location.fullAddress) ||
      hasProfileValue(profile?.location.areaDistrict) ||
      hasProfileValue(profile?.location.city) ||
      hasProfileValue(profile?.location.latitude) ||
      hasProfileValue(profile?.restaurant.phone) ||
      hasProfileValue(profile?.restaurant.email) ||
      hasProfileValue(profile?.restaurant.website),
    owner:
      hasProfileValue(profile?.owner.name) ||
      hasProfileValue(profile?.owner.email) ||
      hasProfileValue(profile?.owner.phone),
    rules:
      hasProfileValue(profile?.rules.houseRules) ||
      hasProfileValue(profile?.rules.dressCode) ||
      // Answering "no" is still an answer — but only once there is a profile to
      // have answered it, or an unloaded page would read as filled.
      (!!profile && profile.rules.servesAlcohol !== null),
  }

  /**
   * Any edit clears the card's errors.
   *
   * This is what makes disabling Save on error safe: the first keystroke after a
   * failed attempt re-enables it, so a corrected form can never deadlock behind a
   * stale message.
   */
  function editing<T>(setter: (next: T) => void) {
    return (next: T) => {
      setErrors({})
      setter(next)
    }
  }

  return {
    openCard,
    openCardModal,
    closeCard: () => {
      setOpenCard(null)
      setErrors({})
    },
    saving: updateProfile.isPending,
    /** Inline messages for the open card, from validation or a 422. */
    errors,
    /** True while the open card holds errors — Save stays disabled until edited. */
    blocked: hasCardErrors(errors),
    filled,
    details,
    setDetails: editing(setDetails),
    saveDetails,
    location,
    setLocation: editing(setLocation),
    saveLocation,
    owner,
    setOwner: editing(setOwner),
    saveOwner,
    rules,
    setRules: editing(setRules),
    saveRules,
  }
}
