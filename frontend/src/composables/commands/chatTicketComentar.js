import { useCommandRegistry } from '../useCommandRegistry.js'
import { useSettingsStore } from '../../stores/settings.js'

const { register } = useCommandRegistry()

register({
  name: '/chat_ticket_comentar',
  category: 'Proyecto',
  description: 'Abre un editor inline para agregar un comentario al ticket de Redmine vinculado a la sesión. El comentario se pega tal cual (sin formato de commit). Se puede encolar o enviar directamente.',
  usage: '/chat_ticket_comentar',
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const settings = useSettingsStore()

    const res = await fetch(`/api/tickets/session/${sessionId}`, { credentials: 'include' })
    const data = await res.json()

    if (!data.idTicketRedmine || !data.ticket) {
      throw new Error('No hay ticket asignado a esta sesión. Usá /chat_set_ticket para asignar uno.')
    }

    return {
      role: 'opencode_control',
      controlData: {
        controlId: 'ticket-comment-' + Date.now(),
        controlType: 'ticket_comment',
        ticketId: data.ticket.redmine_id,
        sessionId,
        modo_envio: settings.defaultCommentModeTicket || 'encolar',
      },
    }
  },
})
