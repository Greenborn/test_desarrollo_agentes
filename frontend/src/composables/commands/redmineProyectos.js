import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/redmine_listar_proyectos',
  category: 'Utilidades',
  description: 'Lista proyectos disponibles en Redmine.',
  usage: '/redmine_listar_proyectos',
  autocomplete(args, cmdStore) {
    cmdStore.hideAutocomplete()
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    try {
      const res = await fetch('/api/redmine/proyectos', {
        method: 'GET',
        credentials: 'include',
      })
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.message || 'Error al obtener proyectos Redmine.')
      }

      if (!data.proyectos || data.proyectos.length === 0) {
        return '(sin proyectos disponibles)'
      }

      return {
        role: 'opencode_control',
        controlData: {
          controlType: 'redmine_projects',
          projects: data.proyectos,
        },
      }
    } catch (err) {
      console.error('Error en /redmine_listar_proyectos:', err.message)
      throw new Error('Error de conexión al procesar proyectos Redmine.')
    }
  },
})
