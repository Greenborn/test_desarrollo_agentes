import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useRedmineCommentsStore = defineStore('redmineComments', () => {
  const comments = ref([])
  const loading = ref(false)
  const activeTicketId = ref(null)

  async function loadComments(ticketRedmineId, sessionId) {
    activeTicketId.value = ticketRedmineId
    loading.value = true
    try {
      let url = `/api/redmine/comments?ticket_redmine_id=${ticketRedmineId}&estado=todos`
      if (sessionId) url += `&sessionId=${sessionId}`
      const res = await fetch(url, { credentials: 'include' })
      const data = await res.json()
      comments.value = data.comentarios || []
    } catch (err) {
      console.error('Error al cargar comentarios Redmine:', err)
      comments.value = []
    } finally {
      loading.value = false
    }
  }

  async function refreshComments() {
    if (activeTicketId.value) {
      await loadComments(activeTicketId.value)
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

  function clearComments() {
    comments.value = []
    activeTicketId.value = null
  }

  return { comments, loading, activeTicketId, loadComments, refreshComments, queueComment, clearComments }
})
