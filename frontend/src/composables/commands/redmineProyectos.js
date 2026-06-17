import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatStatus(status) {
  if (status === 1) return 'activo'
  if (status === 5) return 'archivado'
  if (status === 9) return 'cerrado'
  return `desconocido (${status})`
}

register({
  name: '/redmine_proyectos',
  category: 'Utilidades',
  description: 'Lista detallada de proyectos Redmine a los que se tiene acceso.',
  usage: '/redmine_proyectos',
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

    chatStore.messages.push({
      role: 'command',
      content: '/redmine_proyectos',
      _key: 'cmd-' + Date.now(),
    })

    const msgIdx = chatStore.messages.length
    chatStore.messages.push({
      role: 'result',
      content: 'Obteniendo proyectos desde Redmine...',
      _key: 'result-' + Date.now(),
    })

    try {
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

      let md = '# Proyectos Redmine\n\n'

      data.proyectos.forEach((p, i) => {
        md += `## ${i + 1}. ${p.name}\n`
        md += `- **ID:** ${p.id}\n`
        md += `- **Identificador:** \`${p.identifier}\`\n`
        md += `- **Estado:** ${formatStatus(p.status)}\n`
        md += `- **Creado:** ${formatDate(p.created_on)}\n`
        md += `- **Actualizado:** ${formatDate(p.updated_on)}\n`
        if (p.parent) {
          md += `- **Proyecto padre:** ${p.parent.name} (ID: ${p.parent.id})\n`
        } else {
          md += `- **Proyecto padre:** —\n`
        }
        if (p.description) {
          md += `\n**Descripción:**\n\`\`\`\n${p.description}\n\`\`\`\n`
        }
        md += '\n'
      })

      chatStore.messages[msgIdx] = {
        role: 'result',
        content: md,
        _key: 'result-' + Date.now(),
      }
    } catch (err) {
      console.error('Error en /redmine_proyectos:', err.message)
      chatStore.messages[msgIdx] = {
        role: 'result',
        content: 'Error de conexión al obtener proyectos Redmine.',
        _key: 'result-' + Date.now(),
      }
    }
  },
})
