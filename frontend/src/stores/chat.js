import { defineStore } from 'pinia'
import { ref } from 'vue'

const API = '/api'

export const useChatStore = defineStore('chat', () => {
  const sessions = ref([])
  const activeSessionId = ref(null)
  const messages = ref([])
  const streaming = ref(false)
  const creating = ref(false)
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

  async function createSession() {
    creating.value = true
    try {
      const res = await fetch(`${API}/chat/sessions`, {
        method: 'POST',
        credentials: 'include',
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
      if (data.sessionId === activeSessionId.value) {
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

    try {
      const res = await fetch(`${API}/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message }),
      })

      if (!res.ok) {
        const errData = await res.json()
        currentChunk.value = `\n\n[Error: ${errData.error || res.statusText}]`
        streaming.value = false
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
            if (json.type === 'thinking') {
              currentThinking.value += json.content
            } else if (json.type === 'response') {
              currentChunk.value += json.content
            } else if (json.type === 'done') {
              messages.value.push({
                role: 'assistant',
                content: currentChunk.value,
                thinking: currentThinking.value || null,
              })
              currentChunk.value = ''
              currentThinking.value = ''
              streaming.value = false
            } else if (json.type === 'error') {
              currentChunk.value = `\n\n[Error: ${json.content}]`
              streaming.value = false
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      if (streaming.value) {
        messages.value.push({
          role: 'assistant',
          content: currentChunk.value,
          thinking: currentThinking.value || null,
        })
        currentChunk.value = ''
        currentThinking.value = ''
        streaming.value = false
      }

      await loadSessions()
    } catch (err) {
      console.error('Error en sendMessage:', err)
      currentChunk.value = `\n\n[Error: ${err.message}]`
      streaming.value = false
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

  return {
    sessions, activeSessionId, messages,
    streaming, creating, currentChunk, currentThinking,
    loadSessions, createSession, loadMessages,
    sendMessage, deleteSession,
  }
})
