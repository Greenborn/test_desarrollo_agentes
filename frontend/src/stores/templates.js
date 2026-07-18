import { defineStore } from 'pinia'
import { ref } from 'vue'

const API = '/api'

export const useTemplatesStore = defineStore('templates', () => {
  const list = ref([])
  const current = ref(null)
  const loading = ref(false)
  const error = ref('')

  async function fetchAll() {
    loading.value = true
    error.value = ''
    try {
      const res = await fetch(`${API}/templates`, { credentials: 'include' })
      list.value = await res.json()
    } catch (err) {
      console.error('Error al cargar plantillas:', err)
      error.value = 'Error de conexión'
    } finally {
      loading.value = false
    }
  }

  async function fetchBySlug(slug) {
    loading.value = true
    error.value = ''
    try {
      const res = await fetch(`${API}/templates/${encodeURIComponent(slug)}`, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al obtener plantilla')
      }
      current.value = await res.json()
      return current.value
    } catch (err) {
      console.error('Error al obtener plantilla:', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function create(slug, content) {
    loading.value = true
    error.value = ''
    try {
      const res = await fetch(`${API}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug, content }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Error al crear plantilla')
      await fetchAll()
      return data
    } catch (err) {
      console.error('Error al crear plantilla:', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function update(slug, data) {
    loading.value = true
    error.value = ''
    try {
      const res = await fetch(`${API}/templates/${encodeURIComponent(slug)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error || 'Error al actualizar plantilla')
      await fetchAll()
      return result
    } catch (err) {
      console.error('Error al actualizar plantilla:', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function remove(slug) {
    loading.value = true
    error.value = ''
    try {
      const res = await fetch(`${API}/templates/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Error al eliminar plantilla')
      await fetchAll()
      return data
    } catch (err) {
      console.error('Error al eliminar plantilla:', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  function clearError() {
    error.value = ''
  }

  function reset() {
    list.value = []
    current.value = null
    loading.value = false
    error.value = ''
  }

  return { list, current, loading, error, fetchAll, fetchBySlug, create, update, remove, clearError, reset }
})
