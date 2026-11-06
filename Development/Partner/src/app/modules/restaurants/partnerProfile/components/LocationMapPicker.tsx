import { useCallback, useEffect, useRef, useState } from 'react'
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { useTranslation } from 'react-i18next'
import { ENV } from '../../../../../configs/env'
import { MapLinkInput } from './MapLinkInput'

/** Karachi — a sensible opening view for a restaurant with no pin yet. */
const FALLBACK_CENTER = { lat: 24.8607, lng: 67.0011 }
const PINNED_ZOOM = 16
const UNPINNED_ZOOM = 11

interface LocationMapPickerProps {
  /** Held as strings to match `LocationForm`; empty means "no pin yet". */
  latitude: string
  longitude: string
  onChange: (latitude: string, longitude: string) => void
  /** Surfaced only when the server rejects the pair. */
  error?: string
}

let configured = false

/**
 * Options are global to the document and only need setting once — the first
 * `importLibrary` call is what actually starts the download.
 */
function configureMaps(apiKey: string): void {
  if (configured) return
  setOptions({ key: apiKey, v: 'weekly' })
  configured = true
}

/**
 * The map position for the Location & Address card.
 *
 * Replaces the two numeric latitude/longitude inputs, which asked a partner to
 * know their own coordinates. A pin is set by searching for a place or by
 * dragging the marker, and both axes always move together — so the "one
 * coordinate without the other" case the validator guards is no longer reachable
 * through the UI, though the rule still stands behind a server 422.
 *
 * Deliberately just the search box and the map: no heading, no caption, no
 * coordinate readout.
 */
export function LocationMapPicker({
  latitude,
  longitude,
  onChange,
  error,
}: LocationMapPickerProps) {
  const { t } = useTranslation('restaurants')
  const searchRef = useRef<HTMLInputElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  const apiKey = ENV.GOOGLE_MAPS_API_KEY
  // Read through refs so the effect below can stay mount-only: re-running it on
  // every keystroke would rebuild the map and lose the pin.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])
  const initial = useRef({ latitude, longitude })

  const publish = useCallback((position: google.maps.LatLngLiteral) => {
    onChangeRef.current(String(position.lat), String(position.lng))
  }, [])

  useEffect(() => {
    if (!apiKey || !mapRef.current) return
    let map: google.maps.Map | null = null
    let marker: google.maps.Marker | null = null
    let autocomplete: google.maps.places.Autocomplete | null = null
    let cancelled = false

    const pinned = initial.current.latitude.trim() !== '' && initial.current.longitude.trim() !== ''
    const center = pinned
      ? { lat: Number(initial.current.latitude), lng: Number(initial.current.longitude) }
      : FALLBACK_CENTER

    configureMaps(apiKey)
    void Promise.all([importLibrary('maps'), importLibrary('places')])
      .then(() => {
        if (cancelled || !mapRef.current) return

        map = new google.maps.Map(mapRef.current, {
          center,
          zoom: pinned ? PINNED_ZOOM : UNPINNED_ZOOM,
          disableDefaultUI: true,
          zoomControl: true,
        })

        marker = new google.maps.Marker({
          map,
          position: center,
          draggable: true,
          visible: pinned,
        })

        marker.addListener('dragend', () => {
          const moved = marker?.getPosition()
          if (moved) publish({ lat: moved.lat(), lng: moved.lng() })
        })

        // Clicking the map is the other way to place a pin that has never been set.
        map.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (!event.latLng || !marker) return
          marker.setPosition(event.latLng)
          marker.setVisible(true)
          publish({ lat: event.latLng.lat(), lng: event.latLng.lng() })
        })

        if (searchRef.current) {
          autocomplete = new google.maps.places.Autocomplete(searchRef.current, {
            // `geometry.location` is the whole point — the existing
            // PlacesAutocompleteInput asks only for the formatted address, which
            // is why it cannot drive a pin.
            fields: ['geometry.location'],
          })
          autocomplete.addListener('place_changed', () => {
            const picked = autocomplete?.getPlace().geometry?.location
            if (!picked || !map || !marker) return
            const position = { lat: picked.lat(), lng: picked.lng() }
            map.setCenter(position)
            map.setZoom(PINNED_ZOOM)
            marker.setPosition(position)
            marker.setVisible(true)
            publish(position)
          })
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      // Reached through `window` and fully optional: the effect may be torn down
      // before the SDK ever resolved, in which case there is nothing to release
      // and the bare `google` global would not exist to ask.
      const release = window.google?.maps?.event?.clearInstanceListeners
      if (!release) return
      for (const instance of [autocomplete, marker, map]) {
        if (instance) release(instance)
      }
    }
    // Mount-only: the map owns its own state once built.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  if (!apiKey || failed) {
    // Without the interactive map the position is still required (BR-09a), so
    // it is taken from a pasted Google Maps link or coordinates instead of
    // leaving "Map Location" impossible to complete.
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-page)] p-[14px]">
        <MapLinkInput latitude={latitude} longitude={longitude} onChange={onChange} error={error} />
      </div>
    )
  }

  return (
    // The panel from the design: a tinted, bordered card holding the search box
    // and the map together, so they read as one control rather than two fields.
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-page)] p-[14px]">
      <label className="sr-only" htmlFor="location-map-search">
        {t('profile.form.mapSearch')}
      </label>
      <input
        id="location-map-search"
        ref={searchRef}
        type="text"
        placeholder={t('profile.form.mapSearchPlaceholder')}
        className="mb-3 h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-[14px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
      />
      <div
        ref={mapRef}
        data-testid="location-map"
        aria-label={t('profile.form.mapLabel')}
        role="application"
        className="h-[260px] w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-page)]"
      />
      {error && <p className="mt-1 text-[12px] text-[var(--color-error)]">{error}</p>}
    </div>
  )
}
