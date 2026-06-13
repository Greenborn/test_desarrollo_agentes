import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useSocket } from '../composables/useSocket.js'

export const useChatStore = defineStore('chat', () => {
  const sessions = ref([])
  const activeSessionId = ref(null)
  const messages = ref([])
  const streaming = ref(false)
  const currentChunk = ref('')
  const currentThinking = ref('')
  const socket = useSocket()

  socket.on('chat:sessions_res', ({ sessions: data }) => {
    sessions.value = data
  })

  socket.on('chat:create_res', ({ session }) => {
    sessions.value.unshift(session)
    activeSessionId.value = session.id
    messages.value = []
  })

  socket.on('chat:load_res', ({ sessionId, messages: data }) => {
    if (sessionId === activeSessionId.value) {
      messages.value = data
    }
  })

  socket.on('chat:chunk', ({ sessionId, type, content }) => {
    if (sessionId !== activeSessionId.value) return
    streaming.value = true
    if (type === 'thinking') {
      currentThinking.value += content
    } else {
      currentChunk.value += content
    }
  })

  socket.on('chat:done', ({ sessionId }) => {
    if (sessionId === activeSessionId.value) {
      messages.value.push({
        role: 'assistant',
        content: currentChunk.value,
        thinking: currentThinking.value || null,
      })
      currentChunk.value = ''
      currentThinking.value = ''
      streaming.value = false
    }
  })

  socket.on('chat:delete_res', ({ sessionId }) => {
    if (activeSessionId.value === sessionId) {
      activeSessionId.value = null
      messages.value = []
    }
  })

  function loadSessions() {
    socket.emit('chat:sessions')
  }

  function createSession() {
    socket.emit('chat:create')
  }

  function loadMessages(sessionId) {
    activeSessionId.value = sessionId
    messages.value = []
    currentChunk.value = ''
    currentThinking.value = ''
    socket.emit('chat:load', { sessionId })
  }

  function sendMessage(sessionId, message) {
    messages.value.push({ role: 'user', content: message })
    socket.emit('chat:send', { sessionId, message })
  }

  function deleteSession(sessionId) {
    socket.emit('chat:delete', { sessionId })
  }

  return {
    sessions, activeSessionId, messages,
    streaming, currentChunk, currentThinking,
    loadSessions, createSession, loadMessages,
    sendMessage, deleteSession,
  }
})
