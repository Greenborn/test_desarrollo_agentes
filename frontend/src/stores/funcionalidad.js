import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

const API = '/api'

export const useFuncionalidadStore = defineStore('funcionalidad', () => {
  const nombre = ref('')
  const urlRedmine = ref('')
  const formData = reactive({
    relevamiento: '',
    diseno: '',
    implementacion: '',
    testing: '',
    documentacion: '',
  })
  const activeTab = ref('relevamiento')
  const saving = ref(false)

  async function load(sessionId) {
    try {
      const res = await fetch(`${API}/funcionalidad/${sessionId}`, { credentials: 'include' })
      const data = await res.json()
      if (data.funcionalidad) {
        nombre.value = data.funcionalidad.nombre || ''
        urlRedmine.value = data.funcionalidad.url_redmine || ''
        if (data.funcionalidad.parametros) {
          const p = data.funcionalidad.parametros
          if (p.relevamiento) formData.relevamiento = p.relevamiento
          if (p.diseno) formData.diseno = p.diseno
          if (p.implementacion) formData.implementacion = p.implementacion
          if (p.testing) formData.testing = p.testing
          if (p.documentacion) formData.documentacion = p.documentacion
        }
        if (data.funcionalidad.etapa) {
          activeTab.value = data.funcionalidad.etapa.toLowerCase()
        }
      }
    } catch (err) {
      console.error('Error al cargar funcionalidad:', err.message)
    }
  }

  async function save({ sessionId, proyectoId }) {
    saving.value = true
    try {
      const res = await fetch(`${API}/funcionalidad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sessionId,
          proyectoId,
          etapa: activeTab.value.toUpperCase(),
          parametros: { ...formData },
          nombre: nombre.value,
          url_redmine: urlRedmine.value || null,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        console.error('Error al guardar:', data.error)
      }
      return data
    } catch (err) {
      console.error('Error al guardar funcionalidad:', err.message)
      throw err
    } finally {
      saving.value = false
    }
  }

  function reset() {
    nombre.value = ''
    urlRedmine.value = ''
    formData.relevamiento = ''
    formData.diseno = ''
    formData.implementacion = ''
    formData.testing = ''
    formData.documentacion = ''
    activeTab.value = 'relevamiento'
    saving.value = false
  }

  return { nombre, urlRedmine, formData, activeTab, saving, load, save, reset }
})
