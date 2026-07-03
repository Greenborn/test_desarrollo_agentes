import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/terminal',
  category: 'Sistema',
  description: 'Abre una terminal interactiva (bash) en el panel de chat. Permite ejecutar comandos del sistema directamente desde el navegador.',
  usage: '/terminal',
  async execute(args, { chatStore }) {
    if (chatStore.showTerminal) {
      chatStore.closeTerminal()
    } else {
      chatStore.openTerminal()
    }
  },
})
