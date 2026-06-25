import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/redmine_importar_tickets',
  category: 'Utilidades',
  description: 'Importa todos los tickets de Redmine de un proyecto o de todos los proyectos a la base de datos local.',
  usage: '/redmine_importar_tickets [--id=&lt;id_proyecto&gt;|--all]',
  async autocomplete(args, cmdStore) {
    const idArg = args.find(a => a.startsWith('--id='))
    const allArg = args.find(a => a.startsWith('--all'))
    if (idArg) {
      const val = idArg.slice('--id='.length)
      try {
        const res = await fetch('/api/proyecto', { credentials: 'include' })
        const data = await res.json()
        if (data.proyectos) {
          const prefix = val.toLowerCase()
          const filtered = data.proyectos.filter(p => p.id.toLowerCase().includes(prefix))
          if (val && filtered.length === 1 && filtered[0].id === val) {
            cmdStore.hideAutocomplete()
          } else {
            cmdStore.showAutocomplete(filtered.map(p => ({ display: p.id, value: `--id=${p.id}` })))
          }
        }
      } catch (err) {
        console.error('Error en autocomplete de /redmine_importar_tickets:', err)
      }
    } else {
      cmdStore.showAutocomplete(allArg ? ['--id='] : ['--all', '--id='])
    }
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const { params, errors } = parseCommandArgs(args, { id: { required: false }, all: { required: false } })
    if (errors.length > 0) {
      throw new Error(errors.join('. '))
    }
    const isAll = params.all === 'true'
    const proyectoId = isAll ? null : params.id

    if (!isAll && !proyectoId) {
      throw new Error('Debe especificar --id=&lt;id_proyecto&gt; o --all. Use Tab para ver las opciones disponibles.')
    }

    try {
      let url
      if (isAll) {
        url = '/api/redmine/proyectos/importar-tickets-all'
      } else {
        url = `/api/redmine/proyectos/${encodeURIComponent(proyectoId)}/importar-tickets`
      }

      const res = await fetch(url, { method: 'POST', credentials: 'include' })
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.message || 'Error al importar tickets.')
      }

      let resultText = ''

      if (isAll) {
        resultText += `**Importación masiva completada (${data.total_proyectos} proyectos):**\n\n`
        for (const r of data.resultados) {
          if (r.error) {
            resultText += `- **${r.proyecto_id}**: Error — ${r.error}\n`
          } else {
            resultText += `- **${r.proyecto_id}**: ${r.importados} nuevos, ${r.actualizados} actualizados (${r.total_redmine} en Redmine)\n`
          }
        }
        resultText += `\n**Totales:** ${data.totales.importados} importados, ${data.totales.actualizados} actualizados`
      } else {
        resultText += `**Tickets importados para "${proyectoId}":**\n`
        resultText += `- Importados nuevos: ${data.importados}\n`
        resultText += `- Actualizados: ${data.actualizados}\n`
        resultText += `- Total en Redmine: ${data.total_redmine}`
      }

      return resultText
    } catch (err) {
      console.error('Error en /redmine_importar_tickets:', err.message)
      throw new Error('Error de conexión al importar tickets de Redmine.')
    }
  },
})
