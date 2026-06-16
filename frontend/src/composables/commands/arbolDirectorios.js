import { useCommandRegistry } from '../useCommandRegistry.js';

const { register } = useCommandRegistry();

register({
  name: '/arbol_directorios',
  category: 'Navegación',
  description: 'Muestra el árbol de directorios en formato JSON. Si no se especifica ruta, usa el directorio base de la sesión.',
  usage: '/arbol_directorios [ruta]',
  autocomplete(args, cmdStore) {
    const last = args.length > 0 ? args[args.length - 1] : ''
    if (last) {
      cmdStore.fetchAutocomplete(last, cmdStore.currentDir)
    } else if (cmdStore.currentDir) {
      cmdStore.fetchAutocomplete(cmdStore.currentDir, cmdStore.currentDir)
    }
  },
  async execute(args, { cmdStore, chatStore }) {
    const dir = args.join(' ')
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
      content: `/arbol_directorios ${dir}`,
      _key: 'cmd-' + Date.now(),
    })

    const msgIdx = chatStore.messages.length
    chatStore.messages.push({
      role: 'result',
      content: '⏳ Generando árbol de directorios...',
      _key: 'result-' + Date.now(),
    })

    try {
      const params = new URLSearchParams()
      if (dir) params.set('dir', dir)
      params.set('sessionId', sessionId)
      const res = await fetch(`/api/command/arbol-directorios?${params.toString()}`, { credentials: 'include' })
      const data = await res.json()

      if (!data.success) {
        chatStore.messages[msgIdx] = {
          role: 'result',
          content: 'Error: ' + (data.error || 'Error desconocido'),
          _key: 'err-' + Date.now(),
        }
        return
      }

      chatStore.messages[msgIdx] = {
        role: 'result',
        content: JSON.stringify(data.tree, null, 2),
        _key: 'result-' + Date.now(),
      }
    } catch (err) {
      console.error('Error en /arbol_directorios:', err)
      chatStore.messages[msgIdx] = {
        role: 'result',
        content: 'Error: ' + err.message,
        _key: 'err-' + Date.now(),
      }
    }
  },
})
