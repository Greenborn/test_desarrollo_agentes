import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/navegador_grabacion_listar',
  category: 'Navegador',
  description: 'Lista todas las grabaciones de eventos. Opcionalmente filtrar por proyecto. Si no se especifica proyecto, usa el asignado a la sesión de chat actual.',
  usage: '/navegador_grabacion_listar [--project_id=<id>]',
  async autocomplete(args, cmdStore) {
    const projArg = args.find(a => a.startsWith('--project_id='))
    if (!projArg) {
      cmdStore.showAutocomplete(['--project_id='])
    } else {
      cmdStore.hideAutocomplete()
    }
  },
  async execute(args, { chatStore, sessionId }) {
    const { params } = parseCommandArgs(args, { project_id: { required: false } })

    let projectId = params.project_id
    if (!projectId) {
      const session = chatStore.sessions.find(s => s.id === sessionId)
      projectId = session?.proyecto_id || null
    }

    const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''
    const res = await fetch(`/api/playwright-logs/event-recordings${query}`, {
      credentials: 'include',
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Error al listar grabaciones')
    }

    const data = await res.json()
    const recordings = data.recordings || []

    if (recordings.length === 0) {
      const scope = projectId ? ` para el proyecto "${projectId}"` : ''
      return `No hay grabaciones${scope}.`
    }

    const lines = recordings.map(r => {
      const proj = r.project_id ? ` [${r.project_id}]` : ''
      return `  #${r.id} "${r.name}"${proj} — ${r.event_count} eventos — ${r.created_at}`
    })

    const filterInfo = projectId ? ` del proyecto "${projectId}"` : ''
    return `Grabaciones${filterInfo} (${recordings.length}):\n${lines.join('\n')}`
  },
})
