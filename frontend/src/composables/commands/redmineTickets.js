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
      chatStore.messages.push({
        role: 'result',
        content: 'Primero debe iniciar una sesión de chat.',
        _key: 'result-' + Date.now(),
      })
      return
    }

    const proyectoId = args[0]
    if (!proyectoId) {
      chatStore.messages.push({
        role: 'result',
        content: 'Debe especificar el ID del proyecto. Use Tab para ver las opciones disponibles.',
        _key: 'result-' + Date.now(),
      })
      return
    }

    chatStore.messages.push({
      role: 'command',
      content: '/redmine_tickets ' + proyectoId,
      _key: 'cmd-' + Date.now(),
    })

    const msgIdx = chatStore.messages.length
    chatStore.messages.push({
      role: 'result',
      content: 'Buscando tickets en Redmine...',
      _key: 'result-' + Date.now(),
    })

    try {
      const res = await fetch(`/api/redmine/proyectos/${encodeURIComponent(proyectoId)}/tickets`, { credentials: 'include' })
      const data = await res.json()

      if (!data.success) {
        chatStore.messages[msgIdx] = {
          role: 'result',
          content: data.message || 'Error al obtener tickets.',
          _key: 'result-' + Date.now(),
        }
        return
      }

      if (!data.tickets || data.tickets.length === 0) {
        chatStore.messages[msgIdx] = {
          role: 'result',
          content: `(no hay tickets registrados en Redmine para el proyecto "${proyectoId}")`,
          _key: 'result-' + Date.now(),
        }
        return
      }

      const header = `**Tickets de "${proyectoId}" (total: ${data.total}):**\n\n`
      const tableHeader = '| # | Asunto | Estado | Prioridad | Asignado |\n|---|---|---|---|---|\n'
      const rows = data.tickets.map((t) => {
        const asignado = t.assigned_to || '—'
        const asunto = t.subject.length > 60 ? t.subject.slice(0, 57) + '...' : t.subject
        return `| ${t.id} | ${asunto} | ${t.status} | ${t.priority} | ${asignado} |`
      }).join('\n')

      chatStore.messages[msgIdx] = {
        role: 'result',
        content: header + tableHeader + rows,
        _key: 'result-' + Date.now(),
      }
    } catch (err) {
      console.error('Error en /redmine_tickets:', err.message)
      chatStore.messages[msgIdx] = {
        role: 'result',
        content: 'Error de conexión al obtener tickets de Redmine.',
        _key: 'result-' + Date.now(),
      }
    }
  },
})
