import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'

const API = '/api'

export const useDevInstanceStore = defineStore('devInstance', () => {
  const state = reactive({
    processes: [],
    frontendPorts: [],
    browserSessions: [],
    resolution: null,
  })
  const logsMap = reactive({})
  const starting = ref(false)
  const deteniendo = ref(false)
  const errorMsg = ref('')

  const processNames = computed(() => state.processes.map(p => p.name))
  const hasProcesses = computed(() => state.processes.length > 0)

  let statusTimer = null
  let logsTimer = null

  async function fetchStatus() {
    try {
      const res = await fetch(`${API}/despliegue/estado-instancia-dev`, { credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        state.processes = data.processes || []
        state.frontendPorts = data.frontendPorts || []
        state.browserSessions = data.browserSessions || []
        state.resolution = data.resolution || null
        errorMsg.value = ''

        const currentNames = new Set(processNames.value)
        for (const key of Object.keys(logsMap)) {
          if (!currentNames.has(key)) delete logsMap[key]
        }
      }
    } catch (err) {
      console.error('Error al obtener estado de dev instance:', err)
      errorMsg.value = 'Error al conectar con el servidor.'
    }
  }

  async function fetchLogs() {
    const names = processNames.value
    for (const name of names) {
      try {
        const res = await fetch(`${API}/despliegue/logs?name=${encodeURIComponent(name)}`, { credentials: 'include' })
        const data = await res.json()
        if (data.success) {
          logsMap[name] = data.logs || []
        }
      } catch (err) {
        console.error(`Error al obtener logs para ${name}:`, err)
      }
    }
  }

  async function detener() {
    deteniendo.value = true
    try {
      await fetch(`${API}/despliegue/detener-instancia-dev`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      })
      state.processes = []
      state.frontendPorts = []
      state.browserSessions = []
      state.resolution = null
      for (const key of Object.keys(logsMap)) delete logsMap[key]
    } catch (err) {
      console.error('Error al detener instancia:', err)
    } finally {
      deteniendo.value = false
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
    state.processes = []
    state.frontendPorts = []
    state.browserSessions = []
    state.resolution = null
    for (const key of Object.keys(logsMap)) delete logsMap[key]
    errorMsg.value = ''
    starting.value = false
    deteniendo.value = false
    stopPolling()
  }

  return { state, logsMap, processNames, hasProcesses, starting, deteniendo, errorMsg, fetchStatus, fetchLogs, detener, startPolling, stopPolling, reset }
})
