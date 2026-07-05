import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/terminal_cerrar',
  category: 'Sistema',
  description: 'Cierra la terminal de la sesión actual. Mata el proceso bash asociado.',
  usage: '/terminal_cerrar',
  async execute(args, { chatStore, sessionId }) {
    if (!chatStore.showTerminal || chatStore._terminalSessionId !== sessionId) {
      return 'No hay terminal activa en esta sesión.'
    }

    if (chatStore.terminalId) {
      try {
        await fetch(`/api/procesos/terminal/${chatStore.terminalId}`, {
          method: 'DELETE',
          credentials: 'include',
        })
      } catch (err) {
        console.log('[terminal_cerrar] Error al cerrar terminal vía API:', err.message)
      }
    }

    chatStore.closeTerminal()
  },
})
