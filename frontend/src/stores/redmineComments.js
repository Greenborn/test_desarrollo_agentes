import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useRedmineCommentsStore = defineStore('redmineComments', () => {
  const commentsByTicket = ref({})
  const loadingByTicket = ref({})

  async function loadComments(ticketRedmineId) {
    if (!ticketRedmineId) return
    loadingByTicket.value[ticketRedmineId] = true
    try {
      const url = `/api/redmine/comments?ticket_redmine_id=${ticketRedmineId}&estado=todos`
      const res = await fetch(url, { credentials: 'include' })
      const data = await res.json()
      commentsByTicket.value[ticketRedmineId] = data.comentarios || []
    } catch (err) {
      console.error('Error al cargar comentarios Redmine:', err)
      commentsByTicket.value[ticketRedmineId] = []
    } finally {
      loadingByTicket.value[ticketRedmineId] = false
    }
  }

  async function refreshComments(ticketRedmineId) {
    if (ticketRedmineId) {
      await loadComments(ticketRedmineId)
    }
  }

  async function queueComment(sessionId, ticketRedmineId, comentario, tipo) {
    const payload = { session_id: sessionId, ticket_redmine_id: ticketRedmineId, comentario }
    if (tipo) payload.tipo = tipo
    const res = await fetch('/api/redmine/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error || 'Error al encolar comentario')
    }
    await loadComments(ticketRedmineId)
    return data
  }

  async function deleteComment(commentId, ticketRedmineId) {
    const res = await fetch(`/api/redmine/comments/${commentId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Error al eliminar comentario')
    await refreshComments(ticketRedmineId)
    return data
  }

  function clearComments(ticketRedmineId) {
    if (ticketRedmineId) {
      delete commentsByTicket.value[ticketRedmineId]
      delete loadingByTicket.value[ticketRedmineId]
    } else {
      commentsByTicket.value = {}
      loadingByTicket.value = {}
    }
  }

  async function deleteSentComments(ticketRedmineId) {
    const res = await fetch('/api/redmine/comments/sent', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ticket_redmine_id: ticketRedmineId }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Error al eliminar comentarios enviados')
    await refreshComments(ticketRedmineId)
    return data
  }

  function reset() {
    commentsByTicket.value = {}
    loadingByTicket.value = {}
  }

  return { commentsByTicket, loadingByTicket, loadComments, refreshComments, queueComment, deleteComment, deleteSentComments, clearComments, reset }
})
