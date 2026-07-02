import { defineStore } from 'pinia'
import { ref, markRaw } from 'vue'

export const useModalStore = defineStore('modal', () => {
  const stack = ref([])
  let zIndexCounter = 1050

  function open(component, props = {}, options = {}) {
    const id = Date.now() + Math.random()
    const zIndex = zIndexCounter++
    const winW = window.innerWidth
    const w = options.wide ? Math.min(winW * 0.9, 1400) : Math.min(720, winW * 0.85)
    const x = Math.max(0, (winW - w) / 2)
    const y = Math.max(0, 80 + stack.value.filter(m => !m.minimized).length * 30)

    stack.value.push({
      id,
      component: markRaw(component),
      props,
      title: options.title || 'Modal',
      wide: options.wide || false,
      minimized: false,
      position: { x, y },
      size: options.wide ? { width: w, height: Math.min(window.innerHeight * 0.9, 800) } : { width: w, height: null },
      zIndex,
      onClose: options.onClose || null,
    })
    return id
  }

  function close(id) {
    const idx = stack.value.findIndex((m) => m.id === id)
    if (idx >= 0) {
      const m = stack.value[idx]
      if (m.onClose) {
        try { m.onClose() } catch (err) { console.error('Error in onClose callback:', err) }
      }
      stack.value.splice(idx, 1)
    }
  }

  function closeTop() {
    if (stack.value.length > 0) close(stack.value[stack.value.length - 1].id)
  }

  function toggleMinimize(id) {
    const modal = stack.value.find((m) => m.id === id)
    if (modal) {
      modal.minimized = !modal.minimized
    }
  }

  function bringToFront(id) {
    const modal = stack.value.find((m) => m.id === id)
    if (modal) {
      modal.zIndex = zIndexCounter++
    }
  }

  function updatePosition(id, x, y) {
    const modal = stack.value.find((m) => m.id === id)
    if (modal) {
      modal.position.x = x
      modal.position.y = y
    }
  }

  return { stack, open, close, closeTop, toggleMinimize, bringToFront, updatePosition }
})
