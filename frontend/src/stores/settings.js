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
  const locale = ref('es_ES.UTF-8')
  const priorityColorLow = ref('#6b7280')
  const priorityColorNormal = ref('#3b82f6')
  const priorityColorHigh = ref('#eab308')
  const priorityColorUrgent = ref('#ef4444')
  const priorityColorImmediate = ref('#ef4444')
  const screenResolutions = ref([])
  const saveError = ref('')
  const saveSuccess = ref('')

  function applyPriorityColors() {
    const root = document.documentElement
    root.style.setProperty('--priority-low-color', priorityColorLow.value)
    root.style.setProperty('--priority-normal-color', priorityColorNormal.value)
    root.style.setProperty('--priority-high-color', priorityColorHigh.value)
    root.style.setProperty('--priority-urgent-color', priorityColorUrgent.value)
    root.style.setProperty('--priority-immediate-color', priorityColorImmediate.value)
  }

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
      locale.value = keys.locale || 'es_ES.UTF-8'
      priorityColorLow.value = keys.priority_color_low || '#6b7280'
      priorityColorNormal.value = keys.priority_color_normal || '#3b82f6'
      priorityColorHigh.value = keys.priority_color_high || '#eab308'
      priorityColorUrgent.value = keys.priority_color_urgent || '#ef4444'
      priorityColorImmediate.value = keys.priority_color_immediate || '#ef4444'
      screenResolutions.value = keys.screen_resolutions || []
      applyPriorityColors()
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
           locale, screenResolutions,
           documentacionPromptBaseDatos, documentacionPromptSubproyectos,
           documentacionPromptEndpoints, documentacionPromptWebSockets,
           documentacionPromptFuncionalidades, ticketDescripcionPrompt, ticketRefinarPrompt,
           priorityColorLow, priorityColorNormal, priorityColorHigh, priorityColorUrgent, priorityColorImmediate,
           saveError, saveSuccess, clearFeedback, load, save, applyPriorityColors }
})
