import { defineStore } from 'pinia'
import { ref } from 'vue'

const API = '/api'
const SESSION_KEY = 'oc_opencode_state'
let _agentIdCounter = 1

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

  function _genAgentId() {
    return 'agent-' + (_agentIdCounter++) + '-' + Date.now()
  }

  function _ensureSessionEntry(chatSid) {
    const key = String(chatSid)
    if (!sessionsMap.value[key]) {
      sessionsMap.value[key] = { agents: [], activeAgentIndex: 0, ocInput: '', showTerminal: false }
    }
    return sessionsMap.value[key]
  }

  function getAgents(chatSid) {
    const key = String(chatSid)
    const entry = sessionsMap.value[key]
    return entry ? entry.agents : []
  }

  function getActiveAgent(chatSid) {
    const agents = getAgents(chatSid)
    const entry = sessionsMap.value[String(chatSid)]
    const idx = entry ? entry.activeAgentIndex : 0
    return agents[idx] || null
  }

  function createNewAgent(chatSid) {
    const entry = _ensureSessionEntry(chatSid)
    const agent = {
      id: _genAgentId(),
      ocSessionId: null,
      step: 'starting',
      streaming: false,
      streamText: '',
      streamThinking: '',
      terminalContent: '',
      processing: false,
      messageQueue: [],
      createdAt: Date.now(),
    }
    entry.agents.push(agent)
    entry.activeAgentIndex = entry.agents.length - 1
    return agent
  }

  function removeAgent(chatSid, agentId) {
    const key = String(chatSid)
    const entry = sessionsMap.value[key]
    if (!entry) return
    const idx = entry.agents.findIndex(a => a.id === agentId)
    if (idx === -1) return
    entry.agents.splice(idx, 1)
    if (entry.activeAgentIndex >= entry.agents.length) {
      entry.activeAgentIndex = Math.max(0, entry.agents.length - 1)
    }
  }

  function updateAgent(chatSid, agentId, updates) {
    const key = String(chatSid)
    const entry = sessionsMap.value[key]
    if (!entry) return
    const agent = entry.agents.find(a => a.id === agentId)
    if (!agent) return
    Object.assign(agent, updates)
  }

  function syncGlobalFromActiveAgent(chatSid) {
    const agent = getActiveAgent(chatSid)
    if (agent) {
      ocSessionId.value = agent.ocSessionId
      step.value = agent.step
      streaming.value = agent.streaming
      streamText.value = agent.streamText
      streamThinking.value = agent.streamThinking
      processing.value = agent.processing
      messageQueue.value = [...agent.messageQueue]
    }
  }

  function getActiveSessionsCount() {
    let count = 0
    for (const key of Object.keys(sessionsMap.value)) {
      count += sessionsMap.value[key].agents.filter(a => a.ocSessionId).length
    }
    return count
  }

  function saveCurrentToMap(chatSid, extraFields = {}) {
    if (!chatSid) return
    const key = String(chatSid)
    const entry = _ensureSessionEntry(chatSid)
    const agent = getActiveAgent(chatSid)
    if (agent) {
      agent.ocSessionId = ocSessionId.value
      agent.step = step.value
      agent.streaming = streaming.value
      agent.streamText = streamText.value
      agent.streamThinking = streamThinking.value
      agent.processing = processing.value
      agent.messageQueue = [...messageQueue.value]
    }
    entry.selectedProvider = selectedProvider.value
    entry.selectedModel = selectedModel.value
    entry.selectedThinking = selectedThinking.value
    entry.selectedMode = selectedMode.value
    entry.selectedTemperature = selectedTemperature.value
    Object.assign(entry, extraFields)
    _persist()
  }

  function setSessionOcInput(chatSid, text) {
    const key = String(chatSid)
    const entry = _ensureSessionEntry(chatSid)
    entry.ocInput = text
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
    if (!saved) return false

    selectedProvider.value = saved.selectedProvider || ''
    selectedModel.value = saved.selectedModel || ''
    selectedThinking.value = saved.selectedThinking || ''
    selectedMode.value = saved.selectedMode || ''
    selectedTemperature.value = saved.selectedTemperature || ''

    const agent = getActiveAgent(chatSid)
    if (agent) {
      step.value = agent.step || 'idle'
      ocSessionId.value = agent.ocSessionId || null
      chatSessionId.value = chatSid
      messageQueue.value = agent.messageQueue || []
      processing.value = agent.processing || false
      streaming.value = agent.streaming || false
      streamText.value = agent.streamText || ''
      streamThinking.value = agent.streamThinking || ''
      return true
    }

    step.value = 'idle'
    ocSessionId.value = null
    chatSessionId.value = chatSid
    messageQueue.value = []
    processing.value = false
    streaming.value = false
    streamText.value = ''
    streamThinking.value = ''
    return true
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
    } else if (hasValidOcSession || loaded) {
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
    const entry = _ensureSessionEntry(chatSid)
    entry.showTerminal = val
    _persist()
  }

  function getSessionShowTerminal(chatSid) {
    const key = String(chatSid)
    return sessionsMap.value[key]?.showTerminal || false
  }

  function getSessionExtra(chatSid, field) {
    const key = String(chatSid)
    const s = sessionsMap.value[key]
    if (s && field in s) return s[field]
    const agent = getActiveAgent(chatSid)
    return agent ? agent[field] : undefined
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

  async function streamPrompt(sessionId, prompt, provider, model, thinking, mode, temperature, callbacks, existingAgentId) {
    const sKey = String(sessionId)
    const isActiveSession = () => currentActiveChatSession.value && String(currentActiveChatSession.value) === sKey

    const body = { prompt, provider, model, thinking, mode, temperature, sessionId }

    let localStreamText = ''
    let localStreamThinking = ''
    let doneReceived = false

    let agentId = existingAgentId
    if (!agentId) {
      const agent = createNewAgent(sessionId)
      agentId = agent.id
    }
    if (callbacks) callbacks._agentId = agentId

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
        updateAgent(sessionId, agentId, { streaming: false, step: 'error' })
        if (_sessionStreamData.value[sKey]) _sessionStreamData.value[sKey].streaming = false
        if (callbacks?.onError) await callbacks.onError(errMsg)
        _persist()
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
              updateAgent(sessionId, agentId, { streamText: localStreamText })
              if (isActiveSession()) streamText.value = localStreamText
              if (callbacks?.onChunk) callbacks.onChunk(j.content, localStreamText)
            } else if (j.type === 'thinking') {
              localStreamThinking += j.content
              _sessionStreamData.value[sKey].thinking = localStreamThinking
              updateAgent(sessionId, agentId, { streamThinking: localStreamThinking })
              if (isActiveSession()) streamThinking.value = localStreamThinking
              if (callbacks?.onThinking) callbacks.onThinking(j.content, localStreamThinking)
            } else if (j.type === 'tool_call') {
              if (callbacks?.onToolCall) callbacks.onToolCall(j.content, j.field, localStreamText)
            } else if (j.type === 'tool_result') {
              if (callbacks?.onToolResult) callbacks.onToolResult(j.content, j.field, localStreamText)
            } else if (j.type === 'tool_data') {
              if (callbacks?.onToolData) callbacks.onToolData(j.content, j.partType, j.field, localStreamText)
            } else if (j.type === 'terminal') {
              if (j.agentId && j.agentId !== agentId) continue
              if (callbacks?.onTerminalLine) callbacks.onTerminalLine(j.line, j.partType)
            } else if (j.type === 'control_request') {
              if (callbacks?.onControl) callbacks.onControl(j.control)
            } else if (j.type === 'done') {
              doneReceived = true
              const newOcSessionId = j.ocSessionId || j.hash || null
              updateAgent(sessionId, agentId, { ocSessionId: newOcSessionId, step: 'idle' })
              if (isActiveSession()) {
                ocSessionId.value = newOcSessionId
              }
              streaming.value = false
              _sessionStreamData.value[sKey].streaming = false
              if (callbacks?.onDone) await callbacks.onDone(j, localStreamText)
              _persist()
            } else if (j.type === 'error') {
              streaming.value = false
              updateAgent(sessionId, agentId, { streaming: false, step: 'error' })
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
          const entry = sessionsMap.value[sKey]
          const activeAgent = entry ? entry.agents.find(a => a.id === agentId) : null
          const finalOcId = activeAgent?.ocSessionId || ocSessionId.value
          await callbacks.onDone(
            { type: 'done', ocSessionId: finalOcId, fullResponse: localStreamText, thinking: localStreamThinking },
            localStreamText
          )
          _persist()
        }
      }
    } catch (err) {
      console.error('Error en streamPrompt:', err)
      streaming.value = false
      updateAgent(sessionId, agentId, { streaming: false, step: 'error' })
      if (_sessionStreamData.value[sKey]) _sessionStreamData.value[sKey].streaming = false
      if (callbacks?.onError) await callbacks.onError(err.message)
    }
  }

  async function restoreActiveAgents(chatSid) {
    if (!chatSid) return
    const key = String(chatSid)
    try {
      const res = await fetch(`${API}/opencode/sessions?sessionId=${encodeURIComponent(chatSid)}`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      if (!data.sessions || !Array.isArray(data.sessions)) return

      const entry = _ensureSessionEntry(chatSid)
      for (const s of data.sessions) {
        const exists = entry.agents.find(a => a.ocSessionId === s.id)
        if (exists) continue
        entry.agents.push({
          id: _genAgentId(),
          ocSessionId: s.id,
          step: s.status?.type === 'idle' ? 'idle' : 'running',
          streaming: false,
          streamText: '',
          streamThinking: '',
          terminalContent: '',
          processing: false,
          messageQueue: [],
          createdAt: new Date(s.createdAt || Date.now()).getTime(),
        })
      }
      _persist()
    } catch (err) {
      console.error('Error restoring active agents:', err.message)
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
      const entry = sessionsMap.value[key]
      if (entry && entry.agents) {
        for (const agent of entry.agents) {
          agent.step = 'idle'
          agent.ocSessionId = null
          agent.processing = false
          agent.streaming = false
          agent.streamText = ''
          agent.streamThinking = ''
        }
      }
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
    getAgents, getActiveAgent, createNewAgent, removeAgent, updateAgent, syncGlobalFromActiveAgent,
    restoreActiveAgents,
  }
})
