import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/redmine_proyectos',
  category: 'Utilidades',
  description: 'Lista detallada de proyectos Redmine a los que se tiene acceso.',
  usage: '/redmine_proyectos',
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

    chatStore.messages.push({
      role: 'command',
      content: '/redmine_proyectos',
      _key: 'cmd-' + Date.now(),
    })

    const msgIdx = chatStore.messages.length
    chatStore.messages.push({
      role: 'result',
      content: 'Obteniendo proyectos desde Redmine...',
      _key: 'result-' + Date.now(),
    })

    try {
      const res = await fetch('/api/redmine/proyectos', {
        method: 'GET',
        credentials: 'include',
      })
      const data = await res.json()

      if (!data.success) {
        chatStore.messages[msgIdx] = {
          role: 'result',
          content: data.message || 'Error al obtener proyectos Redmine.',
          _key: 'result-' + Date.now(),
        }
        return
      }

      if (!data.proyectos || data.proyectos.length === 0) {
        chatStore.messages[msgIdx] = {
          role: 'result',
          content: '(sin proyectos disponibles)',
          _key: 'result-' + Date.now(),
        }
        return
      }

      chatStore.messages[msgIdx] = {
        role: 'opencode_control',
        content: '',
        controlData: {
          controlType: 'redmine_projects',
          projects: data.proyectos,
        },
        _key: 'result-' + Date.now(),
      }
    } catch (err) {
      console.error('Error en /redmine_proyectos:', err.message)
      chatStore.messages[msgIdx] = {
        role: 'result',
        content: 'Error de conexión al obtener proyectos Redmine.',
        _key: 'result-' + Date.now(),
      }
    }
  },
})
