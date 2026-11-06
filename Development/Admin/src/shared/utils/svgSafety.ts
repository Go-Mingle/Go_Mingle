export function isUnsafeSvgContent(svgText: string): boolean {
  if (/<script[\s>/]/i.test(svgText)) return true
  if (/xlink:href\s*=\s*["'](?!#)(?:\s*(?:https?:)?\/\/)/i.test(svgText)) return true
  return false
}
