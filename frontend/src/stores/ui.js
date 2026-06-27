import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarCollapsed = ref(false)
  const sidebarWidth = ref(220)
  const panelCollapsed = ref(false)
  const panelHeight = ref(250)
  const omnifilter = ref('')
  const rightPanelCollapsed = ref(true)
  const rightPanelWidth = ref(220)
  const recordingListWidth = ref(220)

  const sidebarChatTab = ref('chats')
  const sidebarRightTab = ref('comentarios')
  const devPanelTab = ref('instancias')

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    saveLayoutPrefs()
  }

  function togglePanel() {
    panelCollapsed.value = !panelCollapsed.value
    saveLayoutPrefs()
  }

  function toggleRightPanel() {
    rightPanelCollapsed.value = !rightPanelCollapsed.value
    saveLayoutPrefs()
  }

  function setRightPanelWidth(w) {
    rightPanelWidth.value = w
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
        fetch('/api/command/setting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key: 'right_panel_collapsed', value: String(rightPanelCollapsed.value) }),
        }),
        fetch('/api/command/setting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key: 'right_panel_width', value: String(rightPanelWidth.value) }),
        }),
        fetch('/api/command/setting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key: 'recording_list_width', value: String(recordingListWidth.value) }),
        }),
        fetch('/api/command/setting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key: 'sidebar_chat_tab', value: sidebarChatTab.value }),
        }),
        fetch('/api/command/setting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key: 'sidebar_right_tab', value: sidebarRightTab.value }),
        }),
        fetch('/api/command/setting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key: 'dev_panel_tab', value: devPanelTab.value }),
        }),
      ])
    } catch (err) {
      console.error('Error saving layout preferences:', err)
    }
  }

  async function loadLayoutPrefs() {
    try {
      const [sidebarRes, widthRes, panelRes, heightRes, rightCollapsedRes, rightWidthRes, recordingListRes, sidebarChatTabRes, sidebarRightTabRes, devPanelTabRes] = await Promise.all([
        fetch('/api/command/setting/sidebar_collapsed', { credentials: 'include' }),
        fetch('/api/command/setting/sidebar_width', { credentials: 'include' }),
        fetch('/api/command/setting/panel_collapsed', { credentials: 'include' }),
        fetch('/api/command/setting/panel_height', { credentials: 'include' }),
        fetch('/api/command/setting/right_panel_collapsed', { credentials: 'include' }),
        fetch('/api/command/setting/right_panel_width', { credentials: 'include' }),
        fetch('/api/command/setting/recording_list_width', { credentials: 'include' }),
        fetch('/api/command/setting/sidebar_chat_tab', { credentials: 'include' }),
        fetch('/api/command/setting/sidebar_right_tab', { credentials: 'include' }),
        fetch('/api/command/setting/dev_panel_tab', { credentials: 'include' }),
      ])
      const sidebarData = await sidebarRes.json()
      const widthData = await widthRes.json()
      const panelData = await panelRes.json()
      const heightData = await heightRes.json()
      const rightCollapsedData = await rightCollapsedRes.json()
      const rightWidthData = await rightWidthRes.json()
      const recordingListData = await recordingListRes.json()
      const sidebarChatTabData = await sidebarChatTabRes.json()
      const sidebarRightTabData = await sidebarRightTabRes.json()
      const devPanelTabData = await devPanelTabRes.json()
      if (sidebarData.value !== null) {
        sidebarCollapsed.value = sidebarData.value === 'true'
      }
      if (widthData.value !== null) {
        const raw = parseFloat(widthData.value) || 220
        if (raw <= 95) {
          sidebarWidth.value = Math.max(window.innerWidth * 0.05, (raw / 100) * window.innerWidth)
        } else {
          sidebarWidth.value = Math.max(window.innerWidth * 0.05, raw)
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
      if (rightCollapsedData.value !== null) {
        rightPanelCollapsed.value = rightCollapsedData.value === 'true'
      }
      if (rightWidthData.value !== null) {
        const raw = parseFloat(rightWidthData.value) || 220
        if (raw <= 95) {
          rightPanelWidth.value = Math.max(window.innerWidth * 0.05, (raw / 100) * window.innerWidth)
        } else {
          rightPanelWidth.value = Math.max(window.innerWidth * 0.05, raw)
        }
      }
      if (recordingListData.value !== null) {
        const raw = parseFloat(recordingListData.value) || 220
        if (raw <= 95) {
          recordingListWidth.value = Math.max(140, (raw / 100) * window.innerWidth)
        } else {
          recordingListWidth.value = Math.max(140, Math.min(400, raw))
        }
      }
      if (sidebarChatTabData.value !== null) {
        sidebarChatTab.value = sidebarChatTabData.value
      }
      if (sidebarRightTabData.value !== null) {
        sidebarRightTab.value = sidebarRightTabData.value
      }
      if (devPanelTabData.value !== null) {
        devPanelTab.value = devPanelTabData.value
      }
    } catch (err) {
      console.error('Error loading layout preferences:', err)
    }
  }

  return { sidebarCollapsed, sidebarWidth, panelCollapsed, panelHeight, omnifilter, rightPanelCollapsed, rightPanelWidth, recordingListWidth, sidebarChatTab, sidebarRightTab, devPanelTab, toggleSidebar, togglePanel, toggleRightPanel, setPanelHeight, setRightPanelWidth, setOmnifilter, saveLayoutPrefs, loadLayoutPrefs }
})
