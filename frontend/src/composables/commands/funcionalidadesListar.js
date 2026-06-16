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
      chatStore.messages.push({
        role: 'result',
        content: 'Primero debe iniciar una sesión de chat.',
        _key: 'err-' + Date.now(),
      })
      return
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
        chatStore.messages.push({
          role: 'result',
          content: 'No hay proyecto vinculado a la sesión. Usá /proyecto_set <id> o pasá el ID como argumento.',
          _key: 'err-' + Date.now(),
        })
        return
      }
    }

    chatStore.messages.push({
      role: 'command',
      content: `/funcionalidades_listar ${args.join(' ')}`,
      _key: 'cmd-' + Date.now(),
    })

    try {
      const res = await fetch(`/api/funcionalidades/${encodeURIComponent(proyectoId)}`, { credentials: 'include' })
      const data = await res.json()
      if (!data.funcionalidades || data.funcionalidades.length === 0) {
        chatStore.messages.push({
          role: 'result',
          content: `No hay funcionalidades registradas para el proyecto "${proyectoId}".`,
          _key: 'res-' + Date.now(),
        })
        return
      }
      const lista = data.funcionalidades.map(f => `- ${f.nombre}`).join('\n')
      chatStore.messages.push({
        role: 'result',
        content: `**Funcionalidades de "${proyectoId}":**\n\n${lista}`,
        _key: 'res-' + Date.now(),
      })
    } catch (err) {
      console.error('Error en /funcionalidades_listar:', err)
      chatStore.messages.push({
        role: 'result',
        content: 'Error: ' + err.message,
        _key: 'err-' + Date.now(),
      })
    }
  },
})
