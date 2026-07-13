<template>
  <div v-if="!sessionWithTicket" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
    <span v-if="!activeSession">Seleccione una sesión de chat</span>
    <span v-else>Sin ticket vinculado a esta sesión</span>
  </div>
  <div v-else-if="loading" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small">
    <span>Cargando comentarios…</span>
  </div>
  <div v-else-if="comments.length === 0" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
    <span>No hay comentarios encolados para este ticket</span>
  </div>
  <div v-else class="comments-list flex-grow-1 overflow-y-auto px-2 py-1">
    <div v-if="comments.length > 0" class="d-flex px-1 pb-1 gap-1">
      <button v-if="hasPendingComments" class="btn btn-sm btn-outline-success py-0 px-2" style="font-size: 0.65rem;" @click="enviarComentariosPendientes">▶ Enviar pendientes</button>
      <button v-if="hasSentComments" class="btn btn-sm btn-outline-secondary ms-auto py-0 px-2" style="font-size: 0.65rem;" @click="deleteSentComments">Limpiar enviados</button>
    </div>
    <div v-for="c in comments" :key="c.id" class="comment-item d-flex flex-column px-2 py-2 mb-1 rounded">
      <button class="delete-btn" @click.stop="deleteComment(c)" title="Eliminar comentario">×</button>
      <div class="d-flex align-items-center gap-1 mb-1">
        <span class="badge" :class="badgeClass(c.estado)">{{ c.estado }}</span>
        <span class="text-muted" style="font-size: 0.65rem;">#{{ c.ticket_redmine_id }}</span>
        <span class="ms-auto text-muted" style="font-size: 0.6rem;">{{ formatDate(c.created_at) }}</span>
      </div>
      <div class="comment-preview text-light small text-truncate">{{ c.comentario }}</div>
    </div>
  </div>
</template>

<script>
import { watch, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../../stores/chat.js'
import { useRedmineCommentsStore } from '../../stores/redmineComments.js'
import { useCommandRegistry } from '../../composables/useCommandRegistry.js'

export default {
  setup() {
    const chat = useChatStore()
    const redmineComments = useRedmineCommentsStore()
    const { find } = useCommandRegistry()
    const { activeSessionId, sessions } = storeToRefs(chat)

    const activeSession = computed(() => {
      return sessions.value.find(s => s.id === activeSessionId.value) || null
    })

    const activeTicketId = computed(() => activeSession.value?.id_ticket_redmine || null)

    const sessionWithTicket = computed(() => {
      return activeSession.value?.id_ticket_redmine || null
    })

    const comments = computed(() => {
      const list = redmineComments.commentsByTicket[activeTicketId.value] || []
      return [...list].sort((a, b) => {
        if (a.estado === 'pendiente' && b.estado !== 'pendiente') return -1
        if (a.estado !== 'pendiente' && b.estado === 'pendiente') return 1
        return new Date(a.created_at) - new Date(b.created_at)
      })
    })

    const loading = computed(() => redmineComments.loadingByTicket[activeTicketId.value] || false)
    const hasSentComments = computed(() => comments.value.some(c => c.estado === 'enviado'))
    const hasPendingComments = computed(() => comments.value.some(c => c.estado === 'pendiente'))

    function formatDate(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    }

    function badgeClass(estado) {
      return {
        pendiente: 'bg-warning text-dark',
        enviado: 'bg-success',
        error: 'bg-danger',
      }[estado] || 'bg-secondary'
    }

    async function enviarComentariosPendientes() {
      const sid = activeSessionId.value
      if (!sid) return

      const cmd = find('/dev_redmine_comentarios_enviar')
      if (!cmd) {
        console.error('Comando /dev_redmine_comentarios_enviar no encontrado')
        return
      }

      await chat.runCommand('/dev_redmine_comentarios_enviar', async (loadingIdx, sessionId) => {
        return cmd.execute([], { chatStore: chat, sessionId })
      })
    }

    async function deleteComment(c) {
      if (!confirm('¿Eliminar este comentario?')) return
      try {
        await redmineComments.deleteComment(c.id, activeTicketId.value)
      } catch (err) {
        console.error('Error al eliminar comentario:', err)
      }
    }

    async function deleteSentComments() {
      if (!confirm('¿Eliminar todos los comentarios ya enviados?')) return
      try {
        await redmineComments.deleteSentComments(activeTicketId.value)
      } catch (err) {
        console.error('Error al eliminar comentarios enviados:', err)
      }
    }

    watch(activeSessionId, (newId) => {
      if (newId) {
        const session = sessions.value.find(s => s.id === newId)
        if (session?.id_ticket_redmine) {
          redmineComments.loadComments(session.id_ticket_redmine)
        } else {
          redmineComments.clearComments()
        }
      }
    })

    return {
      activeSession,
      sessionWithTicket,
      comments,
      loading,
      hasSentComments,
      hasPendingComments,
      formatDate,
      badgeClass,
      enviarComentariosPendientes,
      deleteComment,
      deleteSentComments,
    }
  },
}
</script>

<style scoped>
.comments-list {
  background: #16213e;
}
.comment-item {
  background: #1a2744;
  border: 1px solid #374151;
  position: relative;
}
.comment-item:hover {
  background: #1e3050;
}
.delete-btn {
  display: none;
  position: absolute;
  top: 2px;
  right: 2px;
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0 4px;
  line-height: 1.2;
  border-radius: 3px;
  z-index: 2;
}
.comment-item:hover .delete-btn {
  display: block;
}
.delete-btn:hover {
  background: rgba(239, 68, 68, 0.15);
}
.comment-preview {
  font-size: 0.7rem;
  line-height: 1.3;
  color: #cbd5e1;
}
</style>
