import { defineStore } from 'pinia'
import { ref } from 'vue'

const API = '/api'

export const useSettingsStore = defineStore('settings', () => {
  const deepseekKey = ref('')
  const systemPrompt = ref('')
  const saveError = ref('')
  const saveSuccess = ref('')

  async function load() {
    try {
      const res = await fetch(`${API}/settings`, { credentials: 'include' })
      const keys = await res.json()
      deepseekKey.value = keys.deepseek_key || ''
      systemPrompt.value = keys.system_prompt || ''
    } catch (err) {
      console.error('Error al cargar settings:', err)
    }
  }

  async function save(key, value) {
    clearFeedback()
    try {
      const res = await fetch(`${API}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key, value }),
      })
      const data = await res.json()
      if (data.success) {
        saveSuccess.value = 'Guardado correctamente'
      } else {
        saveError.value = data.error || 'Error al guardar'
      }
      await load()
    } catch (err) {
      saveError.value = 'Error de conexión'
    }
  }

  function clearFeedback() {
    saveSuccess.value = ''
    saveError.value = ''
  }

  return { deepseekKey, systemPrompt, saveError, saveSuccess, clearFeedback, load, save }
})
