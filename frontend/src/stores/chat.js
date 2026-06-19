import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const API = '/api'

export const useChatStore = defineStore('chat', () => {
  const sessions = ref([])
  const activeSessionId = ref(null)
  const messages = ref([])
  const streaming = ref(false)
  const creating = ref(false)
  const executingCount = ref(0)
  const executing = computed(() => executingCount.value > 0)
  const _sessionCmdCount = ref({})
  const sessionStatus = ref({})
  const currentChunk = ref('')
  const currentThinking = ref('')

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
      const body = cwd ? JSON.stringify({ cwd }) : undefined
      const res = await fetch(`${API}/chat/sessions`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        credentials: 'include',
        body,
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
      const result = await executeFn(loadingIdx)
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
      }
      _decSessionCount(sid)
      if (sid && !_sessionCmdCount.value[sid] && sessionStatus.value[sid] !== 'error') {
        sessionStatus.value[sid] = 'idle'
      }
    } catch (err) {
      console.error('Error ejecutando comando:', err)
      if (Number(activeSessionId.value) === Number(sid)) {
        const idx = messages.value.findIndex(m => m._key === loadingKey)
        if (idx >= 0) {
          messages.value[idx] = { role: 'result', content: 'Error: ' + (err.message || 'Error desconocido'), _key: 'err-' + Date.now() }
        }
      }
      _decSessionCount(sid)
      if (sid) sessionStatus.value[sid] = 'error'
    } finally {
      executingCount.value--
    }
  }

  async function loadMessages(sessionId) {
    activeSessionId.value = sessionId
    messages.value = []
    currentChunk.value = ''
    currentThinking.value = ''
    try {
      const res = await fetch(`${API}/chat/sessions/${sessionId}/messages`, { credentials: 'include' })
      const data = await res.json()
      if (data.error) {
        console.error('Error al cargar mensajes:', data.error)
        return
      }
      if (Number(data.sessionId) === Number(activeSessionId.value)) {
        messages.value = data.messages
      }
    } catch (err) {
      console.error('Error al cargar mensajes:', err)
    }
  }

  async function sendMessage(sessionId, message) {
    messages.value.push({ role: 'user', content: message })
    streaming.value = true
    currentChunk.value = ''
    currentThinking.value = ''
    sessionStatus.value[sessionId] = 'executing'

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
        streaming.value = false
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
              if (isActive) currentThinking.value += json.content
            } else if (json.type === 'response') {
              if (isActive) currentChunk.value += json.content
            } else if (json.type === 'done') {
              sessionStatus.value[sessionId] = 'idle'
              streaming.value = false
              if (isActive) {
                messages.value.push({
                  role: 'assistant',
                  content: currentChunk.value,
                  thinking: currentThinking.value || null,
                })
                currentChunk.value = ''
                currentThinking.value = ''
              }
            } else if (json.type === 'error') {
              sessionStatus.value[sessionId] = 'error'
              streaming.value = false
              if (isActive) {
                currentChunk.value = `\n\n[Error: ${json.content}]`
              }
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      if (streaming.value) {
        sessionStatus.value[sessionId] = 'idle'
        streaming.value = false
        if (Number(activeSessionId.value) === Number(sessionId)) {
          messages.value.push({
            role: 'assistant',
            content: currentChunk.value,
            thinking: currentThinking.value || null,
          })
          currentChunk.value = ''
          currentThinking.value = ''
        }
      }

      await loadSessions()
    } catch (err) {
      console.error('Error en sendMessage:', err)
      sessionStatus.value[sessionId] = 'error'
      streaming.value = false
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
        await loadSessions()
      }
    } catch (err) {
      console.error('Error al eliminar sesión:', err)
    }
  }

  function stopAllExecutions() {
    streaming.value = false
    creating.value = false
    executingCount.value = 0
    messages.value = []
    currentChunk.value = ''
    currentThinking.value = ''
    activeSessionId.value = null
    _sessionCmdCount.value = {}
    sessionStatus.value = {}
  }

  function pushMessage(msg) {
    messages.value.push(msg)
  }

  function updateMessageByKey(key, updates) {
    const idx = messages.value.findIndex(m => (m.id || m._key) === key)
    if (idx >= 0) {
      messages.value[idx] = { ...messages.value[idx], ...updates }
    }
    return idx
  }

  function updateMessageAt(idx, msg) {
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

  function findMessageIndex(key) {
    return messages.value.findIndex(m => (m.id || m._key) === key)
  }

  function setSessionStatus(sid, status) {
    if (sid) sessionStatus.value[sid] = status
  }

  return {
    sessions, activeSessionId, messages,
    streaming, creating, executing, sessionStatus, currentChunk, currentThinking,
    loadSessions, createSession, createSessionIfNeeded, runCommand, loadMessages,
    sendMessage, deleteMessage, deleteSession, stopAllExecutions,
    pushMessage, updateMessageByKey, updateMessageAt, spliceMessages, findMessageIndex, setSessionStatus,
  }
})
