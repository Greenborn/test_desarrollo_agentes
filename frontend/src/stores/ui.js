import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarCollapsed = ref(false)
  const panelCollapsed = ref(false)
  const panelHeight = ref(30)
  const omnifilter = ref('')

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    saveLayoutPrefs()
  }

  function togglePanel() {
    panelCollapsed.value = !panelCollapsed.value
    saveLayoutPrefs()
  }

  function setPanelHeight(h) {
    panelHeight.value = h
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
        fetch('/api/command/setting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key: 'panel_height', value: String(panelHeight.value) }),
        }),
      ])
    } catch (err) {
      console.error('Error saving layout preferences:', err)
    }
  }

  async function loadLayoutPrefs() {
    try {
      const [sidebarRes, panelRes, heightRes] = await Promise.all([
        fetch('/api/command/setting/sidebar_collapsed', { credentials: 'include' }),
        fetch('/api/command/setting/panel_collapsed', { credentials: 'include' }),
        fetch('/api/command/setting/panel_height', { credentials: 'include' }),
      ])
      const sidebarData = await sidebarRes.json()
      const panelData = await panelRes.json()
      const heightData = await heightRes.json()
      if (sidebarData.value !== null) {
        sidebarCollapsed.value = sidebarData.value === 'true'
      }
      if (panelData.value !== null) {
        panelCollapsed.value = panelData.value === 'true'
      }
      if (heightData.value !== null) {
        panelHeight.value = Math.max(5, parseInt(heightData.value, 10) || 30)
      }
    } catch (err) {
      console.error('Error loading layout preferences:', err)
    }
  }

  return { sidebarCollapsed, panelCollapsed, panelHeight, toggleSidebar, togglePanel, setPanelHeight, setOmnifilter, omnifilter, saveLayoutPrefs, loadLayoutPrefs }
})
