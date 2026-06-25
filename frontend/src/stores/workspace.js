import { defineStore } from 'pinia'
import { ref } from 'vue'

const API = '/api'

export const useWorkspaceStore = defineStore('workspace', () => {
  const workspaces = ref([])
  const selectedIds = ref([1])
  const loading = ref(false)

  async function loadWorkspaces() {
    try {
      const res = await fetch(`${API}/workspaces`, { credentials: 'include' })
      const data = await res.json()
      if (data.workspaces) {
        workspaces.value = data.workspaces
      }
    } catch (err) {
      console.error('Error al cargar workspaces:', err)
    }
  }

  async function selectWorkspaces(ids) {
    try {
      loading.value = true
      const res = await fetch(`${API}/workspaces/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ workspaceIds: ids }),
      })
      const data = await res.json()
      if (data.success) {
        selectedIds.value = data.workspaceIds
      }
      return data
    } catch (err) {
      console.error('Error al seleccionar workspaces:', err)
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  function getPrimaryWorkspaceId() {
    return selectedIds.value[0] || 1
  }

  async function createWorkspace(name) {
    try {
      const res = await fetch(`${API}/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (data.success) {
        workspaces.value.push(data.workspace)
      }
      return data
    } catch (err) {
      console.error('Error al crear workspace:', err)
      return { success: false, error: err.message }
    }
  }

  async function updateWorkspace(id, name) {
    try {
      const res = await fetch(`${API}/workspaces/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (data.success) {
        const ws = workspaces.value.find(w => w.id === id)
        if (ws) ws.name = name
      }
      return data
    } catch (err) {
      console.error('Error al actualizar workspace:', err)
      return { success: false, error: err.message }
    }
  }

  async function deleteWorkspace(id) {
    try {
      const res = await fetch(`${API}/workspaces/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      return await res.json()
    } catch (err) {
      console.error('Error al eliminar workspace:', err)
      return { success: false, error: err.message }
    }
  }

  async function stopAllProcesses() {
    try {
      const res = await fetch(`${API}/workspaces/stop-all`, {
        method: 'POST',
        credentials: 'include',
      })
      return await res.json()
    } catch (err) {
      console.error('Error al detener procesos:', err)
      return { success: false, error: err.message }
    }
  }

  return {
    workspaces, selectedIds, loading,
    loadWorkspaces, selectWorkspaces, getPrimaryWorkspaceId, createWorkspace,
    updateWorkspace, deleteWorkspace, stopAllProcesses,
  }
})
