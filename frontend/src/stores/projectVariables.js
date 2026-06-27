import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useProjectVariablesStore = defineStore('projectVariables', () => {
  const variablesByProject = ref({})
  const loadingByProject = ref({})

  async function loadVariables(proyectoId) {
    if (!proyectoId) return
    loadingByProject.value[proyectoId] = true
    try {
      const res = await fetch(`/api/proyecto/${encodeURIComponent(proyectoId)}/variables`, {
        credentials: 'include',
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Error al cargar variables')
      }
      const data = await res.json()
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

  async function saveVariable(proyectoId, key, value) {
    if (!proyectoId) return
    const existing = (variablesByProject.value[proyectoId] || []).find(v => v.key === key)
    const url = existing
      ? `/api/proyecto/${encodeURIComponent(proyectoId)}/variables/${encodeURIComponent(key)}`
      : `/api/proyecto/${encodeURIComponent(proyectoId)}/variables`
    const method = existing ? 'PUT' : 'POST'
    const payload = existing ? { value } : { key, value, type: 'db' }
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Error al guardar variable')
      }
      if (existing) {
        const idx = variablesByProject.value[proyectoId].findIndex(v => v.key === key)
        if (idx !== -1) {
          variablesByProject.value[proyectoId][idx].value = value
        }
      } else {
        variablesByProject.value[proyectoId].push({ key, value, type: 'db' })
      }
    } catch (err) {
      console.error('Error en saveVariable:', err.message)
      throw err
    }
  }

  return { variablesByProject, loadingByProject, loadVariables, clearVariables, saveVariable }
})
