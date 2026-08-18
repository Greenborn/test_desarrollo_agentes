import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/limpiar_sesion',
  category: 'Sistema',
  description: 'Vacía los mensajes de la sesión de chat actual y cierra todas las terminales y ventanas OpenCode de la sesión. La sesión se conserva.',
  usage: '/limpiar_sesion',
  async execute(args, { chatStore, sessionId }) {
    const sid = sessionId || chatStore.activeSessionId
    if (!sid) return 'No hay sesión activa.'
    await chatStore.limpiarSesion(sid)
    return 'Sesión de chat limpiada: mensajes eliminados y terminales/OpenCode cerrados.'
  },
})
