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
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    try {
      const res = await fetch('/api/redmine/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      const data = await res.json()
      return data.message
    } catch (err) {
      console.error('Error en /redmine_test:', err.message)
      throw new Error('Error de conexión al intentar probar Redmine.')
    }
  },
})
