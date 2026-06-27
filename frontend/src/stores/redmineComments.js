import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useRedmineCommentsStore = defineStore('redmineComments', () => {
  const commentsBySession = ref({})
  const loadingBySession = ref({})
  const activeTicketBySession = ref({})

  async function loadComments(ticketRedmineId, sessionId) {
    if (!sessionId) return
    activeTicketBySession.value[sessionId] = ticketRedmineId
    loadingBySession.value[sessionId] = true
    try {
      let url = `/api/redmine/comments?ticket_redmine_id=${ticketRedmineId}&estado=todos`
      if (sessionId) url += `&sessionId=${sessionId}`
      const res = await fetch(url, { credentials: 'include' })
      const data = await res.json()
      commentsBySession.value[sessionId] = data.comentarios || []
    } catch (err) {
      console.error('Error al cargar comentarios Redmine:', err)
      commentsBySession.value[sessionId] = []
    } finally {
      loadingBySession.value[sessionId] = false
    }
  }

  async function refreshComments(sessionId) {
    if (sessionId && activeTicketBySession.value[sessionId]) {
      await loadComments(activeTicketBySession.value[sessionId], sessionId)
    }
  }

  async function queueComment(sessionId, ticketRedmineId, comentario) {
    const res = await fetch('/api/redmine/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ session_id: sessionId, ticket_redmine_id: ticketRedmineId, comentario }),
    })
    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error || 'Error al encolar comentario')
    }
    await loadComments(ticketRedmineId, sessionId)
    return data
  }

  async function deleteComment(commentId, sessionId) {
    const res = await fetch(`/api/redmine/comments/${commentId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Error al eliminar comentario')
    await refreshComments(sessionId)
    return data
  }

  function clearComments(sessionId) {
    if (sessionId) {
      delete commentsBySession.value[sessionId]
      delete loadingBySession.value[sessionId]
      delete activeTicketBySession.value[sessionId]
    } else {
      commentsBySession.value = {}
      loadingBySession.value = {}
      activeTicketBySession.value = {}
    }
  }

  return { commentsBySession, loadingBySession, activeTicketBySession, loadComments, refreshComments, queueComment, deleteComment, clearComments }
})
