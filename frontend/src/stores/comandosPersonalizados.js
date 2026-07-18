import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const API = '/api'

export const useComandosPersonalizadosStore = defineStore('comandosPersonalizados', () => {
  const commandsByProject = ref({})
  const loadingByProject = ref({})

  const getCommandsForProject = computed(() => {
    return (proyectoId) => {
      if (!proyectoId) return []
      return commandsByProject.value[proyectoId] || []
    }
  })

  async function loadCommands(proyectoId) {
    if (!proyectoId) return
    loadingByProject.value[proyectoId] = true
    try {
      const res = await fetch(`${API}/comandos-personalizados/${encodeURIComponent(proyectoId)}`, { credentials: 'include' })
      const data = await res.json()
      if (data.error) {
        console.error('Error al cargar comandos:', data.error)
        return
      }
      commandsByProject.value[proyectoId] = data.comandos || []
    } catch (err) {
      console.error('Error al cargar comandos:', err)
    } finally {
      loadingByProject.value[proyectoId] = false
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
    createCommand,
    updateCommand,
    deleteCommand,
    clearCommands,
    reset,
  }
})
