import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/redmine_tickets',
  category: 'Utilidades',
  description: 'Obtiene la lista de tickets de Redmine para un proyecto importado.',
  usage: '/redmine_tickets --id=&lt;id_proyecto&gt;',
  async autocomplete(args, cmdStore) {
    const idArg = args.find(a => a.startsWith('--id='))
    if (idArg) {
      const val = idArg.slice('--id='.length)
      try {
        const res = await fetch('/api/proyecto', { credentials: 'include' })
        const data = await res.json()
        if (data.proyectos) {
          const prefix = val.toLowerCase()
          const filtered = data.proyectos.filter(p => p.id.toLowerCase().includes(prefix))
          if (val && filtered.length === 1 && filtered[0].id === val) {
            cmdStore.hideAutocomplete()
          } else {
            cmdStore.showAutocomplete(filtered.map(p => ({ display: p.id, value: `--id=${p.id}` })))
          }
        }
      } catch (err) {
        console.error('Error en autocomplete de /redmine_tickets:', err)
      }
    } else {
      cmdStore.showAutocomplete(['--id='])
    }
  },
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const { params, errors } = parseCommandArgs(args, { id: { required: true } })
    if (errors.length > 0) {
      throw new Error(errors.join('. '))
    }
    const proyectoId = params.id

    try {
      const res = await fetch(`/api/redmine/proyectos/${encodeURIComponent(proyectoId)}/tickets`, { credentials: 'include' })
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.message || 'Error al obtener tickets.')
      }

      if (!data.tickets || data.tickets.length === 0) {
        return `(no hay tickets registrados en Redmine para el proyecto "${proyectoId}")`
      }

      const header = `**Tickets de "${proyectoId}" (total: ${data.total}):**\n\n`
      const tableHeader = '| # | Asunto | Estado | Prioridad | Asignado |\n|---|---|---|---|---|\n'
      const rows = data.tickets.map((t) => {
        const asignado = t.assigned_to || '—'
        const asunto = t.subject.length > 60 ? t.subject.slice(0, 57) + '...' : t.subject
        return `| ${t.id} | ${asunto} | ${t.status} | ${t.priority} | ${asignado} |`
      }).join('\n')

      return header + tableHeader + rows
    } catch (err) {
      console.error('Error en /redmine_tickets:', err.message)
      throw new Error('Error de conexión al obtener tickets de Redmine.')
    }
  },
})
