import { defineStore } from 'pinia'
import { ref } from 'vue'

const API = '/api'
const SESSION_KEY = 'oc_opencode_state'

const thinkingOptions = [
  { label: 'Low — mínimo esfuerzo de razonamiento', value: 'low' },
  { label: 'Medium — equilibrio entre velocidad y profundidad', value: 'medium' },
  { label: 'High — máximo razonamiento profundo', value: 'high' },
]

const temperatureOptions = [
  { label: 'Precisa (0.0)', value: '0' },
  { label: 'Balanceada (0.7)', value: '0.7' },
  { label: 'Creativa (1.5)', value: '1.5' },
]

export const useOpencodeStore = defineStore('opencode', () => {
  const step = ref('idle')
  const ocSessionId = ref(null)
  const chatSessionId = ref(null)
  const defaultModels = ref({})
  const providers = ref([])
  const savedProvider = ref('')
  const savedModel = ref('')
  const savedThinking = ref('')
  const savedMode = ref('')
  const savedTemperature = ref('')
  const selectedProvider = ref('')
  const selectedModel = ref('')
  const selectedThinking = ref('')
  const selectedMode = ref('')
  const selectedTemperature = ref('')

  const messageQueue = ref([])
  const processing = ref(false)
  const streaming = ref(false)
  const streamText = ref('')
  const streamThinking = ref('')

  function _persist() {
    const state = {
      ocStep: step.value,
      ocSessionId: ocSessionId.value,
      ocChatSessionId: chatSessionId.value,
      ocProvider: selectedProvider.value,
      ocModel: selectedModel.value,
      ocThinking: selectedThinking.value,
      ocMode: selectedMode.value,
      ocTemperature: selectedTemperature.value,
    }
    if (state.ocSessionId || (state.ocStep && state.ocStep !== 'idle')) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state))
    } else {
      sessionStorage.removeItem(SESSION_KEY)
    }
  }

  function saveUiState() {
    _persist()
  }

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
      savedTemperature.value = data.savedTemperature || ''
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

  async function streamPrompt(sessionId, prompt, provider, model, thinking, mode, temperature, callbacks) {
    const body = { prompt, provider, model, thinking, mode, temperature, sessionId }
    if (ocSessionId.value) body.ocSessionId = ocSessionId.value

    streaming.value = true
    streamText.value = ''
    streamThinking.value = ''

    try {
      const res = await fetch(`${API}/opencode/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        let errMsg = 'Error en conexión con OpenCode'
        try { const errData = await res.json(); if (errData.error) errMsg = errData.error } catch (e) { console.error('Error al parsear error response:', e) }
        streaming.value = false
        if (callbacks?.onError) await callbacks.onError(errMsg)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''

        for (const line of lines) {
          const t = line.trim()
          if (!t || !t.startsWith('data: ')) continue

          try {
            const j = JSON.parse(t.slice(6))
            if (j.type === 'response') {
              streamText.value += j.content
              if (callbacks?.onChunk) callbacks.onChunk(j.content, streamText.value)
            } else if (j.type === 'thinking') {
              streamThinking.value += j.content
              if (callbacks?.onThinking) callbacks.onThinking(j.content, streamThinking.value)
            } else if (j.type === 'control_request') {
              if (callbacks?.onControl) callbacks.onControl(j.control)
            } else if (j.type === 'done') {
              ocSessionId.value = j.ocSessionId || j.hash || null
              streaming.value = false
              if (callbacks?.onDone) await callbacks.onDone(j, streamText.value)
              saveUiState()
            } else if (j.type === 'error') {
              streaming.value = false
              if (callbacks?.onError) await callbacks.onError(j.content)
            }
          } catch (e) { console.error('Error al parsear SSE JSON en opencode:', e) }
        }
      }

      if (streaming.value) {
        streaming.value = false
        if (callbacks?.onDone) {
          await callbacks.onDone(
            { type: 'done', ocSessionId: ocSessionId.value, fullResponse: streamText.value, thinking: streamThinking.value },
            streamText.value
          )
          saveUiState()
        }
      }
    } catch (err) {
      console.error('Error en streamPrompt:', err)
      streaming.value = false
      if (callbacks?.onError) await callbacks.onError(err.message)
    }
  }

  function finish() {
    step.value = 'idle'
    ocSessionId.value = null
    chatSessionId.value = null
    streaming.value = false
    streamText.value = ''
    streamThinking.value = ''
    selectedProvider.value = ''
    selectedModel.value = ''
    selectedThinking.value = ''
    selectedMode.value = ''
    selectedTemperature.value = ''
    messageQueue.value = []
    processing.value = false
    sessionStorage.removeItem(SESSION_KEY)
  }

  function restoreFromState(savedState) {
    if (!savedState) return false
    const ocStep = savedState.ocStep
    const ocSid = savedState.ocSessionId
    if (!ocSid && (!ocStep || ocStep === 'idle')) return false
    step.value = ocStep || 'idle'
    ocSessionId.value = ocSid || null
    chatSessionId.value = savedState.ocChatSessionId || null
    selectedProvider.value = savedState.ocProvider || ''
    selectedModel.value = savedState.ocModel || ''
    selectedThinking.value = savedState.ocThinking || ''
    selectedMode.value = savedState.ocMode || ''
    selectedTemperature.value = savedState.ocTemperature || ''
    return true
  }

  function restoreFromSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      if (!raw) return false
      return restoreFromState(JSON.parse(raw))
    } catch (e) {
      console.error('Error restoring opencode from sessionStorage:', e)
      return false
    }
  }

  return {
    step, ocSessionId, chatSessionId, defaultModels, providers,
    savedProvider, savedModel, savedThinking, savedMode, savedTemperature,
    selectedProvider, selectedModel, selectedThinking, selectedMode, selectedTemperature,
    streaming, streamText, streamThinking,
    thinkingOptions, temperatureOptions,
    messageQueue, processing,
    getAvailableProviders, getModelsForProvider, modelSupportsReasoning,
    start, select, streamPrompt, finish, restoreFromState, restoreFromSession, saveUiState,
  }
})
