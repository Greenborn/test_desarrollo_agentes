import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

export const useModalStore = defineStore('modal', () => {
  const stack = ref([])

  function open(component, props) {
    const id = Date.now() + Math.random()
    stack.value.push({ id, component, props })
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
