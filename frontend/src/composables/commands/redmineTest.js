import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/redmine_test',
  category: 'Utilidades',
  description: 'Prueba la conexión a la instancia de Redmine configurada.',
  usage: '/redmine_test',
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
      content: '/redmine_test',
      _key: 'cmd-' + Date.now(),
    })

    const msgIdx = chatStore.messages.length
    chatStore.messages.push({
      role: 'result',
      content: 'Probando conexión a Redmine...',
      _key: 'result-' + Date.now(),
    })

    try {
      const res = await fetch('/api/redmine/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      const data = await res.json()

      chatStore.messages[msgIdx] = {
        role: 'result',
        content: data.message,
        _key: 'result-' + Date.now(),
      }
    } catch (err) {
      console.error('Error en /redmine_test:', err.message)
      chatStore.messages[msgIdx] = {
        role: 'result',
        content: 'Error de conexión al intentar probar Redmine.',
        _key: 'result-' + Date.now(),
      }
    }
  },
})
