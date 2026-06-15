import { defineStore } from 'pinia'
import { ref } from 'vue'

const API = '/api'

export const useOpencodeStore = defineStore('opencode', () => {
  const step = ref('idle')
  const ocSessionId = ref(null)
  const defaultModels = ref({})
  const providers = ref([])
  const savedProvider = ref('')
  const savedModel = ref('')
  const savedThinking = ref('')
  const savedMode = ref('')
  const selectedProvider = ref('')
  const selectedModel = ref('')
  const selectedThinking = ref('')
  const selectedMode = ref('')

  const thinkingOptions = [
    { label: 'Low — mínimo esfuerzo de razonamiento', value: 'low' },
    { label: 'Medium — equilibrio entre velocidad y profundidad', value: 'medium' },
    { label: 'High — máximo razonamiento profundo', value: 'high' },
  ]
  const streaming = ref(false)
  const streamText = ref('')
  const streamThinking = ref('')

  function getAvailableProviders() {
    return providers.value.map((p) => ({
      label: p.name || p.id,
      value: p.id,
    }))
  }

  function getModelsForProvider(providerId) {
    const prov = providers.value.find((p) => p.id === providerId)
    if (!prov || !prov.models) return []
    return Object.keys(prov.models).map((key) => {
      const m = prov.models[key]
      return {
        label: m.name || key,
        value: key,
        reasoning: m.capabilities ? m.capabilities.reasoning : false,
      }
    })
  }

  function modelSupportsReasoning(providerId, modelKey) {
    const prov = providers.value.find((p) => p.id === providerId)
    if (!prov || !prov.models || !prov.models[modelKey]) return false
    const caps = prov.models[modelKey].capabilities
    return caps ? caps.reasoning || false : false
  }

  async function start() {
    try {
      const res = await fetch(`${API}/opencode/start`, { credentials: 'include' })
      const data = await res.json()
      if (data.error) {
        console.error('Error en opencode start:', data.error)
        return null
      }
      providers.value = data.providers || []
      defaultModels.value = data.defaultModels || {}
      savedProvider.value = data.savedProvider || ''
      savedModel.value = data.savedModel || ''
      savedThinking.value = data.savedThinking || ''
      savedMode.value = data.savedMode || ''
      return data
    } catch (err) {
      console.error('Error en opencode start:', err)
      return null
    }
  }

  async function select(key, value) {
    try {
      await fetch(`${API}/opencode/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key, value }),
      })
    } catch (err) {
      console.error('Error en opencode select:', err)
    }
  }

  function finish() {
    step.value = 'idle'
    ocSessionId.value = null
    streaming.value = false
    streamText.value = ''
    streamThinking.value = ''
    selectedProvider.value = ''
    selectedModel.value = ''
    selectedThinking.value = ''
    selectedMode.value = ''
  }

  return {
    step, ocSessionId, defaultModels, providers,
    savedProvider, savedModel, savedThinking, savedMode,
    selectedProvider, selectedModel, selectedThinking, selectedMode,
    streaming, streamText, streamThinking,
    thinkingOptions,
    getAvailableProviders, getModelsForProvider, modelSupportsReasoning,
    start, select, finish,
  }
})
