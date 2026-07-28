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
  <div v-else class="d-flex flex-column flex-grow-1 overflow-hidden px-2 py-1">
    <div class="d-flex pb-1 gap-1">
      <button v-if="hasPendingComments" class="btn btn-sm btn-outline-success py-0 px-2" style="font-size: 0.65rem;" @click="enviarComentariosPendientes">▶ Enviar pendientes</button>
      <button v-if="hasSentComments" class="btn btn-sm btn-outline-secondary ms-auto py-0 px-2" style="font-size: 0.65rem;" @click="deleteSentComments">Limpiar enviados</button>
    </div>
    <TableEditor
      :data="tableData"
      :config="tableConfig"
      style="min-height: 0; flex: 1;"
    />
  </div>
</template>

<script>
import { watch, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../../../stores/chat.js'
import { useRedmineCommentsStore } from '../../../stores/redmineComments.js'
import { useCommandRegistry } from '../../../composables/useCommandRegistry.js'
import TableEditor from '../../../components/TableEditor.vue'
import { BtnConfig } from '../../../components/BtnConfig.js'

export default {
  components: { TableEditor },
  setup() {
    const chat = useChatStore()
    const redmineComments = useRedmineCommentsStore()
    const { find } = useCommandRegistry()
    const { activeSessionId, sessions } = storeToRefs(chat)

    const activeSession = computed(() => {
      return sessions.value.find(s => Number(s.id) === Number(activeSessionId.value)) || null
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

    const fields_def = [
      { field: 'ticket_redmine_id', headerName: 'Ticket', width: '80px', sortable: true },
      { field: 'comentario', headerName: 'Comentario', sortable: false },
      { field: 'estado', headerName: 'Estado', width: '110px', sortable: true },
      { field: 'created_at', headerName: 'Fecha', width: '150px', sortable: true },
    ]

    const tableData = computed(() => ({
      rows: comments.value,
      fields_def,
    }))

    const tableConfig = computed(() => ({
      hideToolbar: true,
      selectionMode: null,
      striped: true,
      valueFormatters: {
        ticket_redmine_id: (row) => `#${row.ticket_redmine_id}`,
        comentario: (row) => {
          const text = row.comentario || ''
          const truncated = text.length > 120 ? text.substring(0, 120) + '…' : text
          return `<span title="${text.replace(/"/g, '&quot;')}">${truncated}</span>`
        },
        estado: (row) => {
          const cls = {
            pendiente: 'bg-warning text-dark',
            enviado: 'bg-success',
            error: 'bg-danger',
          }[row.estado] || 'bg-secondary'
          return `<span class="badge ${cls}">${row.estado}</span>`
        },
        created_at: (row) => formatDate(row.created_at),
      },
      buttons: {
        rowActions: [
          new BtnConfig({
            key: 'delete',
            icon: 'bi bi-trash',
            severity: 'btn-danger',
            label: '',
            onClick: (row) => deleteComment(row),
          }),
        ],
      },
    }))

    function formatDate(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
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
      sessionWithTicket,
      comments,
      loading,
      hasSentComments,
      hasPendingComments,
      tableData,
      tableConfig,
      enviarComentariosPendientes,
      deleteComment,
      deleteSentComments,
    }
  },
}
</script>
