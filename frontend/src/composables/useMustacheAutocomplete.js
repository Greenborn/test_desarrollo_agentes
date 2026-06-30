import { ref } from 'vue'

export function useMustacheAutocomplete() {
  const show = ref(false)
  const filteredVariables = ref([])
  const selectedIndex = ref(0)
  const beforeOpen = ref('')
  const afterCursor = ref('')

  function findMustacheContext(text, cursorPos) {
    if (!text) return null
    const before = text.slice(0, cursorPos)
    const lastOpen = before.lastIndexOf('{{')
    if (lastOpen === -1) return null
    const closeBetween = text.indexOf('}}', lastOpen)
    if (closeBetween !== -1 && closeBetween < cursorPos) return null
    return {
      beforeOpen: text.slice(0, lastOpen),
      filter: text.slice(lastOpen + 2, cursorPos),
      afterCursor: text.slice(cursorPos),
    }
  }

  function update(text, cursorPos, variables) {
    const ctx = findMustacheContext(text, cursorPos)
    if (!ctx) {
      show.value = false
      return
    }
    beforeOpen.value = ctx.beforeOpen
    afterCursor.value = ctx.afterCursor
    const fltr = ctx.filter.toLowerCase()
    filteredVariables.value = fltr
      ? (variables || []).filter(v =>
          v.key.toLowerCase().includes(fltr) ||
          (v.value && String(v.value).toLowerCase().includes(fltr))
        )
      : [...(variables || [])]
    selectedIndex.value = 0
    show.value = filteredVariables.value.length > 0
  }

  function navigate(direction) {
    const len = filteredVariables.value.length
    if (len === 0) return
    if (direction === 'down') {
      selectedIndex.value = (selectedIndex.value + 1) % len
    } else if (direction === 'up') {
      selectedIndex.value = (selectedIndex.value - 1 + len) % len
    }
  }

  function getSelectedKey() {
    return filteredVariables.value[selectedIndex.value]?.key || null
  }

  function close() {
    show.value = false
  }

  function insert(key) {
    if (!key) return null
    const newText = beforeOpen.value + '{{' + key + '}}' + afterCursor.value
    show.value = false
    return newText
  }

  return {
    show, filteredVariables, selectedIndex,
    update, navigate, getSelectedKey, close, insert,
  }
}
