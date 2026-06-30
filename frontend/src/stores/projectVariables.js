import { defineStore } from 'pinia'
import { ref } from 'vue'
import wsClient from '../services/wsClient.js'
import { useAuthStore } from './auth.js'

export const useProjectVariablesStore = defineStore('projectVariables', () => {
  const variablesByProject = ref({})
  const loadingByProject = ref({})

  async function loadVariables(proyectoId) {
    if (!proyectoId) return
    loadingByProject.value[proyectoId] = true
    try {
      const auth = useAuthStore()
      const data = await wsClient.send('proyectoVarListar', {
        sessionToken: auth.getSessionToken(),
        proyectoId,
      })
      variablesByProject.value[proyectoId] = data.variables || []
    } catch (err) {
      console.error('Error en loadVariables:', err.message)
      variablesByProject.value[proyectoId] = []
    } finally {
      loadingByProject.value[proyectoId] = false
    }
  }

  function clearVariables(proyectoId) {
    if (proyectoId) {
      delete variablesByProject.value[proyectoId]
      delete loadingByProject.value[proyectoId]
    } else {
      variablesByProject.value = {}
      loadingByProject.value = {}
    }
  }

  async function saveVariable(proyectoId, key, value, type) {
    if (!proyectoId) return
    const auth = useAuthStore()
    const existing = (variablesByProject.value[proyectoId] || []).find(v => v.key === key)
    try {
      if (existing) {
        const data = await wsClient.send('proyectoVarActualizar', {
          sessionToken: auth.getSessionToken(),
          proyectoId,
          key,
          value,
          type: type || undefined,
        })
        if (!data.success) throw new Error(data.error || 'Error al actualizar variable')
        const idx = variablesByProject.value[proyectoId].findIndex(v => v.key === key)
        if (idx !== -1) {
          variablesByProject.value[proyectoId][idx].value = value
          if (type) variablesByProject.value[proyectoId][idx].type = type
        }
      } else {
        const data = await wsClient.send('proyectoVarCrear', {
          sessionToken: auth.getSessionToken(),
          proyectoId,
          key,
          value,
          type: type || 'db',
        })
        if (!data.success) throw new Error(data.error || 'Error al crear variable')
        variablesByProject.value[proyectoId].push({ key, value, type: type || 'db' })
      }
    } catch (err) {
      console.error('Error en saveVariable:', err.message)
      throw err
    }
  }

  return { variablesByProject, loadingByProject, loadVariables, clearVariables, saveVariable }
})
