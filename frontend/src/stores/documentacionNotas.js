import { defineStore } from 'pinia'
import { ref } from 'vue'

const API_BASE = '/api/documentacion'

export const useDocumentacionNotasStore = defineStore('documentacionNotas', () => {
  const notasByProject = ref({})
  const loadingByProject = ref({})
  const currentClave = ref(null)
  const currentValor = ref('')

  function _ensureArray(proyectoId) {
    if (!notasByProject.value[proyectoId]) {
      notasByProject.value[proyectoId] = []
    }
    return notasByProject.value[proyectoId]
  }

  async function loadNotas(proyectoId) {
    if (!proyectoId) return
    loadingByProject.value[proyectoId] = true
    try {
      const res = await fetch(`${API_BASE}/notas/${encodeURIComponent(proyectoId)}`, { credentials: 'include' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al cargar notas')
      }
      const data = await res.json()
      notasByProject.value[proyectoId] = data || []
    } catch (err) {
      console.error('Error al cargar notas:', err)
      notasByProject.value[proyectoId] = []
    } finally {
      loadingByProject.value[proyectoId] = false
    }
  }

  async function getNota(proyectoId, clave) {
    if (!proyectoId || !clave) return null
    try {
      const res = await fetch(`${API_BASE}/notas/${encodeURIComponent(proyectoId)}/${encodeURIComponent(clave)}`, { credentials: 'include' })
      if (!res.ok) {
        if (res.status === 404) return null
        const err = await res.json()
        throw new Error(err.error || 'Error al obtener nota')
      }
      return await res.json()
    } catch (err) {
      console.error('Error al obtener nota:', err)
      return null
    }
  }

  async function createNota(payload) {
    const res = await fetch(`${API_BASE}/notas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error al crear nota')
    if (payload.id_proyecto) await loadNotas(payload.id_proyecto)
    return data
  }

  async function updateNota(id, payload, proyectoId) {
    const res = await fetch(`${API_BASE}/notas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error al actualizar nota')
    if (proyectoId) await loadNotas(proyectoId)
    return data
  }

  async function deleteNota(id, proyectoId) {
    const res = await fetch(`${API_BASE}/notas/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Error al eliminar nota')
    }
    if (proyectoId) await loadNotas(proyectoId)
  }

  function clearNotas(proyectoId) {
    if (proyectoId) {
      delete notasByProject.value[proyectoId]
      delete loadingByProject.value[proyectoId]
    } else {
      notasByProject.value = {}
      loadingByProject.value = {}
    }
    currentClave.value = null
    currentValor.value = ''
  }

  function reset() {
    notasByProject.value = {}
    loadingByProject.value = {}
    currentClave.value = null
    currentValor.value = ''
  }

  return {
    notasByProject,
    loadingByProject,
    currentClave,
    currentValor,
    loadNotas,
    getNota,
    createNota,
    updateNota,
    deleteNota,
    clearNotas,
    reset,
  }
})
