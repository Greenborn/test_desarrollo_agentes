import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/terminal',
  category: 'Sistema',
  description: 'Abre una terminal interactiva (bash) en el panel de chat. Permite ejecutar comandos del sistema directamente desde el navegador.',
  usage: '/terminal',
  async execute(args, { cmdStore, chatStore, sessionId }) {
    const chat = chatStore
    const msgs = chat.messages
    let terminalMsg = null
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]
      if (m.controlData && m.controlData.controlType === 'terminal') {
        terminalMsg = m
        break
      }
    }
    if (terminalMsg) {
      const idx = chat.messages.indexOf(terminalMsg)
      if (idx >= 0) chat.messages.splice(idx, 1)
    } else {
      chat.pushMessage({
        role: 'opencode_control',
        controlData: {
          controlId: 'terminal-' + Date.now(),
          controlType: 'terminal',
          content: null,
        },
        _key: 'term-' + Date.now(),
      }, sessionId)
    }
  },
})
