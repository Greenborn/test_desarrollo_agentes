import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/chat_get_ticket',
  category: 'Proyecto',
  description: 'Muestra el ticket de Redmine asignado a la sesión actual. Con --comments muestra también los comentarios. Con --field=<campo> muestra solo el valor de un campo específico.',
  usage: '/chat_get_ticket [--comments] [--field=<campo>]',
  async autocomplete(args, cmdStore) {
    const FIELD_OPTIONS = [
      'redmine_id', 'subject', 'description', 'status_name',
      'priority_name', 'assigned_to_name', 'proyecto_id',
      'tracker_name', 'author_name', 'start_date', 'due_date',
      'estimated_hours', 'done_ratio', 'fixed_version_name',
      'redmine_created_on', 'redmine_updated_on', 'redmine_closed_on',
      'idTicketRedmine',
    ]

    for (const arg of args) {
      if (arg.startsWith('--field')) {
        const eqIdx = arg.indexOf('=')
        if (eqIdx >= 0) {
          const partial = arg.slice(eqIdx + 1)
          const filtered = FIELD_OPTIONS.filter(f => f.startsWith(partial))
          if (filtered.length > 0) {
            cmdStore.showAutocomplete(filtered.map(f => ({ display: f, value: `--field=${f}` })))
          } else {
            cmdStore.hideAutocomplete()
          }
        } else {
          cmdStore.showAutocomplete(['--field='])
        }
        return
      }
    }

    const usedFlags = getUsedFlags(args)
    const available = []
    if (!usedFlags.includes('--comments')) available.push('--comments')
    if (!usedFlags.includes('--field=')) available.push('--field=')
    if (available.length > 0) {
      cmdStore.showAutocomplete(available)
    } else {
      cmdStore.hideAutocomplete()
    }
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const { params } = parseCommandArgs(args, { comments: { required: false }, field: { required: false } })
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

      if (params.field) {
        const value = t[params.field] !== undefined ? t[params.field] : data[params.field]
        if (value === undefined) {
          return `Campo "${params.field}" no encontrado en el ticket.`
        }
        return `${value}`
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
