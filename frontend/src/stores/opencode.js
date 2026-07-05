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
  const _sessionStreamData = ref({})

  const sessionsMap = ref({})
  const currentActiveChatSession = ref(null)

  function getActiveSessionsCount() {
    return Object.values(sessionsMap.value).filter((s) => s.ocSessionId).length
  }

  function saveCurrentToMap(chatSid, extraFields = {}) {
    if (!chatSid) return
    const key = String(chatSid)
    sessionsMap.value[key] = {
      ...sessionsMap.value[key],
      step: step.value,
      ocSessionId: ocSessionId.value,
      chatSessionId: chatSessionId.value,
      selectedProvider: selectedProvider.value,
      selectedModel: selectedModel.value,
      selectedThinking: selectedThinking.value,
      selectedMode: selectedMode.value,
      selectedTemperature: selectedTemperature.value,
      messageQueue: [...messageQueue.value],
      processing: processing.value,
      streaming: streaming.value,
      streamText: streamText.value,
      streamThinking: streamThinking.value,
      ...extraFields,
    }
  }

  function setSessionOcInput(chatSid, text) {
    const key = String(chatSid)
    if (!sessionsMap.value[key]) return
    sessionsMap.value[key].ocInput = text
    _persist()
  }

  function getSessionOcInput(chatSid) {
    const key = String(chatSid)
    return sessionsMap.value[key]?.ocInput || ''
  }

  function loadFromMap(chatSid) {
    if (!chatSid) return false
    const key = String(chatSid)
    const saved = sessionsMap.value[key]
    if (saved) {
      step.value = saved.step || 'idle'
      ocSessionId.value = saved.ocSessionId || null
      chatSessionId.value = saved.chatSessionId || null
      selectedProvider.value = saved.selectedProvider || ''
      selectedModel.value = saved.selectedModel || ''
      selectedThinking.value = saved.selectedThinking || ''
      selectedMode.value = saved.selectedMode || ''
      selectedTemperature.value = saved.selectedTemperature || ''
      messageQueue.value = saved.messageQueue || []
      processing.value = saved.processing || false
      streaming.value = saved.streaming || false
      streamText.value = saved.streamText || ''
      streamThinking.value = saved.streamThinking || ''
      return true
    }
    return false
  }

  function _resetValues() {
    step.value = 'idle'
    ocSessionId.value = null
    chatSessionId.value = null
    selectedProvider.value = ''
    selectedModel.value = ''
    selectedThinking.value = ''
    selectedMode.value = ''
    selectedTemperature.value = ''
    messageQueue.value = []
    processing.value = false
    streaming.value = false
    streamText.value = ''
    streamThinking.value = ''
  }

  function activateSession(chatSid) {
    if (!chatSid) return false
    if (currentActiveChatSession.value && String(currentActiveChatSession.value) !== String(chatSid)) {
      saveCurrentToMap(currentActiveChatSession.value)
    }
    currentActiveChatSession.value = chatSid
    const loaded = loadFromMap(chatSid)
    const hasValidOcSession = chatSessionId.value && String(chatSessionId.value) === String(chatSid)
    if (!hasValidOcSession && !loaded) {
      _resetValues()
    }
    const sKey = String(chatSid)
    const sd = _sessionStreamData.value[sKey]
    if (sd) {
      streaming.value = sd.streaming
      streamText.value = sd.text
      streamThinking.value = sd.thinking
    } else {
      streaming.value = false
      streamText.value = ''
      streamThinking.value = ''
    }
    return hasValidOcSession
  }

  function _persist() {
    const state = {
      activeChatSession: currentActiveChatSession.value,
      sessions: sessionsMap.value,
    }
    if (Object.keys(sessionsMap.value).length > 0) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state))
    } else {
      sessionStorage.removeItem(SESSION_KEY)
    }
  }

  function setSessionShowTerminal(chatSid, val) {
    const key = String(chatSid)
    if (!sessionsMap.value[key]) return
    sessionsMap.value[key].showTerminal = val
    _persist()
  }

  function getSessionShowTerminal(chatSid) {
    const key = String(chatSid)
    return sessionsMap.value[key]?.showTerminal || false
  }

  function getSessionExtra(chatSid, field) {
    const key = String(chatSid)
    const s = sessionsMap.value[key]
    return s ? s[field] : undefined
  }

  function saveUiState() {
    if (currentActiveChatSession.value) {
      saveCurrentToMap(currentActiveChatSession.value)
    }
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

  async function start(chatSessionId) {
    try {
      const params = chatSessionId ? `?sessionId=${encodeURIComponent(chatSessionId)}` : '';
      const res = await fetch(`${API}/opencode/start${params}`, { credentials: 'include' })
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

      if (!selectedProvider.value && data.savedProvider) selectedProvider.value = data.savedProvider
      if (!selectedModel.value && data.savedModel) selectedModel.value = data.savedModel
      if (!selectedThinking.value && data.savedThinking) selectedThinking.value = data.savedThinking
      if (!selectedMode.value && data.savedMode) selectedMode.value = data.savedMode
      if (!selectedTemperature.value && data.savedTemperature) selectedTemperature.value = data.savedTemperature

      return data
    } catch (err) {
      console.error('Error en opencode start:', err)
      return null
    }
  }

  async function select(key, value) {
    try {
      const payload = { key, value }
      if (chatSessionId.value) {
        payload.sessionId = chatSessionId.value
      }
      await fetch(`${API}/opencode/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
    } catch (err) {
      console.error('Error en opencode select:', err)
    }
  }

  async function streamPrompt(sessionId, prompt, provider, model, thinking, mode, temperature, callbacks) {
    const sKey = String(sessionId)
    const isActiveSession = () => currentActiveChatSession.value && String(currentActiveChatSession.value) === sKey

    const body = { prompt, provider, model, thinking, mode, temperature, sessionId }
    if (ocSessionId.value) body.ocSessionId = ocSessionId.value

    let localStreamText = ''
    let localStreamThinking = ''
    let doneReceived = false

    if (!_sessionStreamData.value[sKey]) {
      _sessionStreamData.value[sKey] = { text: '', thinking: '', streaming: true }
    } else {
      _sessionStreamData.value[sKey].text = ''
      _sessionStreamData.value[sKey].thinking = ''
      _sessionStreamData.value[sKey].streaming = true
    }

    streaming.value = true
    if (isActiveSession()) {
      streamText.value = ''
      streamThinking.value = ''
    }

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
        if (_sessionStreamData.value[sKey]) _sessionStreamData.value[sKey].streaming = false
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
              localStreamText += j.content
              _sessionStreamData.value[sKey].text = localStreamText
              if (isActiveSession()) streamText.value = localStreamText
              if (callbacks?.onChunk) callbacks.onChunk(j.content, localStreamText)
            } else if (j.type === 'thinking') {
              localStreamThinking += j.content
              _sessionStreamData.value[sKey].thinking = localStreamThinking
              if (isActiveSession()) streamThinking.value = localStreamThinking
              if (callbacks?.onThinking) callbacks.onThinking(j.content, localStreamThinking)
            } else if (j.type === 'tool_call') {
              if (callbacks?.onToolCall) callbacks.onToolCall(j.content, j.field, localStreamText)
            } else if (j.type === 'tool_result') {
              if (callbacks?.onToolResult) callbacks.onToolResult(j.content, j.field, localStreamText)
            } else if (j.type === 'tool_data') {
              if (callbacks?.onToolData) callbacks.onToolData(j.content, j.partType, j.field, localStreamText)
            } else if (j.type === 'terminal') {
              if (callbacks?.onTerminalLine) callbacks.onTerminalLine(j.line, j.partType)
            } else if (j.type === 'control_request') {
              if (callbacks?.onControl) callbacks.onControl(j.control)
            } else if (j.type === 'done') {
              doneReceived = true
              const newOcSessionId = j.ocSessionId || j.hash || null
              if (sessionsMap.value[sKey]) {
                sessionsMap.value[sKey].ocSessionId = newOcSessionId
              }
              if (isActiveSession()) {
                ocSessionId.value = newOcSessionId
              }
              streaming.value = false
              _sessionStreamData.value[sKey].streaming = false
              if (callbacks?.onDone) await callbacks.onDone(j, localStreamText)
              _persist()
            } else if (j.type === 'error') {
              streaming.value = false
              if (_sessionStreamData.value[sKey]) _sessionStreamData.value[sKey].streaming = false
              if (callbacks?.onError) await callbacks.onError(j.content)
            }
          } catch (e) { console.error('Error al parsear SSE JSON en opencode:', e) }
        }
      }

      if (!doneReceived) {
        streaming.value = false
        if (_sessionStreamData.value[sKey]) _sessionStreamData.value[sKey].streaming = false
        if (callbacks?.onDone) {
          const sKey2 = String(sessionId)
          if (sessionsMap.value[sKey2]) {
            sessionsMap.value[sKey2].ocSessionId = ocSessionId.value
          }
          await callbacks.onDone(
            { type: 'done', ocSessionId: ocSessionId.value, fullResponse: localStreamText, thinking: localStreamThinking },
            localStreamText
          )
          _persist()
        }
      }
    } catch (err) {
      console.error('Error en streamPrompt:', err)
      streaming.value = false
      if (_sessionStreamData.value[sKey]) _sessionStreamData.value[sKey].streaming = false
      if (callbacks?.onError) await callbacks.onError(err.message)
    }
  }

  function clearAllSessions() {
    sessionsMap.value = {}
    _sessionStreamData.value = {}
    currentActiveChatSession.value = null
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

  function resetAllSessionsExecutionState() {
    const keys = Object.keys(sessionsMap.value)
    for (const key of keys) {
      const s = sessionsMap.value[key]
      s.step = 'idle'
      s.ocSessionId = null
      s.processing = false
      s.streaming = false
      s.streamText = ''
      s.streamThinking = ''
    }
    _sessionStreamData.value = {}
    currentActiveChatSession.value = null
    step.value = 'idle'
    ocSessionId.value = null
    processing.value = false
    streaming.value = false
    streamText.value = ''
    streamThinking.value = ''
    _persist()
  }

  function finish() {
    _resetValues()
    const key = currentActiveChatSession.value ? String(currentActiveChatSession.value) : null
    if (key && sessionsMap.value[key]) {
      delete sessionsMap.value[key]
    }
    if (key && _sessionStreamData.value[key]) {
      delete _sessionStreamData.value[key]
    }
    _persist()
  }

  function restoreFromState(savedState) {
    if (!savedState) return false
    if (savedState.sessions) {
      sessionsMap.value = savedState.sessions
    }
    const activeId = savedState.activeChatSession || null
    if (activeId && sessionsMap.value[String(activeId)]) {
      currentActiveChatSession.value = activeId
      return loadFromMap(activeId)
    }
    _resetValues()
    return false
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
    sessionsMap, currentActiveChatSession,
    saveCurrentToMap, activateSession, getActiveSessionsCount, clearAllSessions,
    setSessionOcInput, getSessionOcInput,
    setSessionShowTerminal, getSessionShowTerminal, getSessionExtra,
    getAvailableProviders, getModelsForProvider, modelSupportsReasoning,
    start, select, streamPrompt, finish, restoreFromState, restoreFromSession, saveUiState,
    resetAllSessionsExecutionState,
  }
})
