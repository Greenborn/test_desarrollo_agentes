export function adjustContextMenuPosition(el, x, y, padding = 6) {
  const rect = el.getBoundingClientRect()
  let ax = x
  let ay = y

  if (x + rect.width + padding > window.innerWidth) {
    ax = Math.max(padding, x - rect.width)
  }

  if (y + rect.height + padding > window.innerHeight) {
    ay = Math.max(padding, y - rect.height)
  }

  return { x: ax, y: ay }
}

export function adjustContextMenuPositionRelative(el, x, y, parentRect, padding = 6) {
  const rect = el.getBoundingClientRect()
  let ax = x
  let ay = y

  if (x + rect.width + padding > parentRect.width) {
    ax = Math.max(padding, x - rect.width)
  }

  if (y + rect.height + padding > parentRect.height) {
    ay = Math.max(padding, y - rect.height)
  }

  return { x: ax, y: ay }
}
