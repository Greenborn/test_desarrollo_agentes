import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { settingSet, settingGet } from '../services/settingService.js'

export const useUiStore = defineStore('ui', () => {
  const sidebarCollapsed = ref(false)
  const sidebarWidth = ref(220)
  const panelCollapsed = ref(false)
  const panelHeight = ref(250)
  const rightPanelCollapsed = ref(true)
  // Defaults globales (settings del usuario) usados cuando la sesión de chat
  // activa todavía no tiene guardado el estado desplegado/colapsado.
  const defaultPanelCollapsed = ref(false)
  const defaultRightPanelCollapsed = ref(true)
  // Sesión cuya configuración de paneles está aplicada actualmente.
  const layoutSessionId = ref(null)
  const rightPanelWidth = ref(220)
  const recordingListWidth = ref(220)
  const centralPanelCollapsed = ref(false)
  const sidebarWidthPct = ref(50)

  const sidebarChatTab = ref('chats')
  const sidebarRightTab = ref('comentarios')
  const devPanelTab = ref('instancias')
  const sidebarChatTabOrder = ref(null)
  const sidebarRightTabOrder = ref(null)
  const devPanelTabOrder = ref(null)
  const ocMaximized = ref(false)
  const projectFilterEnabled = ref(true)

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    saveLayoutPrefs()
  }

  function togglePanel() {
    panelCollapsed.value = !panelCollapsed.value
    persistPanelState('panelCollapsed', panelCollapsed.value)
  }

  function toggleRightPanel() {
    rightPanelCollapsed.value = !rightPanelCollapsed.value
    persistPanelState('rightPanelCollapsed', rightPanelCollapsed.value)
  }

  // El estado desplegado/colapsado del panel inferior y del panel derecho
  // pertenece a la sesión de chat activa (se guarda en sus prefs, persistidas
  // en BD y cacheadas en api_memoria). Sin sesión activa, el valor pasa a ser
  // el default global del usuario.
  async function persistPanelState(key, value) {
    try {
      const { useChatStore } = await import('./chat.js')
      const chat = useChatStore()
      if (chat.activeSessionId) {
        await chat.saveSessionPrefs(chat.activeSessionId, { [key]: value })
        return
      }
      if (key === 'panelCollapsed') defaultPanelCollapsed.value = value
      else defaultRightPanelCollapsed.value = value
      await saveLayoutPrefs()
    } catch (err) {
      console.error('Error al guardar estado de paneles de la sesión:', err)
    }
  }

  function applySessionPanelPrefs(prefs) {
    const p = prefs || {}
    panelCollapsed.value = typeof p.panelCollapsed === 'boolean' ? p.panelCollapsed : defaultPanelCollapsed.value
    rightPanelCollapsed.value = typeof p.rightPanelCollapsed === 'boolean' ? p.rightPanelCollapsed : defaultRightPanelCollapsed.value
  }

  let _layoutToken = 0

  // Restaura la configuración de paneles asociada a una sesión de chat:
  // primero con las prefs que ya están en memoria del front (instantáneo) y
  // luego con las del backend (api_memoria → BD), descartando respuestas
  // obsoletas si se cambió de sesión mientras tanto.
  async function restoreSessionLayout(sessionId) {
    const token = ++_layoutToken
    if (!sessionId) {
      layoutSessionId.value = null
      applySessionPanelPrefs(null)
      return
    }
    try {
      const { useChatStore } = await import('./chat.js')
      const chat = useChatStore()
      if (token !== _layoutToken) return
      layoutSessionId.value = sessionId
      applySessionPanelPrefs(chat.getSessionPrefs(sessionId))
      const prefs = await chat.fetchSessionPrefs(sessionId)
      if (token !== _layoutToken) return
      applySessionPanelPrefs(prefs)
    } catch (err) {
      console.error('Error al restaurar configuración de paneles de la sesión:', err)
    }
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

  async function saveLayoutPrefs() {
    try {
      await Promise.all([
        settingSet('sidebar_collapsed', String(sidebarCollapsed.value)),
        settingSet('sidebar_width', String(sidebarWidth.value)),
        settingSet('panel_collapsed', String(defaultPanelCollapsed.value)),
        settingSet('panel_height', String(panelHeight.value)),
        settingSet('right_panel_collapsed', String(defaultRightPanelCollapsed.value)),
        settingSet('right_panel_width', String(rightPanelWidth.value)),
        settingSet('recording_list_width', String(recordingListWidth.value)),
        settingSet('central_panel_collapsed', String(centralPanelCollapsed.value)),
        settingSet('sidebar_width_pct', String(sidebarWidthPct.value)),
        settingSet('sidebar_chat_tab', sidebarChatTab.value),
        settingSet('sidebar_right_tab', sidebarRightTab.value),
        settingSet('dev_panel_tab', devPanelTab.value),
        settingSet('sidebar_chat_tab_order', JSON.stringify(sidebarChatTabOrder.value)),
        settingSet('sidebar_right_tab_order', JSON.stringify(sidebarRightTabOrder.value)),
        settingSet('dev_panel_tab_order', JSON.stringify(devPanelTabOrder.value)),
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
        defaultPanelCollapsed.value = panelData.value === 'true'
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
        defaultRightPanelCollapsed.value = rightCollapsedData.value === 'true'
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
      const sidebarChatTabOrderData = await settingGet('sidebar_chat_tab_order')
      if (sidebarChatTabOrderData.value !== null) {
        try { sidebarChatTabOrder.value = JSON.parse(sidebarChatTabOrderData.value) } catch (e) { console.error('Error parsing sidebar_chat_tab_order:', e) }
      }
      const sidebarRightTabOrderData = await settingGet('sidebar_right_tab_order')
      if (sidebarRightTabOrderData.value !== null) {
        try { sidebarRightTabOrder.value = JSON.parse(sidebarRightTabOrderData.value) } catch (e) { console.error('Error parsing sidebar_right_tab_order:', e) }
      }
      const devPanelTabOrderData = await settingGet('dev_panel_tab_order')
      if (devPanelTabOrderData.value !== null) {
        try { devPanelTabOrder.value = JSON.parse(devPanelTabOrderData.value) } catch (e) { console.error('Error parsing dev_panel_tab_order:', e) }
      }
      if (ocMaximizedData.value !== null) {
        ocMaximized.value = ocMaximizedData.value === 'true'
      }
      if (projectFilterData.value !== null) {
        projectFilterEnabled.value = projectFilterData.value === 'true'
      }
      // Los defaults globales recién cargados pueden llegar después de haber
      // restaurado la sesión activa: reaplicar para que las claves que la
      // sesión no tiene guardadas usen el default correcto.
      await reapplyPanelState()
    } catch (err) {
      console.error('Error loading layout preferences:', err)
    }
  }

  async function reapplyPanelState() {
    if (!layoutSessionId.value) {
      applySessionPanelPrefs(null)
      return
    }
    try {
      const { useChatStore } = await import('./chat.js')
      const chat = useChatStore()
      applySessionPanelPrefs(chat.getSessionPrefs(layoutSessionId.value))
    } catch (err) {
      console.error('Error al reaplicar estado de paneles:', err)
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
    defaultPanelCollapsed.value = false
    defaultRightPanelCollapsed.value = true
    layoutSessionId.value = null
    rightPanelWidth.value = 220
    recordingListWidth.value = 220
    centralPanelCollapsed.value = false
    sidebarWidthPct.value = 50
    sidebarChatTab.value = 'chats'
    sidebarRightTab.value = 'comentarios'
    devPanelTab.value = 'instancias'
    sidebarChatTabOrder.value = null
    sidebarRightTabOrder.value = null
    devPanelTabOrder.value = null
    ocMaximized.value = false
    projectFilterEnabled.value = true
  }

  return { sidebarCollapsed, sidebarWidth, panelCollapsed, panelHeight, rightPanelCollapsed, defaultPanelCollapsed, defaultRightPanelCollapsed, layoutSessionId, restoreSessionLayout, applySessionPanelPrefs, rightPanelWidth, recordingListWidth, centralPanelCollapsed, sidebarWidthPct, sidebarChatTab, sidebarRightTab, devPanelTab, sidebarChatTabOrder, sidebarRightTabOrder, devPanelTabOrder, ocMaximized, projectFilterEnabled, toggleSidebar, togglePanel, toggleRightPanel, toggleCentralPanel, setPanelHeight, setRightPanelWidth, setSidebarWidthPct, toggleOcMaximized, saveLayoutPrefs, loadLayoutPrefs, reset }
})
