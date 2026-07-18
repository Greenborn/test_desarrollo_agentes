import { defineStore } from 'pinia'
import { ref } from 'vue'

const API = '/api'

export const useEnvironmentsStore = defineStore('environments', () => {
  const list = ref([])
  const loading = ref(false)
  const message = ref('')

  async function load(workspaceId) {
    loading.value = true
    try {
      let url = `${API}/environments`
      if (workspaceId) url += `?workspace_id=${workspaceId}`
      const res = await fetch(url, { credentials: 'include' })
      const data = await res.json()
      list.value = data.environments || []
    } catch (err) {
      console.error('Error al cargar ambientes:', err.message)
    } finally {
      loading.value = false
    }
  }

  async function save(index, workspaceId) {
    const env = list.value[index]
    if (!env.name || !env.branch) {
      message.value = 'Nombre y rama son requeridos'
      setTimeout(() => { message.value = '' }, 3000)
      return
    }
    try {
      const payload = { name: env.name, branch: env.branch, description: env.description }
      if (workspaceId) payload.workspace_id = workspaceId
      const res = await fetch(`${API}/environments/${env.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      message.value = data.success ? 'Ambiente actualizado.' : (data.error || 'Error al actualizar ambiente')
    } catch (err) {
      console.error('Error al guardar ambiente:', err.message)
      message.value = 'Error al guardar ambiente'
    }
    setTimeout(() => { message.value = '' }, 3000)
  }

  async function add({ name, branch, description, workspaceId }) {
    if (!name || !branch) {
      message.value = 'Nombre y rama son requeridos'
      setTimeout(() => { message.value = '' }, 3000)
      return
    }
    try {
      const payload = { name, branch, description: description || null }
      if (workspaceId) payload.workspace_id = workspaceId
      const res = await fetch(`${API}/environments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        list.value.push(data.environment)
        message.value = 'Ambiente creado.'
      } else {
        message.value = data.error || 'Error al crear ambiente'
      }
    } catch (err) {
      console.error('Error al crear ambiente:', err.message)
      message.value = 'Error al crear ambiente'
    }
    setTimeout(() => { message.value = '' }, 3000)
  }

  async function remove(index) {
    const env = list.value[index]
    if (!env.id) return
    try {
      const res = await fetch(`${API}/environments/${env.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        list.value.splice(index, 1)
        message.value = 'Ambiente eliminado.'
      } else {
        message.value = data.error || 'Error al eliminar ambiente'
      }
    } catch (err) {
      console.error('Error al eliminar ambiente:', err.message)
      message.value = 'Error al eliminar ambiente'
    }
    setTimeout(() => { message.value = '' }, 3000)
  }

  function clearMessage() {
    message.value = ''
  }

  function reset() {
    list.value = []
    loading.value = false
    message.value = ''
  }

  return { list, loading, message, load, save, add, remove, clearMessage, reset }
})
