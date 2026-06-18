import { defineStore } from 'pinia'
import { ref } from 'vue'

const API = '/api'

export const useSettingsStore = defineStore('settings', () => {
  const deepseekKey = ref('')
  const redmineToken = ref('')
  const redmineUrl = ref('')
  const systemPrompt = ref('')
  const documentacionPromptBaseDatos = ref('')
  const documentacionPromptSubproyectos = ref('')
  const documentacionPromptEndpoints = ref('')
  const documentacionPromptWebSockets = ref('')
  const documentacionPromptFuncionalidades = ref('')
  const ticketDescripcionPrompt = ref('')
  const ticketRefinarPrompt = ref('')
  const omnifilterDebounceMs = ref(2000)
  const repoAcronimo = ref('TKT')
  const saveError = ref('')
  const saveSuccess = ref('')

  async function load() {
    try {
      const res = await fetch(`${API}/settings`, { credentials: 'include' })
      const keys = await res.json()
      deepseekKey.value = keys.deepseek_key ? keys.deepseek_key : ''
      redmineToken.value = keys.redmine_token ? keys.redmine_token : ''
      redmineUrl.value = keys.redmine_url ? keys.redmine_url : ''
      systemPrompt.value = keys.system_prompt ? keys.system_prompt : ''
      documentacionPromptBaseDatos.value = keys.documentacion_prompt_base_datos || ''
      documentacionPromptSubproyectos.value = keys.documentacion_prompt_subproyectos || ''
      documentacionPromptEndpoints.value = keys.documentacion_prompt_endpoints || ''
      documentacionPromptWebSockets.value = keys.documentacion_prompt_web_sockets || ''
      documentacionPromptFuncionalidades.value = keys.documentacion_prompt_funcionalidades || ''
      ticketDescripcionPrompt.value = keys.ticket_descripcion_prompt || ''
      ticketRefinarPrompt.value = keys.ticket_refinar_prompt || ''
      omnifilterDebounceMs.value = keys.omnifilter_debounce_ms ? parseInt(keys.omnifilter_debounce_ms, 10) : 2000
      repoAcronimo.value = keys.repo_acronimo || 'TKT'
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
        saveError.value = data.error ? data.error : 'Error al guardar'
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

  return { deepseekKey, redmineToken, redmineUrl, systemPrompt, omnifilterDebounceMs, repoAcronimo,
           documentacionPromptBaseDatos, documentacionPromptSubproyectos,
           documentacionPromptEndpoints, documentacionPromptWebSockets,
           documentacionPromptFuncionalidades, ticketDescripcionPrompt, ticketRefinarPrompt,
           saveError, saveSuccess, clearFeedback, load, save }
})
