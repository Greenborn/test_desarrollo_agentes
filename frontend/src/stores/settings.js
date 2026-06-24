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
  const deteccionFuncionalidadesPrompt = ref('')
  const omnifilterDebounceMs = ref(2000)
  const repoAcronimo = ref('TKT')
  const locale = ref('es_ES.UTF-8')
  const priorityColorLow = ref('#6b7280')
  const priorityColorNormal = ref('#3b82f6')
  const priorityColorHigh = ref('#eab308')
  const priorityColorUrgent = ref('#ef4444')
  const priorityColorImmediate = ref('#ef4444')
  const screenResolutions = ref([])
  const replayIntervalMs = ref(1000)
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
      deteccionFuncionalidadesPrompt.value = keys.deteccion_funcionalidades_prompt || ''
      omnifilterDebounceMs.value = keys.omnifilter_debounce_ms ? parseInt(keys.omnifilter_debounce_ms, 10) : 2000
      repoAcronimo.value = keys.repo_acronimo || 'TKT'
      locale.value = keys.locale || 'es_ES.UTF-8'
      priorityColorLow.value = keys.priority_color_low || '#6b7280'
      priorityColorNormal.value = keys.priority_color_normal || '#3b82f6'
      priorityColorHigh.value = keys.priority_color_high || '#eab308'
      priorityColorUrgent.value = keys.priority_color_urgent || '#ef4444'
      priorityColorImmediate.value = keys.priority_color_immediate || '#ef4444'
      screenResolutions.value = keys.screen_resolutions || []
      replayIntervalMs.value = keys.replay_interval_ms ? parseInt(keys.replay_interval_ms, 10) : 1000
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
        updateLocalSetting(key, value)
      } else {
        saveError.value = data.error ? data.error : 'Error al guardar'
      }
    } catch (err) {
      saveError.value = 'Error de conexión'
    }
  }

  function updateLocalSetting(key, value) {
    switch (key) {
      case 'deepseek_key': deepseekKey.value = value; break
      case 'redmine_token': redmineToken.value = value; break
      case 'redmine_url': redmineUrl.value = value; break
      case 'system_prompt': systemPrompt.value = value; break
      case 'documentacion_prompt_base_datos': documentacionPromptBaseDatos.value = value; break
      case 'documentacion_prompt_subproyectos': documentacionPromptSubproyectos.value = value; break
      case 'documentacion_prompt_endpoints': documentacionPromptEndpoints.value = value; break
      case 'documentacion_prompt_web_sockets': documentacionPromptWebSockets.value = value; break
      case 'documentacion_prompt_funcionalidades': documentacionPromptFuncionalidades.value = value; break
      case 'ticket_descripcion_prompt': ticketDescripcionPrompt.value = value; break
      case 'ticket_refinar_prompt': ticketRefinarPrompt.value = value; break
      case 'deteccion_funcionalidades_prompt': deteccionFuncionalidadesPrompt.value = value; break
      case 'omnifilter_debounce_ms': omnifilterDebounceMs.value = parseInt(value, 10) || 2000; break
      case 'repo_acronimo': repoAcronimo.value = value; break
      case 'locale': locale.value = value; break
      case 'priority_color_low': priorityColorLow.value = value; applyPriorityColors(); break
      case 'priority_color_normal': priorityColorNormal.value = value; applyPriorityColors(); break
      case 'priority_color_high': priorityColorHigh.value = value; applyPriorityColors(); break
      case 'priority_color_urgent': priorityColorUrgent.value = value; applyPriorityColors(); break
      case 'priority_color_immediate': priorityColorImmediate.value = value; applyPriorityColors(); break
      case 'screen_resolutions':
        try { screenResolutions.value = JSON.parse(value) } catch { screenResolutions.value = [] }
        break
      case 'replay_interval_ms': replayIntervalMs.value = parseInt(value, 10) || 1000; break
    }
  }

  function clearFeedback() {
    saveSuccess.value = ''
    saveError.value = ''
  }

  return { deepseekKey, redmineToken, redmineUrl, systemPrompt, omnifilterDebounceMs, repoAcronimo,
           locale, screenResolutions, replayIntervalMs,
           documentacionPromptBaseDatos, documentacionPromptSubproyectos,
           documentacionPromptEndpoints, documentacionPromptWebSockets,
           documentacionPromptFuncionalidades, ticketDescripcionPrompt, ticketRefinarPrompt,
           deteccionFuncionalidadesPrompt,
           priorityColorLow, priorityColorNormal, priorityColorHigh, priorityColorUrgent, priorityColorImmediate,
           saveError, saveSuccess, clearFeedback, load, save, applyPriorityColors }
})
