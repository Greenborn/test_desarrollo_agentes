import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarCollapsed = ref(false)
  const panelCollapsed = ref(false)
  const omnifilter = ref('')

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    saveLayoutPrefs()
  }

  function togglePanel() {
    panelCollapsed.value = !panelCollapsed.value
    saveLayoutPrefs()
  }

  function setOmnifilter(text) {
    omnifilter.value = text
  }

  async function saveLayoutPrefs() {
    try {
      await Promise.all([
        fetch('/api/command/setting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key: 'sidebar_collapsed', value: String(sidebarCollapsed.value) }),
        }),
        fetch('/api/command/setting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key: 'panel_collapsed', value: String(panelCollapsed.value) }),
        }),
      ])
    } catch (err) {
      console.error('Error saving layout preferences:', err)
    }
  }

  async function loadLayoutPrefs() {
    try {
      const [sidebarRes, panelRes] = await Promise.all([
        fetch('/api/command/setting/sidebar_collapsed', { credentials: 'include' }),
        fetch('/api/command/setting/panel_collapsed', { credentials: 'include' }),
      ])
      const sidebarData = await sidebarRes.json()
      const panelData = await panelRes.json()
      if (sidebarData.value !== null) {
        sidebarCollapsed.value = sidebarData.value === 'true'
      }
      if (panelData.value !== null) {
        panelCollapsed.value = panelData.value === 'true'
      }
    } catch (err) {
      console.error('Error loading layout preferences:', err)
    }
  }

  return { sidebarCollapsed, panelCollapsed, toggleSidebar, togglePanel, omnifilter, setOmnifilter, loadLayoutPrefs }
})
