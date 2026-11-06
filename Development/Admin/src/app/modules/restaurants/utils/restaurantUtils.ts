export function getRestaurantInitials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w))
  if (words.length === 0) return '??'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
