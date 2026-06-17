import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/redmine_importar_tickets',
  category: 'Utilidades',
  description: 'Importa todos los tickets de Redmine de un proyecto o de todos los proyectos a la base de datos local.',
  usage: '/redmine_importar_tickets [id_proyecto|--all]',
  async autocomplete(args, cmdStore) {
    try {
      const res = await fetch('/api/proyecto', { credentials: 'include' })
      const data = await res.json()
      if (data.proyectos) {
        if (args.length > 0 && args[0].startsWith('--')) {
          cmdStore.showAutocomplete(['--all'])
        } else {
          cmdStore.showAutocomplete(['--all', ...data.proyectos.map((p) => p.id)])
        }
      }
    } catch (err) {
      console.error('Error en autocomplete de /redmine_importar_tickets:', err)
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

    const isAll = args.includes('--all')
    const proyectoId = isAll ? null : args[0]

    if (!isAll && !proyectoId) {
      chatStore.messages.push({
        role: 'result',
        content: 'Debe especificar el ID del proyecto o usar --all. Use Tab para ver las opciones disponibles.',
        _key: 'result-' + Date.now(),
      })
      return
    }

    chatStore.messages.push({
      role: 'command',
      content: '/redmine_importar_tickets ' + args.join(' '),
      _key: 'cmd-' + Date.now(),
    })

    const msgIdx = chatStore.messages.length
    chatStore.messages.push({
      role: 'result',
      content: 'Importando tickets desde Redmine...',
      _key: 'result-' + Date.now(),
    })

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
        chatStore.messages[msgIdx] = {
          role: 'result',
          content: data.message || 'Error al importar tickets.',
          _key: 'result-' + Date.now(),
        }
        return
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

      chatStore.messages[msgIdx] = {
        role: 'result',
        content: resultText,
        _key: 'result-' + Date.now(),
      }
    } catch (err) {
      console.error('Error en /redmine_importar_tickets:', err.message)
      chatStore.messages[msgIdx] = {
        role: 'result',
        content: 'Error de conexión al importar tickets de Redmine.',
        _key: 'result-' + Date.now(),
      }
    }
  },
})
