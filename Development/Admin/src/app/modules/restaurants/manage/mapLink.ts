/** Coordinates from a pasted Google Maps link (`@24.81,67.03`, `q=24.81,67.03` or `ll=`). */
export function coordsFromMapLink(link: string): { latitude: number; longitude: number } | null {
  const m =
    link.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ??
    link.match(/[?&](?:q|ll|query)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/)
  if (!m) return null
  const latitude = Number(m[1])
  const longitude = Number(m[2])
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return { latitude, longitude }
}
