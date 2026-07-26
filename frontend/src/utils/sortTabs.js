export function sortTabs(tabs, savedOrder) {
  if (!savedOrder || !savedOrder.length) {
    return [...tabs].sort((a, b) => (a.priority || 50) - (b.priority || 50))
  }
  const ordered = []
  const used = new Set()
  for (const id of savedOrder) {
    const tab = tabs.find(t => t.id === id)
    if (tab) {
      ordered.push(tab)
      used.add(id)
    }
  }
  const remaining = tabs.filter(t => !used.has(t.id))
  remaining.sort((a, b) => (a.priority || 50) - (b.priority || 50))
  ordered.push(...remaining)
  return ordered
}
