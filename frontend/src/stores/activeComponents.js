import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useChatStore } from './chat.js'
import { useModuleRegistry } from '../composables/useModuleRegistry.js'

export const useActiveComponentsStore = defineStore('activeComponents', () => {
  const chat = useChatStore()
  const { sidebarRightTabs, devPanelTabs } = useModuleRegistry()

  const key = (panel, tabId) => `${panel}:${tabId}`
  const activeConfig = ref({})
  const loadedSessionId = ref(null)

  const allTabs = computed(() => [
    ...devPanelTabs.map(t => ({ panel: 'devPanel', tab: t })),
    ...sidebarRightTabs.map(t => ({ panel: 'sidebarRight', tab: t })),
  ])

  function defaultConfig() {
    const cfg = {}
    for (const { panel, tab } of allTabs.value) {
      cfg[key(panel, tab.id)] = true
    }
    return cfg
  }

  function isActive(panel, tabId) {
    if (activeConfig.value[key(panel, tabId)] === undefined) return true
    return activeConfig.value[key(panel, tabId)]
  }

  function loadForSession(sessionId) {
    if (!sessionId) {
      activeConfig.value = {}
      loadedSessionId.value = null
      return
    }
    const prefs = chat.getSessionPrefs(sessionId)
    const stored = prefs.activeComponents || {}
    activeConfig.value = { ...defaultConfig(), ...stored }
    loadedSessionId.value = sessionId
  }

  async function applyToAll() {
    const cfg = { ...activeConfig.value }
    const all = [...chat.sessions, ...chat.archivedSessions]
    for (const session of all) {
      try {
        await chat.saveSessionPref(session.id, 'activeComponents', cfg)
      } catch (err) {
        console.error('[activeComponents] Error al aplicar configuración a todas las sesiones:', err)
      }
    }
  }

  async function toggle(panel, tabId, value) {
    const sessionId = chat.activeSessionId
    if (!sessionId) return
    const cfg = { ...activeConfig.value }
    cfg[key(panel, tabId)] = value
    activeConfig.value = cfg
    try {
      await chat.saveSessionPref(sessionId, 'activeComponents', cfg)
    } catch (err) {
      console.error('[activeComponents] Error al guardar configuración:', err)
    }
  }

  watch(() => chat.activeSessionId, (id) => {
    loadForSession(id)
  })

  return { allTabs, isActive, toggle, loadForSession, applyToAll, activeConfig }
})
