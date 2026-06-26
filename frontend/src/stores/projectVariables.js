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

  return { variablesByProject, loadingByProject, loadVariables, clearVariables }
})
