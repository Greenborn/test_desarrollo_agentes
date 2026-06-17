import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/funcionalidades_listar',
  category: 'Desarrollo',
  description: 'Lista las funcionalidades del proyecto vinculado a la sesión o del especificado.',
  usage: '/funcionalidades_listar [id_proyecto]',
  async autocomplete(args, cmdStore) {
    try {
      const res = await fetch('/api/proyecto', { credentials: 'include' })
      const data = await res.json()
      if (data.proyectos) {
        cmdStore.showAutocomplete(data.proyectos.map(p => p.id))
      }
    } catch (err) {
      console.error('Error en autocomplete de /funcionalidades_listar:', err)
    }
  },
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    let proyectoId = args[0]

    if (!proyectoId) {
      try {
        const res = await fetch(`/api/proyecto/session/${sessionId}`, { credentials: 'include' })
        const data = await res.json()
        proyectoId = data.proyectoId
      } catch (err) {
        console.error('Error al obtener proyecto de sesión:', err)
      }
      if (!proyectoId) {
        throw new Error('No hay proyecto vinculado a la sesión. Usá /proyecto_set <id> o pasá el ID como argumento.')
      }
    }

    try {
      const res = await fetch(`/api/funcionalidades/${encodeURIComponent(proyectoId)}`, { credentials: 'include' })
      const data = await res.json()
      if (!data.funcionalidades || data.funcionalidades.length === 0) {
        return `No hay funcionalidades registradas para el proyecto "${proyectoId}".`
      }
      const listData = {
        controlType: 'funcionalidad_list',
        controlId: 'funcionalidad-list-' + Date.now(),
        items: data.funcionalidades.map(f => ({
          nombre: f.nombre,
          etapa: f.etapa,
          sessionId: f.session_id,
          proyectoId: proyectoId,
        })),
      }
      return {
        role: 'opencode_control',
        controlData: listData,
      }
    } catch (err) {
      console.error('Error en /funcionalidades_listar:', err)
      throw err
    }
  },
})
