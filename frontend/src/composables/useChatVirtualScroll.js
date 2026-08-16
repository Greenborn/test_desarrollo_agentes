import { ref, computed, watch, nextTick } from 'vue'

const DEFAULT_HEIGHT = 80
const ROLE_HEIGHTS = {
  command: 40,
  user: 50,
  opencode_info: 60,
  result: 120,
  opencode_stream: 160,
  opencode_result: 160,
  opencode_control: 180,
  opencode_confirmed: 50,
}

// Ventana deslizante para la lista de mensajes del chat: solo se renderiza un
// subconjunto de mensajes (el visible + overscan), manteniendo la altura total
// con espaciadores superior/inferior para que el scrollbar sea correcto.
export function useChatVirtualScroll(messages, { windowSize = 30, overscan = 5 } = {}) {
  const startIdx = ref(0)
  const endIdx = ref(0)
  const container = ref(null)
  const isNearBottom = ref(true)

  const heights = new Map()
  const observers = new Map()

  function msgKey(m) {
    if (!m) return undefined
    return m.id ?? m._key
  }

  function estimateFor(m) {
    if (!m) return DEFAULT_HEIGHT
    return ROLE_HEIGHTS[m.role] || DEFAULT_HEIGHT
  }

  let offsets = []
  let offsetsLength = -1
  let rAFPending = false
  // Indica si hay cambios de altura pendientes de aplicar (callbacks de
  // ResizeObserver). Si los cambios solo afectan a mensajes fuera de la ventana
  // visible, se reconstruyen offsets de forma perezosa al volver a necesitarlos.
  let dirtyHeights = false

  function rebuildOffsets() {
    const arr = messages.value || []
    const len = arr.length
    // Si no hubo cambio de longitud ni cambios de altura pendientes, no hay nada
    // que recalcular: evita reconstrucciones O(n) innecesarias.
    if (len === offsetsLength && !dirtyHeights) return
    offsets = new Array(len + 1)
    offsets[0] = 0
    for (let i = 0; i < len; i++) {
      const key = msgKey(arr[i])
      const h = key != null && heights.has(key) ? heights.get(key) : estimateFor(arr[i])
      offsets[i + 1] = offsets[i] + h
    }
    offsetsLength = len
    dirtyHeights = false
  }

  // Acumula cambios de altura (callbacks de ResizeObserver) y reconstruye los
  // offsets una sola vez por frame. Durante el streaming un mensaje crece de
  // altura en cada chunk; sin este batch cada callback recorrería O(n).
  function scheduleRebuildOffsets() {
    dirtyHeights = true
    if (rAFPending) return
    rAFPending = true
    requestAnimationFrame(() => {
      rAFPending = false
      rebuildOffsets()
    })
  }

  function offsetBefore(idx) {
    const i = Math.max(0, Math.min(idx, offsets.length - 1))
    return offsets[i] || 0
  }

  function indexFromScroll(scrollTop) {
    if (offsets.length <= 1) return 0
    let lo = 0
    let hi = offsets.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (offsetBefore(mid + 1) > scrollTop) {
        hi = mid
      } else {
        lo = mid + 1
      }
    }
    return lo
  }

  function visibleCountForViewport(clientHeight) {
    const total = offsets.length > 1 ? offsets[offsets.length - 1] : 0
    const avg = offsets.length > 1 && total > 0 ? total / (offsets.length - 1) : DEFAULT_HEIGHT
    const need = Math.ceil(clientHeight / Math.max(avg, 1)) + overscan
    return Math.max(windowSize, need)
  }

  function reset() {
    heights.clear()
    // Fuerza reconstrucción aunque la longitud no haya cambiado: tras limpiar
    // heights, los offsets basados en alturas anteriores quedan obsoletos.
    offsetsLength = -1
    dirtyHeights = true
    rebuildOffsets()
    isNearBottom.value = true
    const len = messages.value ? messages.value.length : 0
    startIdx.value = Math.max(0, len - windowSize)
    endIdx.value = len
  }

  function onScroll() {
    const el = container.value
    if (!el) return
    const len = messages.value ? messages.value.length : 0
    if (len === 0) {
      startIdx.value = 0
      endIdx.value = 0
      return
    }
    isNearBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 200
    if (isNearBottom.value) {
      startIdx.value = Math.max(0, len - windowSize)
      endIdx.value = len
      return
    }
    const i = indexFromScroll(el.scrollTop)
    const count = visibleCountForViewport(el.clientHeight)
    startIdx.value = Math.max(0, i - overscan)
    endIdx.value = Math.min(len, startIdx.value + count)
  }

  function setMsgEl(m, el) {
    const key = msgKey(m)
    if (key == null) return
    const existing = observers.get(key)
    if (existing) {
      existing.disconnect()
      observers.delete(key)
    }
    if (!el) return
    const node = el.$el || el
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect ? entry.contentRect.height : node.offsetHeight
        if (heights.get(key) !== h) {
          heights.set(key, h)
          scheduleRebuildOffsets()
        }
      }
    })
    ro.observe(node)
    observers.set(key, ro)
  }

  function shiftAfterPrepend(addedCount) {
    if (!addedCount) return
    const len = messages.value ? messages.value.length : 0
    startIdx.value = Math.min(len, startIdx.value + addedCount)
    endIdx.value = Math.min(len, endIdx.value + addedCount)
  }

  function setContainer(el) {
    container.value = el
  }

  const topPad = computed(() => offsetBefore(startIdx.value))
  const bottomPad = computed(() => {
    const len = messages.value ? messages.value.length : 0
    return offsetBefore(len) - offsetBefore(endIdx.value)
  })
  const visibleMessages = computed(() => {
    const arr = messages.value || []
    return arr.slice(startIdx.value, endIdx.value).filter(Boolean)
  })

  watch(
    () => (messages.value || []).length,
    () => {
      rebuildOffsets()
      const el = container.value
      if (!el) return
      if (isNearBottom.value) {
        const len = messages.value.length
        startIdx.value = Math.max(0, len - windowSize)
        endIdx.value = len
        nextTick(() => {
          if (el && isNearBottom.value) el.scrollTop = el.scrollHeight
        })
      }
    },
  )

  return {
    container,
    isNearBottom,
    startIdx,
    endIdx,
    visibleMessages,
    topPad,
    bottomPad,
    reset,
    onScroll,
    setMsgEl,
    shiftAfterPrepend,
    setContainer,
  }
}
