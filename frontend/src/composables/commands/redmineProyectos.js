import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/redmine_listar_proyectos',
  category: 'Utilidades',
  description: 'Lista proyectos Redmine. Con --import importa todos a la base de datos local.',
  usage: '/redmine_listar_proyectos [--import]',
  autocomplete(args, cmdStore) {
    if (!args.find(a => a.startsWith('--import'))) {
      cmdStore.showAutocomplete(['--import'])
    } else {
      cmdStore.hideAutocomplete()
    }
  },
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const { params } = parseCommandArgs(args, { import: { required: false } })
    const isImportAll = params.import === 'true'

    try {
      if (isImportAll) {
        const res = await fetch('/api/redmine/proyectos/import-all', {
          method: 'POST',
          credentials: 'include',
        })
        const data = await res.json()

        if (!data.success) {
          throw new Error(data.message || 'Error al importar proyectos.')
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

        return resultText || '(No se encontraron proyectos en Redmine)'
      } else {
        const res = await fetch('/api/redmine/proyectos', {
          method: 'GET',
          credentials: 'include',
        })
        const data = await res.json()

        if (!data.success) {
          throw new Error(data.message || 'Error al obtener proyectos Redmine.')
        }

        if (!data.proyectos || data.proyectos.length === 0) {
          return '(sin proyectos disponibles)'
        }

        return {
          role: 'opencode_control',
          controlData: {
            controlType: 'redmine_projects',
            projects: data.proyectos,
          },
        }
      }
    } catch (err) {
      console.error('Error en /redmine_listar_proyectos:', err.message)
      throw new Error('Error de conexión al procesar proyectos Redmine.')
    }
  },
})
