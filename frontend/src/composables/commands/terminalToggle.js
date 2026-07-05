import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/terminal',
  category: 'Sistema',
  description: 'Abre o reconecta una terminal interactiva (bash) en el panel de chat para la sesión actual.',
  usage: '/terminal',
  async execute(args, { chatStore, sessionId }) {
    chatStore.openTerminal({ sessionId })
  },
})
