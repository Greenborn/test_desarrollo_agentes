import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const API = '/api'

export const useFileEditorStore = defineStore('fileEditor', () => {
  const content = ref('')
  const originalContent = ref('')
  const loading = ref(false)
  const saving = ref(false)
  const saved = ref(false)
  const error = ref(null)

  const dirty = computed(() => content.value !== originalContent.value)

  async function loadFile(filePath) {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`${API}/command/read-file?path=${encodeURIComponent(filePath)}`, {
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        content.value = data.content
        originalContent.value = data.content
      } else {
        error.value = data.error || 'Error al leer el archivo'
      }
    } catch (err) {
      error.value = err.message || 'Error de conexión'
    } finally {
      loading.value = false
    }
  }

  async function save(filePath) {
    saving.value = true
    saved.value = false
    error.value = null
    try {
      const res = await fetch(`${API}/command/write-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path: filePath, content: content.value }),
      })
      const data = await res.json()
      if (data.success) {
        originalContent.value = content.value
        saved.value = true
        setTimeout(() => { saved.value = false }, 2000)
      } else {
        error.value = data.error || 'Error al guardar el archivo'
      }
    } catch (err) {
      error.value = err.message || 'Error de conexión'
    } finally {
      saving.value = false
    }
  }

  function reset() {
    content.value = ''
    originalContent.value = ''
    loading.value = false
    saving.value = false
    saved.value = false
    error.value = null
  }

  return { content, originalContent, loading, saving, saved, error, dirty, loadFile, save, reset }
})
