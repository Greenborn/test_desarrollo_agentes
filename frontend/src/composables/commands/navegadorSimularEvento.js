import { useCommandRegistry } from '../useCommandRegistry.js';

const { register } = useCommandRegistry();

register({
  name: '/navegador_simular_evento',
  category: 'Navegador',
  description: 'Simula un evento DOM en un elemento de la página activa del navegador. Útil para pruebas automatizadas.',
  usage: '/navegador_simular_evento <selector> <tipo_evento> [opciones_json]',
  async execute(args, { chatStore, loadingIdx, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const selector = args[0]
    if (!selector) {
      throw new Error('Debe especificar un selector CSS. Ej: /navegador_simular_evento #miBoton click')
    }

    const eventType = args[1] || 'click'
    let eventInit = {}
    if (args[2]) {
      try {
        eventInit = JSON.parse(args[2])
      } catch (e) {
        throw new Error(`Opciones JSON inválidas: "${args[2]}". Debe ser un objeto JSON válido.`)
      }
    }

    chatStore.messages[loadingIdx].content = `Simulando evento "${eventType}" en "${selector}"...`

    const res = await fetch('/api/navegador/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        comando: 'simulate_event',
        parametros: { selector, event_type: eventType, event_init: eventInit },
        sessionId,
      }),
    })

    const data = await res.json()
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Error al simular evento')
    }

    return `🎯 Evento "${eventType}" simulado en "${selector}" correctamente.`
  },
})
