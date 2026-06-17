import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/redmine_proyectos',
  category: 'Utilidades',
  description: 'Lista proyectos Redmine. Con import_all importa todos a la base de datos local.',
  usage: '/redmine_proyectos [import_all]',
  autocomplete(args, cmdStore) {
    if (args.length === 0 || (args.length === 1 && !args[0].startsWith('import'))) {
      cmdStore.showAutocomplete(['import_all'])
    } else {
      cmdStore.hideAutocomplete()
    }
  },
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId
    if (!sessionId) {
      chatStore.messages.push({
        role: 'result',
        content: 'Primero debe iniciar una sesión de chat.',
        _key: 'result-' + Date.now(),
      })
      return
    }

    const isImportAll = args.includes('import_all')

    chatStore.messages.push({
      role: 'command',
      content: '/redmine_proyectos' + (isImportAll ? ' import_all' : ''),
      _key: 'cmd-' + Date.now(),
    })

    const msgIdx = chatStore.messages.length
    chatStore.messages.push({
      role: 'result',
      content: isImportAll ? 'Importando todos los proyectos desde Redmine...' : 'Obteniendo proyectos desde Redmine...',
      _key: 'result-' + Date.now(),
    })

    try {
      if (isImportAll) {
        const res = await fetch('/api/redmine/proyectos/import-all', {
          method: 'POST',
          credentials: 'include',
        })
        const data = await res.json()

        if (!data.success) {
          chatStore.messages[msgIdx] = {
            role: 'result',
            content: data.message || 'Error al importar proyectos.',
            _key: 'result-' + Date.now(),
          }
          return
        }

        let resultText = ''

        if (data.importados.length > 0) {
          resultText += `**Proyectos importados (${data.importados.length}):**\n`
          resultText += data.importados.map(p => `- ${p.name} (${p.identifier})`).join('\n')
        }

        if (data.yaExistentes.length > 0) {
          if (resultText) resultText += '\n\n'
          resultText += `**Proyectos ya existentes en la base de datos (${data.yaExistentes.length}):**\n`
          resultText += data.yaExistentes.map(p => `- ${p.name} (${p.identifier})`).join('\n')
        }

        if (data.errores.length > 0) {
          if (resultText) resultText += '\n\n'
          resultText += `**Errores al importar (${data.errores.length}):**\n`
          resultText += data.errores.map(p => `- ${p.name}: ${p.error}`).join('\n')
        }

        if (!resultText) {
          resultText = '(No se encontraron proyectos en Redmine)'
        }

        chatStore.messages[msgIdx] = {
          role: 'result',
          content: resultText,
          _key: 'result-' + Date.now(),
        }
      } else {
        const res = await fetch('/api/redmine/proyectos', {
          method: 'GET',
          credentials: 'include',
        })
        const data = await res.json()

        if (!data.success) {
          chatStore.messages[msgIdx] = {
            role: 'result',
            content: data.message || 'Error al obtener proyectos Redmine.',
            _key: 'result-' + Date.now(),
          }
          return
        }

        if (!data.proyectos || data.proyectos.length === 0) {
          chatStore.messages[msgIdx] = {
            role: 'result',
            content: '(sin proyectos disponibles)',
            _key: 'result-' + Date.now(),
          }
          return
        }

        chatStore.messages[msgIdx] = {
          role: 'opencode_control',
          content: '',
          controlData: {
            controlType: 'redmine_projects',
            projects: data.proyectos,
          },
          _key: 'result-' + Date.now(),
        }
      }
    } catch (err) {
      console.error('Error en /redmine_proyectos:', err.message)
      chatStore.messages[msgIdx] = {
        role: 'result',
        content: 'Error de conexión al procesar proyectos Redmine.',
        _key: 'result-' + Date.now(),
      }
    }
  },
})
