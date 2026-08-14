import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
  import wsClient from '../services/wsClient'

const API = '/api'
const COMANDOS_NS = 'comandos_cache'

export const useComandosPersonalizadosStore = defineStore('comandosPersonalizados', () => {
  const commandsByProject = ref({})
  const loadingByProject = ref({})

  async function invalidateCache(proyectoId) {
    if (!proyectoId) return
    try {
      await wsClient.send('memoria:del', { namespace: COMANDOS_NS, key: String(proyectoId) })
    } catch (err) {
      console.log('[comandos] Error al invalidar caché de memoria:', err.message)
    }
  }

  async function persistCache(proyectoId, comandos) {
    try {
      await wsClient.send('memoria:set', { namespace: COMANDOS_NS, key: String(proyectoId), value: comandos })
    } catch (err) {
      console.log('[comandos] Error al guardar caché de memoria:', err.message)
    }
  }

  const getCommandsForProject = computed(() => {
    return (proyectoId) => {
      if (!proyectoId) return []
      return commandsByProject.value[proyectoId] || []
    }
  })

  async function loadCommands(proyectoId, { force = false } = {}) {
    if (!proyectoId) return
    const key = String(proyectoId)
    loadingByProject.value[key] = true
    try {
      if (!force) {
        try {
          const mem = await wsClient.send('memoria:get', { namespace: COMANDOS_NS, key })
          if (mem.value) {
            commandsByProject.value[key] = mem.value
            return
          }
        } catch (err) {
          console.log('[comandos] Caché de memoria no disponible, consultando backend:', err.message)
        }
      }
      const res = await fetch(`${API}/comandos-personalizados/${encodeURIComponent(proyectoId)}`, { credentials: 'include' })
      const data = await res.json()
      if (data.error) {
        console.error('Error al cargar comandos:', data.error)
        return
      }
      const comandos = data.comandos || []
      commandsByProject.value[key] = comandos
      await persistCache(proyectoId, comandos)
    } catch (err) {
      console.error('Error al cargar comandos:', err)
    } finally {
      loadingByProject.value[key] = false
    }
  }

  async function createCommand(payload) {
    const res = await fetch(`${API}/comandos-personalizados`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    if (payload.id_proyecto) {
      await invalidateCache(payload.id_proyecto)
      await loadCommands(payload.id_proyecto)
    }
    return data.comando
  }

  async function updateCommand(id, payload) {
    const res = await fetch(`${API}/comandos-personalizados/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    if (data.comando?.id_proyecto) {
      await invalidateCache(data.comando.id_proyecto)
      await loadCommands(data.comando.id_proyecto)
    }
    return data.comando
  }

  async function deleteCommand(id, proyectoId) {
    const res = await fetch(`${API}/comandos-personalizados/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    if (proyectoId) {
      await invalidateCache(proyectoId)
      await loadCommands(proyectoId)
    }
  }

  function clearCommands() {
    commandsByProject.value = {}
    loadingByProject.value = {}
  }

  function reset() {
    commandsByProject.value = {}
    loadingByProject.value = {}
  }

  return {
    commandsByProject,
    loadingByProject,
    getCommandsForProject,
    loadCommands,
    invalidateCache,
    createCommand,
    updateCommand,
    deleteCommand,
    clearCommands,
    reset,
  }
})
