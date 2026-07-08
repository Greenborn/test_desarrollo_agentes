import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/terminal_cerrar',
  category: 'Sistema',
  description: 'Cierra la terminal más reciente de la sesión actual. Mata el proceso bash asociado.',
  usage: '/terminal_cerrar',
  async execute(args, { chatStore, sessionId }) {
    const sid = sessionId || chatStore.activeSessionId
    if (!sid) return 'No hay sesión activa.'

    const terminals = chatStore.getTerminals(sid)
    if (terminals.length === 0) return 'No hay terminal activa en esta sesión.'

    const last = terminals[terminals.length - 1]
    if (last.terminalId) {
      try {
        await fetch(`/api/procesos/terminal/${last.terminalId}`, {
          method: 'DELETE',
          credentials: 'include',
        })
      } catch (err) {
        console.log('[terminal_cerrar] Error al cerrar terminal vía API:', err.message)
      }
    }

    chatStore.closeTerminal(last.terminalId)
  },
})
