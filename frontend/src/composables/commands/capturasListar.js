import { useCommandRegistry } from '../useCommandRegistry.js';

const { register } = useCommandRegistry();

register({
  name: '/capturas_listar',
  category: 'Capturas',
  description: 'Lista las capturas de pantalla del proyecto vinculado a la sesión o de un proyecto específico.',
  usage: '/capturas_listar [proyecto_id]',
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    let proyectoId = args[0]
    if (!proyectoId) {
      const session = (chatStore.sessions || []).find(s => Number(s.id) === Number(sessionId))
      proyectoId = session?.proyecto_id
      if (!proyectoId) {
        throw new Error('No hay un proyecto vinculado a esta sesión. Especifique un proyecto_id como argumento.')
      }
    }

    const res = await fetch(`/api/archivos?proyecto_id=${encodeURIComponent(proyectoId)}&tipo=image/png&include_metadata=true`, {
      credentials: 'include',
    })

    const data = await res.json()

    if (!data.archivos || data.archivos.length === 0) {
      return `No hay capturas de pantalla para el proyecto "${proyectoId}".`
    }

    const parts = [`## Capturas - Proyecto: ${proyectoId}\n`]

    for (const a of data.archivos) {
      parts.push(`### ${a.nombre_original || `Captura #${a.id}`}`)
      parts.push(`_${a.created_at}_`)
      parts.push(`![${a.nombre_original || `Captura ${a.id}`}](/api/archivos/${a.id}/download)\n`)

      const notes = (a.metadata || []).filter(m => m.key === 'quick_notes')
      if (notes.length > 0) {
        parts.push('**Comentarios:**')
        for (const note of notes) {
          parts.push(`- ${note.value}`)
        }
      }

      parts.push('\n---\n')
    }

    return parts.join('\n')
  },
})
