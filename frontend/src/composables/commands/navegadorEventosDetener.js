import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/navegador_eventos_detener',
  category: 'Navegador',
  description: 'Detiene la grabación de eventos de usuario en el navegador. Los listeners permanecen pero no registran nuevos eventos hasta volver a iniciar.',
  usage: '/navegador_eventos_detener',
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const res = await fetch('/api/navegador/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        comando: 'stop_event_recording',
        parametros: {},
        sessionId,
      }),
    })
    const data = await res.json()

    if (data.error) {
      throw new Error(data.error)
    }

    return 'Grabación de eventos detenida'
  },
})
