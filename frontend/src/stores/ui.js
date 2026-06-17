import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarCollapsed = ref(false)
  const omnifilter = ref('')

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setOmnifilter(text) {
    omnifilter.value = text
  }

  return { sidebarCollapsed, toggleSidebar, omnifilter, setOmnifilter }
})
