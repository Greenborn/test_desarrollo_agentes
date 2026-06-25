import { defineStore } from 'pinia'
import { ref, markRaw } from 'vue'

export const useModalStore = defineStore('modal', () => {
  const stack = ref([])

  function open(component, props = {}, options = {}) {
    const id = Date.now() + Math.random()
    stack.value.push({
      id,
      component: markRaw(component),
      props,
      title: options.title || 'Modal',
      wide: options.wide || false,
    })
    return id
  }

  function close(id) {
    const idx = stack.value.findIndex((m) => m.id === id)
    if (idx >= 0) stack.value.splice(idx, 1)
  }

  function closeTop() {
    if (stack.value.length > 0) stack.value.pop()
  }

  return { stack, open, close, closeTop }
})
