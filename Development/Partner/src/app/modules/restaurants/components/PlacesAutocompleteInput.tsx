import { useEffect, useRef } from 'react'
import { Input } from 'antd'
import type { InputRef } from 'antd'

// ── Minimal Google Maps Places typings (avoids pulling @types/google.maps) ──
interface GooglePlaceResult {
  formatted_address?: string
  name?: string
}
interface GoogleAutocomplete {
  addListener(event: string, handler: () => void): void
  getPlace(): GooglePlaceResult
}
interface GooglePlacesLib {
  Autocomplete: new (
    input: HTMLInputElement,
    opts?: { types?: string[]; fields?: string[] },
  ) => GoogleAutocomplete
}
interface GoogleMapsNS {
  places: GooglePlacesLib
  event?: { clearInstanceListeners(instance: object): void }
}
declare global {
  interface Window {
    google?: { maps: GoogleMapsNS }
  }
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

let mapsLoader: Promise<void> | null = null
function loadGoogleMaps(): Promise<void> {
  if (!API_KEY) return Promise.reject(new Error('Google Maps API key not configured'))
  if (window.google?.maps?.places) return Promise.resolve()
  if (!mapsLoader) {
    mapsLoader = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&loading=async`
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Google Maps'))
      document.head.appendChild(script)
    })
  }
  return mapsLoader
}

interface PlacesAutocompleteInputProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
}

/**
 * Address input backed by Google Places Autocomplete. When
 * VITE_GOOGLE_MAPS_API_KEY is set it loads the Maps SDK and offers native
 * Google location suggestions; otherwise it degrades to a plain text input.
 */
export function PlacesAutocompleteInput({
  value,
  onChange,
  placeholder,
}: PlacesAutocompleteInputProps) {
  const inputRef = useRef<InputRef>(null)
  // Keep the latest onChange without re-running the setup effect.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!API_KEY) return
    let autocomplete: GoogleAutocomplete | undefined
    loadGoogleMaps()
      .then(() => {
        const el = inputRef.current?.input
        if (!el || !window.google) return
        autocomplete = new window.google.maps.places.Autocomplete(el, {
          types: ['establishment', 'geocode'],
          fields: ['formatted_address', 'name'],
        })
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete!.getPlace()
          const picked = place.formatted_address ?? place.name
          if (picked) onChangeRef.current?.(picked)
        })
      })
      .catch(() => {
        /* No key or load failure — the plain input still works. */
      })
    return () => {
      if (autocomplete) window.google?.maps.event?.clearInstanceListeners(autocomplete)
    }
  }, [])

  return (
    <Input
      ref={inputRef}
      size="large"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  )
}
