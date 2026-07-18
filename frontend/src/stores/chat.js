import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from './auth.js'
import { useWorkspaceStore } from './workspace.js'
import wsClient from '../services/wsClient.js'

const API = '/api'
const SESSION_KEY = 'oc_active_session_id'

export const useChatStore = defineStore('chat', () => {
  const sessions = ref([])
  const archivedSessions = ref([])
  const activeSessionId = ref(null)
  const messages = ref([])
  const creating = ref(false)
  const executingCount = ref(0)
  const _sessionCmdCount = ref({})
  const _streamingSessions = ref({})
  const _ocStreamingSessions = ref({})
  const sessionStatus = ref({})
  const currentChunk = ref('')
  const currentThinking = ref('')
  const pendingNotifications = ref({})
  const loadingMore = ref(false)
  const hasMoreMessages = ref(true)
  const oldestMessageId = ref(null)
  const sessionTickets = ref({})
  const _sessionStreamCache = ref({})
  const _ocSessionStreamCache = ref({})
  const ledFlash = ref({})
  const ledFlashTimers = {}
  const _cmdStreamingSessions = ref({})
  const _cmdSessionStreamCache = ref({})
  const _cmdPendingSave = ref({})
  const _terminalSessions = ref({})
  const maxTerminalsLimit = ref(2)

  function _getSessionTerminals(sid) {
    return sid ? _terminalSessions.value[sid] : null
  }

  function _getSessionTerminal(sid) {
    const terminals = _getSessionTerminals(sid)
    return terminals && terminals.length > 0 ? terminals[0] : null
  }

  function _hasTerminal(sid) {
    const terminals = _getSessionTerminals(sid)
    return !!terminals && terminals.length > 0
  }

  function getTerminalCount(sid) {
    const terminals = _getSessionTerminals(sid)
    return terminals ? terminals.length : 0
  }

  function getTerminals(sid) {
    return _getSessionTerminals(sid) || []
  }

  const _terminalSessionId = computed(() => {
    const sid = activeSessionId.value
    return sid && _terminalSessions.value[sid] && _terminalSessions.value[sid].length > 0 ? sid : null
  })
  const showTerminal = computed(() => _terminalSessionId.value !== null)
  const terminalCwd = computed(() => _getSessionTerminal(activeSessionId.value)?.cwd || '')
  const terminalInitCommand = computed(() => _getSessionTerminal(activeSessionId.value)?.initCommand || '')
  const terminalLabel = computed(() => _getSessionTerminal(activeSessionId.value)?.label || 'terminal')
  const terminalId = computed(() => _getSessionTerminal(activeSessionId.value)?.terminalId || null)

  function openTerminal(config = {}) {
    const sid = config.sessionId || activeSessionId.value
    if (!sid) return

    const hasData = config.terminalId || config.cwd || config.initCommand || config.label

    if (!_terminalSessions.value[sid]) {
      _terminalSessions.value[sid] = []
    }

    const terminals = _terminalSessions.value[sid]

    if (!hasData) {
      if (terminals.length >= maxTerminalsLimit.value) {
        const oldest = terminals.shift()
        if (oldest.terminalId) {
          fetch(`/api/procesos/terminal/${oldest.terminalId}`, {
            method: 'DELETE',
            credentials: 'include',
          }).catch(() => {})
        }
      }
      terminals.push({ terminalId: null, cwd: '', initCommand: '', label: 'terminal' })
      flashLed(sid)
      return
    }

    if (config.terminalId) {
      const existing = terminals.find(t => t.terminalId === config.terminalId)
      if (existing) {
        if (config.cwd !== undefined) existing.cwd = config.cwd
        if (config.initCommand !== undefined) existing.initCommand = config.initCommand
        if (config.label !== undefined) existing.label = config.label
        flashLed(sid)
        return
      }
      const unnamed = terminals.find(t => !t.terminalId)
      if (unnamed) {
        unnamed.terminalId = config.terminalId
        if (config.cwd !== undefined) unnamed.cwd = config.cwd
        if (config.initCommand !== undefined) unnamed.initCommand = config.initCommand
        if (config.label !== undefined) unnamed.label = config.label
        flashLed(sid)
        return
      }
    }

    if (!config.terminalId) {
      const unnamed = terminals.find(t => !t.terminalId)
      if (unnamed) {
        if (config.cwd !== undefined) unnamed.cwd = config.cwd
        if (config.initCommand !== undefined) unnamed.initCommand = config.initCommand
        if (config.label !== undefined) unnamed.label = config.label
        flashLed(sid)
        return
      }
    }

    const newTerminal = {
      terminalId: config.terminalId || null,
      cwd: config.cwd || '',
      initCommand: config.initCommand || '',
      label: config.label || 'terminal',
    }

    if (terminals.length >= maxTerminalsLimit.value) {
      const oldest = terminals.shift()
      if (oldest.terminalId) {
        fetch(`/api/procesos/terminal/${oldest.terminalId}`, {
          method: 'DELETE',
          credentials: 'include',
        }).catch(() => {})
      }
    }

    terminals.push(newTerminal)
    flashLed(sid)
  }

  function closeTerminal(terminalId) {
    const sid = activeSessionId.value
    if (!sid || !_terminalSessions.value[sid]) return

    if (terminalId) {
      const idx = _terminalSessions.value[sid].findIndex(t => t.terminalId === terminalId)
      if (idx >= 0) {
        _terminalSessions.value[sid].splice(idx, 1)
        flashLed(sid)
      }
    } else {
      if (_terminalSessions.value[sid].length > 0) flashLed(sid)
      _terminalSessions.value[sid].pop()
    }

    if (_terminalSessions.value[sid].length === 0) {
      delete _terminalSessions.value[sid]
    }
  }

  async function loadMaxTerminalsConfig() {
    try {
      const { settingGet } = await import('../services/settingService.js')
      const res = await settingGet('terminal_max_terminals')
      if (res && res.value) {
        maxTerminalsLimit.value = Math.max(1, parseInt(res.value, 10) || 2)
      }
    } catch (err) {
      console.error('Error loading maxTerminals config:', err)
    }
  }

  async function setMaxTerminalsConfig(val) {
    const num = Math.max(1, parseInt(val, 10) || 2)
    maxTerminalsLimit.value = num
    try {
      const { settingSet } = await import('../services/settingService.js')
      await settingSet('terminal_max_terminals', String(num))
    } catch (err) {
      console.error('Error saving maxTerminals config:', err)
    }
  }

  const streaming = computed(() => {
    const sid = activeSessionId.value
    return sid ? !!_streamingSessions.value[sid] || !!_ocStreamingSessions.value[sid] : false
  })
  const executing = computed(() => {
    const sid = activeSessionId.value
    return sid ? (_sessionCmdCount.value[sid] || 0) > 0 : false
  })

  async function loadSessions() {
    try {
      const res = await fetch(`${API}/chat/sessions`, { credentials: 'include' })
      const data = await res.json()
      if (data.error) {
        if (data.error !== 'Sesión no válida') {
          console.error('Error al cargar sesiones:', data.error)
        }
        return
      }
      sessions.value = data.sessions

      // Restore active session from sessionStorage
      const savedId = sessionStorage.getItem(SESSION_KEY)
      if (savedId) {
        const exists = data.sessions.some(s => Number(s.id) === Number(savedId))
        if (exists) {
          loadMessages(Number(savedId))
        } else {
          sessionStorage.removeItem(SESSION_KEY)
        }
      }
    } catch (err) {
      console.error('Error al cargar sesiones:', err)
    }
  }

  async function createSession(cwd) {
    creating.value = true
    try {
      const auth = useAuthStore()
      const payload = { workspace_id: auth.activeWorkspaceId }
      if (cwd) payload.cwd = cwd
      const res = await fetch(`${API}/chat/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) {
        console.error('Error al crear chat:', data.error)
        return
      }
      sessions.value.unshift(data.session)
      activeSessionId.value = data.session.id
      messages.value = []
      const { useCommandStore } = await import('../stores/command.js')
      const cmdStore = useCommandStore()
      if (data.session.cwd) cmdStore.setDirectory(data.session.cwd)
      _pushNewSessionSetup(data.session)
    } catch (err) {
      console.error('Error al crear chat:', err)
    } finally {
      creating.value = false
    }
  }

  async function createSessionIfNeeded(cwd) {
    if (!activeSessionId.value) {
      await createSession(cwd)
    }
    return activeSessionId.value
  }

  function _pushNewSessionSetup(session) {
    const workspaceStore = useWorkspaceStore()
    const wsOptions = (workspaceStore.workspaces || []).map(w => ({
      label: w.name,
      value: String(w.id),
    }))
    if (wsOptions.length > 0) {
      pushMessage({
        role: 'opencode_control',
        controlData: {
          controlId: 'setup-ws-' + Date.now(),
          controlType: 'select',
          stepType: 'new_session_workspace',
          question: '1. Selecciona espacio de trabajo:',
          options: wsOptions,
          placeholder: 'Selecciona espacio de trabajo...',
          preselect: String(session.workspace_id || wsOptions[0]?.value || ''),
        },
        _key: 'ctrl-setup-ws-' + Date.now(),
      })
    }
  }

  function _decSessionCount(sid) {
    if (!sid) return
    const cnt = _sessionCmdCount.value[sid]
    if (cnt === undefined || cnt === null) return
    const next = cnt - 1
    if (next <= 0) {
      delete _sessionCmdCount.value[sid]
    } else {
      _sessionCmdCount.value[sid] = next
    }
  }

  async function _saveCommandMessages(sid, cmdRaw, cmdResult) {
    if (!sid || !cmdRaw.startsWith('/')) return
    try {
      const toSave = [{ role: 'command', content: cmdRaw }]
      if (cmdResult !== undefined && cmdResult !== null) {
        toSave.push({ role: 'result', content: String(cmdResult) })
      }
      await fetch(`${API}/chat/sessions/${sid}/save-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages: toSave }),
      })
    } catch (err) {
      console.error('Error al guardar mensajes de comando:', err)
    }
  }

  async function runCommand(raw, executeFn) {
    const sid = activeSessionId.value
    executingCount.value++
    if (sid) {
      _sessionCmdCount.value[sid] = (_sessionCmdCount.value[sid] || 0) + 1
      sessionStatus.value[sid] = 'executing'
    }
    const cmdKey = 'cmd-' + Date.now()
    const loadingKey = 'loading-' + Date.now()

    messages.value.push({ role: 'command', content: raw, _key: cmdKey })
    flashLed(sid)
    const loadingIdx = messages.value.length
    messages.value.push({ role: 'result', content: '⏳ Ejecutando comando...', _key: loadingKey })
    flashLed(sid)

    try {
      const result = await executeFn(loadingIdx, sid)

      // Silent execution — command message hidden, persistence skipped, but live output shown
      const isSilent = result && typeof result === 'object' && result.__silent === true

      if (!isSilent) {
        await _saveCommandMessages(sid, raw, result)
        if (sid && raw.startsWith('/')) {
          try {
            await fetch(`${API}/command/history`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ command: raw, sessionId: sid }),
            })
          } catch (err) {
            console.error('Error al guardar en command_history:', err)
          }
        }
      }

      if (Number(activeSessionId.value) === Number(sid)) {
        if (isSilent) {
          const cmdIdx = messages.value.findIndex(m => m._key === cmdKey)
          if (cmdIdx >= 0) messages.value.splice(cmdIdx, 1)
          const idx = messages.value.findIndex(m => m._key === loadingKey)
          if (idx >= 0) {
            const output = result.output !== undefined ? String(result.output) : null
            if (output !== null) {
              messages.value[idx] = { role: 'result', content: output, _key: 'result-' + Date.now() }
            } else {
              messages.value.splice(idx, 1)
            }
            flashLed(sid)
          }
        } else {
          const idx = messages.value.findIndex(m => m._key === loadingKey)
          if (idx >= 0) {
            if (result !== undefined && result !== null) {
              if (typeof result === 'object' && result.role) {
                messages.value[idx] = { ...result, _key: 'result-' + Date.now() }
              } else {
                messages.value[idx] = { role: 'result', content: String(result), _key: 'result-' + Date.now() }
              }
            } else {
              messages.value.splice(idx, 1)
            }
            flashLed(sid)
          }
        }
      } else if (sid && !isSilent) {
        pendingNotifications.value[sid] = Date.now()
      }
      _decSessionCount(sid)
      if (sid && !_sessionCmdCount.value[sid] && sessionStatus.value[sid] !== 'error') {
        sessionStatus.value[sid] = 'idle'
      }
    } catch (err) {
      console.error('Error ejecutando comando:', err)
      const errorResult = 'Error: ' + (err.message || 'Error desconocido')
      if (!(err.__silent === true)) {
        await _saveCommandMessages(sid, raw, errorResult)
        if (sid && raw.startsWith('/')) {
          try {
            await fetch(`${API}/command/history`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ command: raw, sessionId: sid }),
            })
          } catch (err) {
            console.error('Error al guardar en command_history:', err)
          }
        }
      }
      if (Number(activeSessionId.value) === Number(sid)) {
        const idx = messages.value.findIndex(m => m._key === loadingKey)
        if (idx >= 0) {
          messages.value[idx] = { role: 'result', content: errorResult, _key: 'err-' + Date.now() }
          flashLed(sid)
        }
      } else if (sid && !(err.__silent === true)) {
        pendingNotifications.value[sid] = Date.now()
      }
      _decSessionCount(sid)
      if (sid) sessionStatus.value[sid] = 'error'
    } finally {
      executingCount.value--
    }
  }

  async function _saveMessageToDb(sessionId, msg) {
    if (!sessionId) return
    try {
      await fetch(`${API}/chat/sessions/${sessionId}/save-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages: [msg] }),
      })
    } catch (err) {
      console.error('Error al guardar mensaje en BD:', err)
    }
  }

  function clearPendingNotification(sessionId) {
    if (sessionId) {
      delete pendingNotifications.value[sessionId]
    }
  }

  let _saveTimer = null
  function saveUiState() {
    // Sync to sessionStorage (instant, survives F5)
    if (activeSessionId.value) {
      sessionStorage.setItem(SESSION_KEY, String(activeSessionId.value))
    } else {
      sessionStorage.removeItem(SESSION_KEY)
    }
    // Async save to backend (debounced, for cross-tab)
    if (_saveTimer) clearTimeout(_saveTimer)
    _saveTimer = setTimeout(async () => {
      try {
        const auth = useAuthStore()
        await wsClient.send('memoria:set', {
          namespace: 'ui_state',
          key: `user_${auth.user?.id}`,
          value: { activeSessionId: activeSessionId.value },
          ttl: 86400,
        })
      } catch (err) {
        console.error('Error saving UI state:', err)
      }
    }, 1000)
  }

  async function loadMessages(sessionId) {
    activeSessionId.value = sessionId
    const session = sessions.value.find(s => Number(s.id) === Number(sessionId))
    if (session && session.cwd) {
      const { useCommandStore } = await import('../stores/command.js')
      const cmdStore = useCommandStore()
      cmdStore.setDirectory(session.cwd)
    }
    messages.value = []
    clearPendingNotification(sessionId)
    loadingMore.value = false
    hasMoreMessages.value = true
    oldestMessageId.value = null
    const cache = _sessionStreamCache.value[sessionId]
    if (cache && _streamingSessions.value[sessionId]) {
      currentChunk.value = cache.chunk || ''
      currentThinking.value = cache.thinking || ''
    } else {
      currentChunk.value = ''
      currentThinking.value = ''
    }
    try {
      const res = await fetch(`${API}/chat/sessions/${sessionId}/messages?limit=50`, { credentials: 'include' })
      const data = await res.json()
      if (data.error) {
        console.error('Error al cargar mensajes:', data.error)
        return
      }
      if (Number(data.sessionId) === Number(activeSessionId.value)) {
        messages.value = data.messages.map(m => {
          if (m.role === 'opencode_control' && !m.controlData && typeof m.content === 'string') {
            try {
              const parsed = JSON.parse(m.content)
              m.controlData = parsed
        } catch (e) {
          console.error('Error parsing controlData from DB:', e.message)
        }
          }
          return m
        })
        hasMoreMessages.value = data.hasMore !== false
        if (messages.value.length > 0) {
          oldestMessageId.value = messages.value[0].id
        }
      }
      const ocCache = _ocSessionStreamCache.value[sessionId]
      if (ocCache && _ocStreamingSessions.value[sessionId]) {
        messages.value.push({
          role: 'opencode_stream',
          content: ocCache.chunk || '',
          thinking: ocCache.thinking || null,
          streaming: true,
          _key: ocCache.msgKey || 'stream-oc-' + Date.now(),
        })
      }
      const cmdCache = _cmdSessionStreamCache.value[sessionId]
      if (cmdCache && _cmdStreamingSessions.value[sessionId]) {
        messages.value.push({
          role: 'result',
          content: cmdCache.content || '⏳ Ejecutando...',
          _key: cmdCache.streamKey,
          streaming: true,
        })
      }
    } catch (err) {
      console.error('Error al cargar mensajes:', err)
    }
  }

  async function loadMoreMessages(sessionId) {
    if (loadingMore.value || !hasMoreMessages.value || !oldestMessageId.value) return
    loadingMore.value = true
    try {
      const res = await fetch(`${API}/chat/sessions/${sessionId}/messages?limit=50&before=${oldestMessageId.value}`, { credentials: 'include' })
      const data = await res.json()
      if (data.error) {
        console.error('Error al cargar más mensajes:', data.error)
        return
      }
      if (Number(data.sessionId) === Number(activeSessionId.value)) {
        const mapped = data.messages.map(m => {
          if (m.role === 'opencode_control' && !m.controlData && typeof m.content === 'string') {
            try {
              const parsed = JSON.parse(m.content)
              m.controlData = parsed
        } catch (e) {
          console.error('Error parsing controlData from DB:', e.message)
        }
          }
          return m
        })
        messages.value = [...mapped, ...messages.value]
        hasMoreMessages.value = data.hasMore !== false
        if (mapped.length > 0) {
          oldestMessageId.value = mapped[0].id
        } else {
          hasMoreMessages.value = false
        }
      }
    } catch (err) {
      console.error('Error al cargar más mensajes:', err)
    } finally {
      loadingMore.value = false
    }
  }

  async function sendMessage(sessionId, message) {
    messages.value.push({ role: 'user', content: message })
    flashLed(sessionId)
    _streamingSessions.value[sessionId] = true
    currentChunk.value = ''
    currentThinking.value = ''
    sessionStatus.value[sessionId] = 'executing'

    if (!_sessionStreamCache.value[sessionId]) {
      _sessionStreamCache.value[sessionId] = { chunk: '', thinking: '' }
    }
    const cache = _sessionStreamCache.value[sessionId]
    cache.chunk = ''
    cache.thinking = ''

    try {
      const res = await fetch(`${API}/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message }),
      })

      if (!res.ok) {
        const errData = await res.json()
        sessionStatus.value[sessionId] = 'error'
        delete _streamingSessions.value[sessionId]
        if (res.status === 404) {
          if (Number(activeSessionId.value) === Number(sessionId)) {
            activeSessionId.value = null
            messages.value = []
          }
          delete _sessionStreamCache.value[sessionId]
          delete pendingNotifications.value[sessionId]
          await loadSessions()
          return
        }
        if (Number(activeSessionId.value) === Number(sessionId)) {
          currentChunk.value = `\n\n[Error: ${errData.error || res.statusText}]`
        }
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        const last = lines.pop()
        buffer = last !== undefined ? last : ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          try {
            const json = JSON.parse(trimmed.slice(6))
            const isActive = Number(activeSessionId.value) === Number(sessionId)
            if (json.type === 'thinking') {
              cache.thinking += json.content
              if (isActive) currentThinking.value += json.content
            } else if (json.type === 'response') {
              cache.chunk += json.content
              if (isActive) currentChunk.value += json.content
            } else if (json.type === 'done') {
              sessionStatus.value[sessionId] = 'idle'
              delete _streamingSessions.value[sessionId]
              if (isActive) {
                messages.value.push({
                  role: 'assistant',
                  content: currentChunk.value,
                  thinking: currentThinking.value || null,
                })
                flashLed(sessionId)
                currentChunk.value = ''
                currentThinking.value = ''
              } else {
                pendingNotifications.value[sessionId] = Date.now()
              }
            } else if (json.type === 'error') {
              sessionStatus.value[sessionId] = 'error'
              delete _streamingSessions.value[sessionId]
              if (isActive) {
                currentChunk.value = `\n\n[Error: ${json.content}]`
              } else {
                pendingNotifications.value[sessionId] = Date.now()
              }
            }
          } catch (e) {
            if (e.message !== 'Unexpected end of JSON input') {
              console.error('Error parsing SSE chunk:', e.message)
            }
          }
        }
      }

      if (_streamingSessions.value[sessionId]) {
        sessionStatus.value[sessionId] = 'idle'
        delete _streamingSessions.value[sessionId]
        if (Number(activeSessionId.value) === Number(sessionId)) {
          messages.value.push({
            role: 'assistant',
            content: currentChunk.value,
            thinking: currentThinking.value || null,
          })
          flashLed(sessionId)
          currentChunk.value = ''
          currentThinking.value = ''
        } else {
          pendingNotifications.value[sessionId] = Date.now()
        }
      }

      await loadSessions()
    } catch (err) {
      console.error('Error en sendMessage:', err)
      sessionStatus.value[sessionId] = 'error'
      delete _streamingSessions.value[sessionId]
      if (Number(activeSessionId.value) === Number(sessionId)) {
        currentChunk.value = `\n\n[Error: ${err.message}]`
      }
    }
  }

  async function deleteMessage(sessionId, msg) {
    const key = msg.id || msg._key
    try {
      if (msg.id) {
        const res = await fetch(`${API}/chat/sessions/${sessionId}/messages/${msg.id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Error al eliminar mensaje')
        }
      }
      messages.value = messages.value.filter(m => (m.id || m._key) !== key)
    } catch (err) {
      console.error('Error al eliminar mensaje:', err)
    }
  }

  async function loadArchivedSessions() {
    try {
      const res = await fetch(`${API}/chat/sessions/archived`, { credentials: 'include' })
      const data = await res.json()
      if (data.error) {
        if (data.error !== 'Sesión no válida') {
          console.error('Error al cargar sesiones archivadas:', data.error)
        }
        return
      }
      archivedSessions.value = data.sessions
    } catch (err) {
      console.error('Error al cargar sesiones archivadas:', err)
    }
  }

  async function archiveSession(sessionId) {
    try {
      const res = await fetch(`${API}/chat/sessions/${sessionId}/archive`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        if (activeSessionId.value === sessionId) {
          activeSessionId.value = null
          messages.value = []
        }
        sessions.value = sessions.value.filter(s => Number(s.id) !== Number(sessionId))
        await loadArchivedSessions()
      }
    } catch (err) {
      console.error('Error al archivar sesión:', err)
    }
  }

  async function unarchiveSession(sessionId) {
    try {
      const res = await fetch(`${API}/chat/sessions/${sessionId}/unarchive`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        archivedSessions.value = archivedSessions.value.filter(s => Number(s.id) !== Number(sessionId))
        await loadSessions()
      }
    } catch (err) {
      console.error('Error al desarchivar sesión:', err)
    }
  }

  async function deleteSession(sessionId) {
    try {
      const res = await fetch(`${API}/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        if (activeSessionId.value === sessionId) {
          activeSessionId.value = null
          messages.value = []
        }
        try {
          const { useOpencodeStore } = await import('./opencode.js')
          const ocStore = useOpencodeStore()
          if (ocStore.sessionsMap[String(sessionId)]) {
            delete ocStore.sessionsMap[String(sessionId)]
          }
        } catch (e) {
          console.error('Error limpiando opencode para sesión eliminada:', e.message)
        }
    delete _streamingSessions.value[sessionId]
    delete _ocStreamingSessions.value[sessionId]
    delete _sessionStreamCache.value[sessionId]
    delete _ocSessionStreamCache.value[sessionId]
    delete pendingNotifications.value[sessionId]
    delete sessionTickets.value[sessionId]
    await loadSessions()
    await loadArchivedSessions()
      }
    } catch (err) {
      console.error('Error al eliminar sesión:', err)
    }
  }

  async function cloneSession(sessionId) {
    try {
      const res = await fetch(`${API}/chat/sessions/${sessionId}/clone`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        console.error('Error al clonar sesión:', data.error || 'Error desconocido')
        return
      }
      if (data.session) {
        sessions.value.unshift(data.session)
        return data.session
      }
    } catch (err) {
      console.error('Error al clonar sesión:', err)
    }
  }

  async function clearMessages(sessionId) {
    try {
      const res = await fetch(`${API}/chat/sessions/${sessionId}/messages`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Error al limpiar mensajes')
      }
      if (Number(activeSessionId.value) === Number(sessionId)) {
        messages.value = []
        currentChunk.value = ''
        currentThinking.value = ''
      }
    } catch (err) {
      console.error('Error al limpiar mensajes:', err)
    }
  }

  function stopAllExecutions() {
    creating.value = false
    executingCount.value = 0
    messages.value = []
    currentChunk.value = ''
    currentThinking.value = ''
    activeSessionId.value = null
    clearTimeout(_saveTimer)
    _sessionCmdCount.value = {}
    _streamingSessions.value = {}
    _ocStreamingSessions.value = {}
    sessionStatus.value = {}
    pendingNotifications.value = {}
    sessionTickets.value = {}
    _sessionStreamCache.value = {}
    _ocSessionStreamCache.value = {}
    _cmdStreamingSessions.value = {}
    _cmdSessionStreamCache.value = {}
    _cmdPendingSave.value = {}
    import('./opencode.js').then(({ useOpencodeStore }) => {
      try {
        const ocStore = useOpencodeStore()
        ocStore.resetAllSessionsExecutionState()
      } catch (e) {
        console.error('Error reseteando estado opencode en stopAllExecutions:', e.message)
      }
    }).catch(e => console.error('Error importando opencode store:', e.message))
  }

  async function pushMessage(msg, targetSessionId) {
    const sid = targetSessionId || activeSessionId.value
    flashLed(sid)
    if (!sid || Number(sid) === Number(activeSessionId.value)) {
      messages.value.push(msg)
    } else {
      await _saveMessageToDb(sid, msg)
    }
  }

  function updateMessageByKey(key, updates, targetSessionId) {
    if (targetSessionId && Number(targetSessionId) !== Number(activeSessionId.value)) return -1
    const idx = messages.value.findIndex(m => (m.id || m._key) === key)
    if (idx >= 0) {
      messages.value[idx] = { ...messages.value[idx], ...updates }
    }
    return idx
  }

  function updateMessageAt(idx, msg, targetSessionId) {
    if (targetSessionId && Number(targetSessionId) !== Number(activeSessionId.value)) return
    if (idx >= 0 && idx < messages.value.length) {
      messages.value[idx] = msg
    }
  }

  function spliceMessages(start, deleteCount, ...items) {
    if (deleteCount === undefined) {
      messages.value.splice(start)
    } else {
      messages.value.splice(start, deleteCount, ...items)
    }
  }

  function findMessageIndex(key, targetSessionId) {
    if (targetSessionId && Number(targetSessionId) !== Number(activeSessionId.value)) return -1
    return messages.value.findIndex(m => (m.id || m._key) === key)
  }

  function setSessionStatus(sid, status) {
    if (sid) sessionStatus.value[sid] = status
  }

  function setOcStreaming(sessionId, active) {
    if (!sessionId) return
    if (active) {
      _ocStreamingSessions.value[sessionId] = true
    } else {
      delete _ocStreamingSessions.value[sessionId]
    }
  }

  function getIsOcStreaming(sessionId) {
    if (!sessionId) return false
    return !!_ocStreamingSessions.value[String(sessionId)]
  }

  function updateOcStreamCache(sessionId, chunk, thinking, msgKey) {
    if (!sessionId) return
    if (!_ocSessionStreamCache.value[sessionId]) {
      _ocSessionStreamCache.value[sessionId] = { chunk: '', thinking: null, msgKey: null }
    }
    const cache = _ocSessionStreamCache.value[sessionId]
    cache.chunk = chunk
    cache.thinking = thinking
    if (msgKey) cache.msgKey = msgKey
  }

  function clearOcStreamCache(sessionId) {
    if (sessionId) delete _ocSessionStreamCache.value[sessionId]
  }

  function setCmdStreaming(sessionId, active) {
    if (!sessionId) return
    if (active) {
      _cmdStreamingSessions.value[sessionId] = true
    } else {
      delete _cmdStreamingSessions.value[sessionId]
    }
  }

  function updateCmdStreamCache(sessionId, content, streamKey) {
    if (!sessionId) return
    if (!_cmdSessionStreamCache.value[sessionId]) {
      _cmdSessionStreamCache.value[sessionId] = { content: '', streamKey: '' }
    }
    const cache = _cmdSessionStreamCache.value[sessionId]
    if (content !== undefined) cache.content = content
    if (streamKey) cache.streamKey = streamKey
  }

  function clearCmdStreamCache(sessionId) {
    if (sessionId) delete _cmdSessionStreamCache.value[sessionId]
  }

  function registerCmdPendingSave(sessionId, data) {
    if (!sessionId) return
    _cmdPendingSave.value[sessionId] = data
  }

  function consumeCmdPendingSave(sessionId) {
    if (!sessionId) return null
    const data = _cmdPendingSave.value[sessionId]
    delete _cmdPendingSave.value[sessionId]
    return data || null
  }

  function hasCmdPendingSave(sessionId) {
    return !!_cmdPendingSave.value[sessionId]
  }

  function flashLed(sessionId) {
    if (!sessionId) return
    ledFlash.value[sessionId] = true
    if (ledFlashTimers[sessionId]) clearTimeout(ledFlashTimers[sessionId])
    ledFlashTimers[sessionId] = setTimeout(() => {
      ledFlash.value[sessionId] = false
    }, 250)
  }

  function setSessionTicket(sessionId, ticket) {
    if (!sessionId) return
    sessionTickets.value[sessionId] = ticket
  }

  function clearSessionTicket(sessionId) {
    if (sessionId) delete sessionTickets.value[sessionId]
  }

  const activeSessionTicket = computed(() => {
    const sid = activeSessionId.value
    return sid ? sessionTickets.value[sid] || null : null
  })

  watch(activeSessionId, () => {
    saveUiState()
  })

  loadMaxTerminalsConfig()

  return {
    sessions, archivedSessions, activeSessionId, messages,
    streaming, creating, executing, sessionStatus, currentChunk, currentThinking,
    pendingNotifications,
    loadSessions, loadArchivedSessions, archiveSession, unarchiveSession,
    createSession, createSessionIfNeeded, runCommand, loadMessages, loadMoreMessages,
    loadingMore, hasMoreMessages,
    sendMessage, deleteMessage, deleteSession, cloneSession, clearMessages, stopAllExecutions,
    pushMessage, updateMessageByKey, updateMessageAt, spliceMessages, findMessageIndex, setSessionStatus,
    setOcStreaming, getIsOcStreaming, updateOcStreamCache, clearOcStreamCache,
    setCmdStreaming, updateCmdStreamCache, clearCmdStreamCache,
    registerCmdPendingSave, consumeCmdPendingSave, hasCmdPendingSave,
    sessionTickets, activeSessionTicket, setSessionTicket, clearSessionTicket,
    _saveMessageToDb, clearPendingNotification, ledFlash, flashLed, showTerminal,
    _terminalSessions, _terminalSessionId, terminalCwd, terminalInitCommand, terminalLabel, terminalId,
    _hasTerminal, openTerminal, closeTerminal, getTerminalCount, getTerminals,
    maxTerminalsLimit, loadMaxTerminalsConfig, setMaxTerminalsConfig,
    saveUiState,
  }
})
