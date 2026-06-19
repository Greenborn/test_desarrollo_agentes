import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarCollapsed = ref(false)
  const sidebarWidth = ref(220)
  const panelCollapsed = ref(false)
  const panelHeight = ref(250)
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
          body: JSON.stringify({ key: 'sidebar_width', value: String(sidebarWidth.value) }),
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
      const [sidebarRes, widthRes, panelRes, heightRes] = await Promise.all([
        fetch('/api/command/setting/sidebar_collapsed', { credentials: 'include' }),
        fetch('/api/command/setting/sidebar_width', { credentials: 'include' }),
        fetch('/api/command/setting/panel_collapsed', { credentials: 'include' }),
        fetch('/api/command/setting/panel_height', { credentials: 'include' }),
      ])
      const sidebarData = await sidebarRes.json()
      const widthData = await widthRes.json()
      const panelData = await panelRes.json()
      const heightData = await heightRes.json()
      if (sidebarData.value !== null) {
        sidebarCollapsed.value = sidebarData.value === 'true'
      }
      if (widthData.value !== null) {
        const raw = parseFloat(widthData.value) || 220
        if (raw <= 95) {
          sidebarWidth.value = Math.max(window.innerWidth * 0.05, (raw / 100) * window.innerWidth)
        } else {
          sidebarWidth.value = Math.max(window.innerWidth * 0.05, Math.min(600, raw))
        }
      }
      if (panelData.value !== null) {
        panelCollapsed.value = panelData.value === 'true'
      }
      if (heightData.value !== null) {
        const raw = parseFloat(heightData.value) || 250
        if (raw <= 95) {
          panelHeight.value = Math.max(60, (raw / 100) * window.innerHeight)
        } else {
          panelHeight.value = Math.max(60, raw)
        }
      }
    } catch (err) {
      console.error('Error loading layout preferences:', err)
    }
  }

  return { sidebarCollapsed, sidebarWidth, panelCollapsed, panelHeight, omnifilter, toggleSidebar, togglePanel, setPanelHeight, setOmnifilter, saveLayoutPrefs, loadLayoutPrefs }
})
