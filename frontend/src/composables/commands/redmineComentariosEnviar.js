import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/dev_redmine_comentarios_enviar',
  category: 'Desarrollo',
  description: 'Agrupa los comentarios pendientes, muestra vista previa editable y permite enviarlos a Redmine.',
  usage: '/dev_redmine_comentarios_enviar',
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

      const ticketIds = [...new Set(comentarios.map(c => c.ticket_redmine_id))]
      if (ticketIds.length > 1) {
        return `Los comentarios pendientes pertenecen a ${ticketIds.length} tickets distintos (${ticketIds.map(id => '#' + id).join(', ')}). Deben enviarse por separado. Usá /dev_redmine_comentarios_listar para identificarlos.`
      }

      const combined = comentarios.map((c) => c.comentario.trim()).join('\n')

      chatStore.pushMessage({
        role: 'opencode_control',
        controlData: {
          controlId: 'rm-comments-send-' + Date.now(),
          controlType: 'redmine_comments_send',
          comentarios_ids: comentarios.map(c => c.id),
          ticket_redmine_id: ticketIds[0],
          mensaje: combined,
          cantidad: comentarios.length,
        },
        _key: 'control-' + Date.now(),
      })
    } catch (err) {
      console.error('Error en /dev_redmine_comentarios_enviar:', err.message)
      throw new Error('Error al preparar envío de comentarios: ' + err.message)
    }
  },
})
