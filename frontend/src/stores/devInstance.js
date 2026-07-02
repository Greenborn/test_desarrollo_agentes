import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import { useChatStore } from './chat.js'

const API = '/api'
export const useDevInstanceStore = defineStore('devInstance', () => {
  const processes = ref([])
  const frontendPorts = ref([])
  const browserSessions = ref([])
  const resolution = ref(null)
  const logsMap = reactive({})
  const starting = ref(false)
  const deteniendo = ref(false)
  const cerrandoPuertos = ref(false)
  const ultimoResultadoPuertos = ref(null)
  const errorMsg = ref('')

  const hasProcesses = computed(() => processes.value.length > 0)
  const processNames = computed(() => processes.value.map(p => p.name))

  let statusTimer = null
  let logsTimer = null

  async function fetchStatus() {
    try {
      const chatStore = useChatStore()
      const sid = chatStore.activeSessionId
      const url = sid ? `${API}/despliegue/estado-instancia-dev?sessionId=${sid}` : `${API}/despliegue/estado-instancia-dev`
      const res = await fetch(url, { credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        processes.value = data.processes || []
        frontendPorts.value = data.frontendPorts || []
        browserSessions.value = data.browserSessions || []
        resolution.value = data.resolution || null

        const currentNames = new Set(processes.value.map(p => p.name))
        for (const key of Object.keys(logsMap)) {
          if (!currentNames.has(key)) delete logsMap[key]
        }
        errorMsg.value = ''
      }
    } catch (err) {
      console.error('[devInstance] Error al obtener estado:', err)
      errorMsg.value = 'Error al conectar con el servidor.'
    }
  }

  async function fetchLogs() {
    const chatStore = useChatStore()
    const sid = chatStore.activeSessionId
    if (!sid) return
    const names = processNames.value
    for (const name of names) {
      try {
        const res = await fetch(`${API}/despliegue/logs?sessionId=${sid}&name=${encodeURIComponent(name)}`, { credentials: 'include' })
        const data = await res.json()
        if (data.success) {
          logsMap[name] = data.logs || []
        }
      } catch (err) {
        console.error(`[devInstance] Error al obtener logs para ${name}:`, err)
      }
    }
  }

  async function detener() {
    deteniendo.value = true
    try {
      const chatStore = useChatStore()
      const body = chatStore.activeSessionId ? { sessionId: chatStore.activeSessionId } : {}
      await fetch(`${API}/despliegue/detener-instancia-dev`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      processes.value = []
      frontendPorts.value = []
      browserSessions.value = []
      resolution.value = null
      for (const key of Object.keys(logsMap)) delete logsMap[key]
    } catch (err) {
      console.error('[devInstance] Error al detener:', err)
    } finally {
      deteniendo.value = false
    }
  }

  async function cerrarPuertos(portsArray) {
    if (!Array.isArray(portsArray) || portsArray.length === 0) return []
    cerrandoPuertos.value = true
    ultimoResultadoPuertos.value = null
    try {
      const res = await fetch(`${API}/despliegue/cerrar-puertos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ports: portsArray }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchStatus()
        ultimoResultadoPuertos.value = data.results
        return data.results
      }
      throw new Error(data.error || 'Error al cerrar puertos')
    } catch (err) {
      console.error('[devInstance] Error al cerrar puertos:', err)
      throw err
    } finally {
      cerrandoPuertos.value = false
    }
  }

  function startPolling() {
    stopPolling()
    fetchStatus()
    statusTimer = setInterval(fetchStatus, 5000)
    logsTimer = setInterval(fetchLogs, 1500)
  }

  function stopPolling() {
    if (statusTimer) {
      clearInterval(statusTimer)
      statusTimer = null
    }
    if (logsTimer) {
      clearInterval(logsTimer)
      logsTimer = null
    }
  }

  function reset() {
    processes.value = []
    frontendPorts.value = []
    browserSessions.value = []
    resolution.value = null
    for (const key of Object.keys(logsMap)) delete logsMap[key]
    errorMsg.value = ''
    starting.value = false
    deteniendo.value = false
    cerrandoPuertos.value = false
    ultimoResultadoPuertos.value = null
    stopPolling()
  }

  return {
    processes,
    frontendPorts,
    browserSessions,
    resolution,
    logsMap,
    processNames,
    hasProcesses,
    starting,
    deteniendo,
    cerrandoPuertos,
    ultimoResultadoPuertos,
    errorMsg,
    fetchStatus,
    fetchLogs,
    detener,
    cerrarPuertos,
    startPolling,
    stopPolling,
    reset,
  }
})
