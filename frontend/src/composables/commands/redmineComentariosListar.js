import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/dev_redmine_comentarios_listar',
  category: 'Desarrollo',
  description: 'Lista todos los comentarios de Redmine pendientes de envío.',
  usage: '/dev_redmine_comentarios_listar',
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    try {
      const res = await fetch('/api/redmine/comments?estado=pendiente', { credentials: 'include' })
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al obtener comentarios')
      }

      const comentarios = data.comentarios || []

      if (comentarios.length === 0) {
        return 'No hay comentarios de Redmine pendientes de envío.'
      }

      let output = `**Comentarios pendientes (${comentarios.length}):**\n\n`
      output += '| # | Ticket | Comentario | Creado |\n'
      output += '|---|---|---|---|\n'

      comentarios.forEach((c) => {
        const preview = c.comentario.length > 80
          ? c.comentario.slice(0, 80) + '...'
          : c.comentario
        const fecha = c.created_at
          ? new Date(c.created_at).toLocaleString()
          : '—'
        output += `| ${c.id} | #${c.ticket_redmine_id} | ${preview.replace(/\n/g, ' ')} | ${fecha} |\n`
      })

      return output
    } catch (err) {
      console.error('Error en /dev_redmine_comentarios_listar:', err.message)
      throw new Error('Error al listar comentarios: ' + err.message)
    }
  },
})
