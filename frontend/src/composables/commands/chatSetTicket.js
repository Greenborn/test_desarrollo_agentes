import { useCommandRegistry } from '../useCommandRegistry.js'
import { useChatStore } from '../../stores/chat.js'
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/chat_set_ticket',
  category: 'Proyecto',
  description: 'Asigna un ticket de Redmine a la sesión actual. El autocomplete se filtra por el proyecto asignado a la sesión.',
  usage: '/chat_set_ticket --id=&lt;id_ticket_redmine&gt;',
  async autocomplete(args, cmdStore) {
    const idArg = args.find(a => a.startsWith('--id='))
    if (idArg) {
      const val = idArg.slice('--id='.length)
      try {
        const chatStore = useChatStore()
        const activeSessionId = chatStore.activeSessionId
        let proyectoId = null

        if (activeSessionId) {
          const session = chatStore.sessions.find(s => s.id === activeSessionId)
          proyectoId = session?.proyecto_id || null
        }

        const res = await fetch('/api/tickets', { credentials: 'include' })
        const data = await res.json()

        if (!data.success || !data.tickets) {
          cmdStore.showAutocomplete([])
          return
        }

        let tickets = data.tickets
        if (proyectoId) {
          tickets = tickets.filter(t => t.proyecto_id === proyectoId)
        }

        const filtered = val ? tickets.filter(t => String(t.redmine_id).includes(val)) : tickets
        if (filtered.length === 0 || (val && filtered.length === 1 && String(filtered[0].redmine_id) === val)) {
          cmdStore.hideAutocomplete()
        } else {
          cmdStore.showAutocomplete(
            filtered.map(t => ({
              display: `#${t.redmine_id} — ${t.subject}`,
              value: `--id=${t.redmine_id}`,
            }))
          )
        }
      } catch (err) {
        console.error('Error en autocomplete de /chat_set_ticket:', err)
      }
    } else {
      cmdStore.showAutocomplete(['--id='])
    }
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const { params, errors } = parseCommandArgs(args, { id: { required: true, type: 'number' } })
    if (errors.length > 0) {
      throw new Error(errors.join('. '))
    }
    const idTicketRedmine = params.id

    try {
      const res = await fetch('/api/tickets/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId, idTicketRedmine: parseInt(idTicketRedmine) }),
      })
      const data = await res.json()
      if (data.success) {
        await chatStore.loadSessions()
        return `Ticket #${idTicketRedmine} asignado a la sesión actual.`
      }
      throw new Error(data.error || 'Error al asignar ticket')
    } catch (err) {
      console.error('Error en /chat_set_ticket:', err.message)
      throw new Error('Error de conexión al asignar ticket.')
    }
  },
})
