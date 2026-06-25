export function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

export function relativeLuminance(r, g, b) {
  const RsRGB = r / 255
  const GsRGB = g / 255
  const BsRGB = b / 255
  const R = RsRGB <= 0.03928 ? RsRGB / 12.92 : Math.pow((RsRGB + 0.055) / 1.055, 2.4)
  const G = GsRGB <= 0.03928 ? GsRGB / 12.92 : Math.pow((GsRGB + 0.055) / 1.055, 2.4)
  const B = BsRGB <= 0.03928 ? BsRGB / 12.92 : Math.pow((BsRGB + 0.055) / 1.055, 2.4)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

export function contrastTextColor(bgHex) {
  const { r, g, b } = hexToRgb(bgHex)
  const lum = relativeLuminance(r, g, b)
  return lum > 0.5 ? '#1a1a1a' : '#ffffff'
}
