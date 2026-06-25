import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth.js'

const API = '/api'

export const useChatStore = defineStore('chat', () => {
  const sessions = ref([])
  const activeSessionId = ref(null)
  const messages = ref([])
  const creating = ref(false)
  const executingCount = ref(0)
  const _sessionCmdCount = ref({})
  const _streamingSessions = ref({})
  const sessionStatus = ref({})
  const currentChunk = ref('')
  const currentThinking = ref('')
  const pendingNotifications = ref({})
  const _sessionStreamCache = ref({})

  const streaming = computed(() => {
    const sid = activeSessionId.value
    return sid ? !!_streamingSessions.value[sid] : false
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
    const loadingKey = 'loading-' + Date.now()

    messages.value.push({ role: 'command', content: raw, _key: 'cmd-' + Date.now() })
    const loadingIdx = messages.value.length
    messages.value.push({ role: 'result', content: '⏳ Ejecutando comando...', _key: loadingKey })

    try {
      const result = await executeFn(loadingIdx, sid)
      await _saveCommandMessages(sid, raw, result)
      if (Number(activeSessionId.value) === Number(sid)) {
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
        }
      } else if (sid) {
        pendingNotifications.value[sid] = Date.now()
      }
      _decSessionCount(sid)
      if (sid && !_sessionCmdCount.value[sid] && sessionStatus.value[sid] !== 'error') {
        sessionStatus.value[sid] = 'idle'
      }
    } catch (err) {
      console.error('Error ejecutando comando:', err)
      const errorResult = 'Error: ' + (err.message || 'Error desconocido')
      await _saveCommandMessages(sid, raw, errorResult)
      if (Number(activeSessionId.value) === Number(sid)) {
        const idx = messages.value.findIndex(m => m._key === loadingKey)
        if (idx >= 0) {
          messages.value[idx] = { role: 'result', content: errorResult, _key: 'err-' + Date.now() }
        }
      } else if (sid) {
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

  async function loadMessages(sessionId) {
    activeSessionId.value = sessionId
    messages.value = []
    clearPendingNotification(sessionId)
    const cache = _sessionStreamCache.value[sessionId]
    if (cache && _streamingSessions.value[sessionId]) {
      currentChunk.value = cache.chunk || ''
      currentThinking.value = cache.thinking || ''
    } else {
      currentChunk.value = ''
      currentThinking.value = ''
    }
    try {
      const res = await fetch(`${API}/chat/sessions/${sessionId}/messages`, { credentials: 'include' })
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
            } catch {}
          }
          return m
        })
      }
    } catch (err) {
      console.error('Error al cargar mensajes:', err)
    }
  }

  async function sendMessage(sessionId, message) {
    messages.value.push({ role: 'user', content: message })
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
          } catch {
            // skip malformed chunks
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
        delete _streamingSessions.value[sessionId]
        delete _sessionStreamCache.value[sessionId]
        delete pendingNotifications.value[sessionId]
        await loadSessions()
      }
    } catch (err) {
      console.error('Error al eliminar sesión:', err)
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
    _sessionCmdCount.value = {}
    _streamingSessions.value = {}
    sessionStatus.value = {}
    pendingNotifications.value = {}
    _sessionStreamCache.value = {}
  }

  async function pushMessage(msg, targetSessionId) {
    const sid = targetSessionId || activeSessionId.value
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

  return {
    sessions, activeSessionId, messages,
    streaming, creating, executing, sessionStatus, currentChunk, currentThinking,
    pendingNotifications,
    loadSessions, createSession, createSessionIfNeeded, runCommand, loadMessages,
    sendMessage, deleteMessage, deleteSession, clearMessages, stopAllExecutions,
    pushMessage, updateMessageByKey, updateMessageAt, spliceMessages, findMessageIndex, setSessionStatus,
    _saveMessageToDb, clearPendingNotification,
  }
})
