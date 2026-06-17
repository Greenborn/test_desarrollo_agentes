import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/redmine_tickets',
  category: 'Utilidades',
  description: 'Obtiene la lista de tickets de Redmine para un proyecto importado.',
  usage: '/redmine_tickets <id_proyecto>',
  async autocomplete(args, cmdStore) {
    try {
      const res = await fetch('/api/proyecto', { credentials: 'include' })
      const data = await res.json()
      if (data.proyectos) {
        cmdStore.showAutocomplete(data.proyectos.map((p) => p.id))
      }
    } catch (err) {
      console.error('Error en autocomplete de /redmine_tickets:', err)
    }
  },
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const proyectoId = args[0]
    if (!proyectoId) {
      throw new Error('Debe especificar el ID del proyecto. Use Tab para ver las opciones disponibles.')
    }

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
