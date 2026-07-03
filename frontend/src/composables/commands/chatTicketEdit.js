import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()
const ALL_FLAGS = ['--mode=']

register({
  name: '/chat_edit_ticket',
  category: 'Proyecto',
  description: 'Abre un editor inline para modificar los datos del ticket de Redmine asignado a la sesión actual. Con --mode=descripcion abre un textarea directo para editar la descripción.',
  usage: '/chat_edit_ticket [--mode=descripcion]',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)
    const suggestions = ALL_FLAGS.filter(f => {
      const base = f.split('=')[0]
      return !usedFlags.includes(f) && !usedFlags.includes(base)
    })
    if (suggestions.length > 0) {
      cmdStore.showAutocomplete(suggestions)
    } else {
      cmdStore.hideAutocomplete()
    }
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const res = await fetch(`/api/tickets/session/${sessionId}`, { credentials: 'include' })
    const data = await res.json()

    if (!data.idTicketRedmine || !data.ticket) {
      throw new Error('No hay ticket asignado a esta sesión.')
    }

    const { params } = parseCommandArgs(args, { mode: { required: false } })

    if (params.mode === 'descripcion') {
      return {
        role: 'opencode_control',
        controlData: {
          controlId: 'descripcion-edit-' + Date.now(),
          controlType: 'descripcion_edit',
          description: data.ticket.description || '',
          ticketSubject: data.ticket.subject || '',
          ticketId: data.idTicketRedmine,
          sessionId,
        },
      }
    }

    return {
      role: 'opencode_control',
      controlData: {
        controlType: 'ticket_edit',
        controlId: 'ticket-edit-' + Date.now(),
        ticket: data.ticket,
        sessionId,
      },
    }
  },
})
