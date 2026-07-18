import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { settingSet, settingGet } from '../services/settingService.js'

export const useUiStore = defineStore('ui', () => {
  const sidebarCollapsed = ref(false)
  const sidebarWidth = ref(220)
  const panelCollapsed = ref(false)
  const panelHeight = ref(250)
  const omnifilter = ref('')
  const rightPanelCollapsed = ref(true)
  const rightPanelWidth = ref(220)
  const recordingListWidth = ref(220)
  const centralPanelCollapsed = ref(false)
  const sidebarWidthPct = ref(50)

  const sidebarChatTab = ref('chats')
  const sidebarRightTab = ref('comentarios')
  const devPanelTab = ref('instancias')
  const ocMaximized = ref(false)
  const projectFilterEnabled = ref(true)

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

  function toggleCentralPanel() {
    console.log('[toggleCentralPanel] antes:', centralPanelCollapsed.value)
    centralPanelCollapsed.value = !centralPanelCollapsed.value
    console.log('[toggleCentralPanel] despues:', centralPanelCollapsed.value)
    saveLayoutPrefs()
  }

  function setRightPanelWidth(w) {
    rightPanelWidth.value = w
  }

  function setSidebarWidthPct(val) {
    sidebarWidthPct.value = Math.max(5, Math.min(95, val))
  }

  function setPanelHeight(h) {
    panelHeight.value = h
  }

  function toggleOcMaximized() {
    ocMaximized.value = !ocMaximized.value
    saveLayoutPrefs()
  }

  function setOmnifilter(text) {
    omnifilter.value = text
  }

  async function saveLayoutPrefs() {
    try {
      await Promise.all([
        settingSet('sidebar_collapsed', String(sidebarCollapsed.value)),
        settingSet('sidebar_width', String(sidebarWidth.value)),
        settingSet('panel_collapsed', String(panelCollapsed.value)),
        settingSet('panel_height', String(panelHeight.value)),
        settingSet('right_panel_collapsed', String(rightPanelCollapsed.value)),
        settingSet('right_panel_width', String(rightPanelWidth.value)),
        settingSet('recording_list_width', String(recordingListWidth.value)),
        settingSet('central_panel_collapsed', String(centralPanelCollapsed.value)),
        settingSet('sidebar_width_pct', String(sidebarWidthPct.value)),
        settingSet('sidebar_chat_tab', sidebarChatTab.value),
        settingSet('sidebar_right_tab', sidebarRightTab.value),
        settingSet('dev_panel_tab', devPanelTab.value),
        settingSet('oc_maximized', String(ocMaximized.value)),
        settingSet('project_filter_enabled', String(projectFilterEnabled.value)),
      ])
    } catch (err) {
      console.error('Error saving layout preferences:', err)
    }
  }

  async function loadLayoutPrefs() {
    try {
      const [sidebarData, widthData, panelData, heightData, rightCollapsedData, rightWidthData, recordingListData, centralPanelData, sidebarWidthPctData, sidebarChatTabData, sidebarRightTabData, devPanelTabData, ocMaximizedData, projectFilterData] = await Promise.all([
        settingGet('sidebar_collapsed'),
        settingGet('sidebar_width'),
        settingGet('panel_collapsed'),
        settingGet('panel_height'),
        settingGet('right_panel_collapsed'),
        settingGet('right_panel_width'),
        settingGet('recording_list_width'),
        settingGet('central_panel_collapsed'),
        settingGet('sidebar_width_pct'),
        settingGet('sidebar_chat_tab'),
        settingGet('sidebar_right_tab'),
        settingGet('dev_panel_tab'),
        settingGet('oc_maximized'),
        settingGet('project_filter_enabled'),
      ])
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
      if (centralPanelData.value !== null) {
        centralPanelCollapsed.value = centralPanelData.value === 'true'
      }
      if (sidebarWidthPctData.value !== null) {
        const raw = parseFloat(sidebarWidthPctData.value) || 50
        sidebarWidthPct.value = Math.max(5, Math.min(95, raw))
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
      if (ocMaximizedData.value !== null) {
        ocMaximized.value = ocMaximizedData.value === 'true'
      }
      if (projectFilterData.value !== null) {
        projectFilterEnabled.value = projectFilterData.value === 'true'
      }
    } catch (err) {
      console.error('Error loading layout preferences:', err)
    }
  }

  watch(projectFilterEnabled, () => {
    saveLayoutPrefs()
  })

  function reset() {
    sidebarCollapsed.value = false
    sidebarWidth.value = 220
    panelCollapsed.value = false
    panelHeight.value = 250
    rightPanelCollapsed.value = true
    rightPanelWidth.value = 220
    recordingListWidth.value = 220
    centralPanelCollapsed.value = false
    sidebarWidthPct.value = 50
    omnifilter.value = ''
    sidebarChatTab.value = 'chats'
    sidebarRightTab.value = 'comentarios'
    devPanelTab.value = 'instancias'
    ocMaximized.value = false
    projectFilterEnabled.value = true
  }

  return { sidebarCollapsed, sidebarWidth, panelCollapsed, panelHeight, omnifilter, rightPanelCollapsed, rightPanelWidth, recordingListWidth, centralPanelCollapsed, sidebarWidthPct, sidebarChatTab, sidebarRightTab, devPanelTab, ocMaximized, projectFilterEnabled, toggleSidebar, togglePanel, toggleRightPanel, toggleCentralPanel, setPanelHeight, setRightPanelWidth, setSidebarWidthPct, setOmnifilter, toggleOcMaximized, saveLayoutPrefs, loadLayoutPrefs, reset }
})
