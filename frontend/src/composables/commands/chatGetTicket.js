import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/chat_get_ticket',
  category: 'Proyecto',
  description: 'Muestra el ticket de Redmine asignado a la sesión actual. Con --comments muestra también los comentarios.',
  usage: '/chat_get_ticket [--comments]',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)
    if (usedFlags.includes('--comments')) {
      cmdStore.hideAutocomplete()
    } else {
      cmdStore.showAutocomplete(['--comments'])
    }
  },
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const { params } = parseCommandArgs(args, { comments: { required: false } })
    const showComments = params.comments === 'true'

    try {
      const url = `/api/tickets/session/${sessionId}${showComments ? '?comments=true' : ''}`
      const res = await fetch(url, { credentials: 'include' })
      const data = await res.json()

      if (!data.idTicketRedmine) {
        return 'No hay ticket asignado a esta sesión.'
      }

      const t = data.ticket
      if (!t) {
        return `Ticket #${data.idTicketRedmine} asignado (no encontrado en base de datos local).`
      }

      let output = (
        `**Ticket asignado:** #${t.redmine_id} — ${t.subject}\n\n` +
        `- **Proyecto:** ${t.proyecto_id}\n` +
        `- **Estado:** ${t.status_name || '—'}\n` +
        `- **Prioridad:** ${t.priority_name || '—'}\n` +
        `- **Asignado a:** ${t.assigned_to_name || '—'}\n`
      )

      if (t.description) {
        output += `\n**Descripción:**\n${t.description}`
      }

      if (data.attachments && data.attachments.length > 0) {
        output += '\n\n**Adjuntos:**\n'
        data.attachments.forEach(a => {
          const isImage = a.content_type && a.content_type.startsWith('image/')
          const downloadUrl = `/api/tickets/attachments/${a.id}/download`
          if (isImage) {
            output += `\n![${a.filename}](${downloadUrl})\n[⬇ ${a.filename}](${downloadUrl})\n`
          } else {
            output += `\n[⬇ ${a.filename}](${downloadUrl}) (${(a.filesize / 1024).toFixed(1)} KB)\n`
          }
        })
      }

      if (showComments) {
        if (data.comments && data.comments.length > 0) {
          output += '\n\n**Comentarios:**\n'
          data.comments.forEach((c, i) => {
            output += `\n**${i + 1}. ${c.user}** (${new Date(c.created_on).toLocaleString()}):\n${c.notes}\n`
          })
        } else if (data.comments && data.comments.length === 0) {
          output += '\n\n*No hay comentarios en este ticket.*'
        } else {
          output += '\n\n*Error al obtener comentarios (verifique conexión con Redmine).*'
        }
      }

      return output
    } catch (err) {
      console.error('Error en /chat_get_ticket:', err.message)
      throw new Error('Error de conexión al obtener ticket de la sesión.')
    }
  },
})
