import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/redmine_importar_proyectos',
  category: 'Utilidades',
  description: 'Importa proyectos de Redmine a la base de datos local. Usa --all para importar todos, --id para importar por ID de Redmine o --slug para importar por slug.',
  usage: '/redmine_importar_proyectos --all | --id=<redmine_id> | --slug=<slug>',
  autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)
    const allFlags = ['--all', '--id=', '--slug=']
    const suggestions = allFlags.filter(f => !usedFlags.includes(f))
    if (suggestions.length > 0) {
      cmdStore.showAutocomplete(suggestions)
    } else {
      cmdStore.hideAutocomplete()
    }
  },
  async execute(args, { chatStore, projectStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const { params } = parseCommandArgs(args, {
      all: { required: false },
      id: { required: false },
      slug: { required: false },
    })

    const isAll = params.all === 'true'
    const redmineId = params.id
    const slug = params.slug

    if (!isAll && !redmineId && !slug) {
      throw new Error('Debe especificar --all, --id=<redmine_id> o --slug=<slug>')
    }

    try {
      if (isAll) {
        const res = await fetch('/api/redmine/proyectos/import-all', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        const data = await res.json()

        if (!data.success) {
          throw new Error(data.message || 'Error al importar proyectos.')
        }

        let resultText = ''

        if (data.importados && data.importados.length > 0) {
          resultText += `**Proyectos importados (${data.importados.length}):**\n`
          resultText += data.importados.map(p => `- ${p.name} (${p.identifier})`).join('\n')
        }

        if (data.yaExistentes && data.yaExistentes.length > 0) {
          if (resultText) resultText += '\n\n'
          resultText += `**Proyectos ya existentes actualizados (${data.yaExistentes.length}):**\n`
          resultText += data.yaExistentes.map(p => `- ${p.name} (${p.identifier})`).join('\n')
        }

        if (data.errores && data.errores.length > 0) {
          if (resultText) resultText += '\n\n'
          resultText += `**Errores al importar (${data.errores.length}):**\n`
          resultText += data.errores.map(p => `- ${p.name}: ${p.error}`).join('\n')
        }

        if (projectStore) await projectStore.loadProjects()
        return resultText || '(No se encontraron proyectos en Redmine)'
      }

      const listRes = await fetch('/api/redmine/proyectos', {
        method: 'GET',
        credentials: 'include',
      })
      const listData = await listRes.json()

      if (!listData.success) {
        throw new Error(listData.message || 'Error al obtener proyectos Redmine.')
      }

      let match
      if (redmineId) {
        match = (listData.proyectos || []).find(p => String(p.id) === String(redmineId))
        if (!match) {
          throw new Error(`No se encontró proyecto con ID de Redmine ${redmineId}.`)
        }
      } else if (slug) {
        match = (listData.proyectos || []).find(p => p.slug === slug)
        if (!match) {
          throw new Error(`No se encontró proyecto con slug "${slug}". Use /redmine_listar_proyectos para ver los slugs disponibles.`)
        }
      }

      const importRes = await fetch('/api/redmine/proyectos/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: match.id,
          name: match.name,
          description: match.description,
          status: match.status,
          created_on: match.created_on,
          updated_on: match.updated_on,
          parent: match.parent,
          sessionId,
        }),
      })
      const importData = await importRes.json()

      if (!importData.success) {
        throw new Error(importData.message || 'Error al importar proyecto.')
      }

      if (projectStore) await projectStore.loadProjects()

      if (importData.action === 'updated') {
        return `Proyecto **${match.name}** (${match.identifier}) actualizado correctamente.`
      }

      return `Proyecto **${match.name}** (${match.identifier}) importado correctamente.`
    } catch (err) {
      console.error('Error en /redmine_importar_proyectos:', err.message)
      throw new Error('Error de conexión al importar proyectos Redmine.')
    }
  },
})
