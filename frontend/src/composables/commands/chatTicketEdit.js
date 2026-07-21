import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()
const MODE_VALUES = ['descripcion']

register({
  name: '/chat_edit_ticket',
  category: 'Proyecto',
  description: 'Abre un editor inline para modificar los datos del ticket de Redmine asignado a la sesión actual. Con --mode=descripcion abre un textarea directo para editar la descripción.',
  usage: '/chat_edit_ticket [--workspace=ID] [--mode=descripcion]',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)
    if (usedFlags.includes('--mode=')) {
      const modeArg = args.find(a => a.startsWith('--mode='))
      const val = modeArg.slice('--mode='.length)
      if (val && MODE_VALUES.includes(val)) {
        cmdStore.hideAutocomplete()
      } else {
        const filtered = MODE_VALUES.filter(v => v.startsWith(val))
        cmdStore.showAutocomplete(filtered.map(v => ({ display: v, value: `--mode=${v}` })))
      }
    } else if (usedFlags.includes('--workspace=')) {
      cmdStore.hideAutocomplete()
    } else {
      cmdStore.showAutocomplete(['--workspace=', '--mode='])
    }
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const { params } = parseCommandArgs(args, { workspace: { required: false }, mode: { required: false } })
    let wsId

    if (params.workspace) {
      wsId = parseInt(params.workspace, 10)
    } else {
      const { sessions } = chatStore
      const session = sessions.find(s => Number(s.id) === Number(sessionId))
      wsId = session?.workspace_id || null
    }

    let url = `/api/tickets/session/${sessionId}`
    if (wsId) url += `?wsId=${wsId}`

    const res = await fetch(url, { credentials: 'include' })
    const data = await res.json()

    if (!data.idTicketRedmine || !data.ticket) {
      throw new Error('No hay ticket asignado a esta sesión.')
    }

    const workspaceId = wsId || data.ticket.workspace_id || null

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
          workspaceId,
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
        workspaceId,
      },
    }
  },
})
