import { parseCommandArgs, getUsedFlags } from '../../../composables/parseCommandArgs.js'

const API_BASE = '/api/documentacion'

function _getSessionProjectId(sessions, sessionId) {
  const session = sessions.find(s => Number(s.id) === Number(sessionId));
  return session?.proyecto_id || null;
}

function _getSessionTicketId(sessions, sessionId) {
  const session = sessions.find(s => Number(s.id) === Number(sessionId));
  return session?.id_ticket_redmine || null;
}

async function _resolveProyectoId(args, chatStore, sessionId) {
  const { params } = parseCommandArgs(args, { 'proyecto-id': { required: false } });
  if (params['proyecto-id']) return params['proyecto-id'];
  if (!sessionId) return null;
  const pid = _getSessionProjectId(chatStore.sessions, sessionId);
  if (!pid) {
    try {
      const res = await fetch(`/api/proyecto/session/${sessionId}`, { credentials: 'include' });
      const data = await res.json();
      return data.proyectoId || null;
    } catch (err) {
      console.error('Error al obtener proyecto de sesión:', err.message);
      return null;
    }
  }
  return pid;
}

export default [
  {
    name: '/doc_nota_listar',
    category: 'Documentación',
    description: 'Lista todas las notas de documentación del proyecto.',
    usage: '/doc_nota_listar [--proyecto-id=<id>]',
    autocomplete(args, cmdStore) {
      const usedFlags = getUsedFlags(args)
      const idInUse = usedFlags.some(f => f === '--proyecto-id=' || f === '--proyecto-id')
      if (!idInUse) {
        cmdStore.showAutocomplete(['--proyecto-id='])
      } else {
        cmdStore.hideAutocomplete()
      }
    },
    async execute(args, { chatStore, sessionId }) {
      if (!sessionId) throw new Error('Primero debe iniciar una sesión de chat.')

      const proyectoId = await _resolveProyectoId(args, chatStore, sessionId)
      if (!proyectoId) throw new Error('No hay proyecto seleccionado. Use /chat_set_proyecto o --proyecto-id.')

      const res = await fetch(`${API_BASE}/notas/${encodeURIComponent(proyectoId)}`, { credentials: 'include' })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Error al listar notas')
      }
      const data = await res.json()
      if (!data || data.length === 0) return '(sin notas de documentación)'

      const lines = data.map(n => {
        const ticketLabel = n.id_ticket ? `ticket #${n.id_ticket}` : 'general'
        return `  [${n.id}] ${n.clave} (${ticketLabel})`
      })
      return `Notas de documentación para ${proyectoId}:\n${lines.join('\n')}`
    },
  },
  {
    name: '/doc_nota_crear',
    category: 'Documentación',
    description: 'Crea una nota de documentación. Si hay ticket vinculado a la sesión se asocia automáticamente; si no, se crea como documentación general.',
    usage: '/doc_nota_crear --clave=<key> --valor=<text> [--proyecto-id=<id>]',
    async autocomplete(args, cmdStore) {
      const usedFlags = getUsedFlags(args)
      const last = args[args.length - 1] || ''
      if (last.startsWith('--proyecto-id=')) {
        const val = last.slice('--proyecto-id='.length)
        try {
          const res = await fetch('/api/proyecto', { credentials: 'include' })
          const data = await res.json()
          if (data.proyectos) {
            const filtered = data.proyectos.filter(p => p.id.toLowerCase().includes(val.toLowerCase()))
            if (val && filtered.length === 1 && filtered[0].id === val) {
              cmdStore.hideAutocomplete()
            } else {
              cmdStore.showAutocomplete(filtered.map(p => ({ display: p.id, value: `--proyecto-id=${p.id}` })))
            }
          }
        } catch (err) { console.error('Error en autocomplete de /doc_nota_crear:', err); cmdStore.hideAutocomplete() }
      } else {
        const allFlags = ['--clave=', '--valor=', '--proyecto-id=']
        const suggestions = allFlags.filter(f => {
          const base = f.split('=')[0]
          return !usedFlags.includes(f) && !usedFlags.includes(base)
        })
        if (suggestions.length > 0) {
          cmdStore.showAutocomplete(suggestions)
        } else {
          cmdStore.hideAutocomplete()
        }
      }
    },
    async execute(args, { chatStore, sessionId }) {
      if (!sessionId) throw new Error('Primero debe iniciar una sesión de chat.')

      const { params, errors } = parseCommandArgs(args, {
        clave: { required: true },
        valor: { required: true },
        'proyecto-id': { required: false },
      })
      if (errors.length > 0) throw new Error(errors.join('. '))

      const proyectoId = await _resolveProyectoId(args, chatStore, sessionId)
      if (!proyectoId) throw new Error('No hay proyecto seleccionado. Use /chat_set_proyecto o --proyecto-id.')

      const payload = {
        id_proyecto: proyectoId,
        clave: params.clave,
        valor: params.valor,
      }

      let idTicket = _getSessionTicketId(chatStore.sessions, sessionId)
      if (!idTicket) {
        try {
          const res = await fetch(`/api/tickets/session/${sessionId}`, { credentials: 'include' })
          const data = await res.json()
          idTicket = data.idTicketRedmine || null
        } catch (err) {
          console.error('Error al obtener ticket de sesión:', err)
          idTicket = null
        }
      }
      if (idTicket) {
        payload.id_ticket = parseInt(idTicket, 10)
      }

      const res = await fetch(`${API_BASE}/notas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear nota')

      const ticketInfo = payload.id_ticket ? ` (ticket #${payload.id_ticket})` : ' (general)'
      return `✓ Nota "${params.clave}" creada${ticketInfo} (id: ${data.id})`
    },
  },
  {
    name: '/doc_nota_ver',
    category: 'Documentación',
    description: 'Muestra el contenido completo de una nota de documentación.',
    usage: '/doc_nota_ver --clave=<key> [--proyecto-id=<id>]',
    autocomplete(args, cmdStore) {
      const usedFlags = getUsedFlags(args)
      const allFlags = ['--clave=', '--proyecto-id=']
      const suggestions = allFlags.filter(f => {
        const base = f.split('=')[0]
        return !usedFlags.includes(f) && !usedFlags.includes(base)
      })
      if (suggestions.length > 0) {
        cmdStore.showAutocomplete(suggestions)
      } else {
        cmdStore.hideAutocomplete()
      }
    },
    async execute(args, { chatStore, sessionId }) {
      if (!sessionId) throw new Error('Primero debe iniciar una sesión de chat.')

      const { params, errors } = parseCommandArgs(args, {
        clave: { required: true },
        'proyecto-id': { required: false },
      })
      if (errors.length > 0) throw new Error(errors.join('. '))

      const proyectoId = await _resolveProyectoId(args, chatStore, sessionId)
      if (!proyectoId) throw new Error('No hay proyecto seleccionado. Use /chat_set_proyecto o --proyecto-id.')

      const res = await fetch(`${API_BASE}/notas/${encodeURIComponent(proyectoId)}/${encodeURIComponent(params.clave)}`, { credentials: 'include' })
      if (!res.ok) {
        if (res.status === 404) throw new Error(`No se encontró la nota "${params.clave}"`)
        const errData = await res.json()
        throw new Error(errData.error || 'Error al obtener nota')
      }
      const data = await res.json()
      const ticketLabel = data.id_ticket ? `ticket #${data.id_ticket}` : 'general'
      return `Nota: ${data.clave} (${ticketLabel})\n---\n${data.valor || '(sin contenido)'}\n---\nCreada: ${data.created_at} | Editada: ${data.updated_at}`
    },
  },
  {
    name: '/doc_nota_editar',
    category: 'Documentación',
    description: 'Actualiza el contenido de una nota de documentación.',
    usage: '/doc_nota_editar --clave=<key> [--valor=<text>] [--proyecto-id=<id>]',
    autocomplete(args, cmdStore) {
      const usedFlags = getUsedFlags(args)
      const allFlags = ['--clave=', '--valor=', '--proyecto-id=']
      const suggestions = allFlags.filter(f => {
        const base = f.split('=')[0]
        return !usedFlags.includes(f) && !usedFlags.includes(base)
      })
      if (suggestions.length > 0) {
        cmdStore.showAutocomplete(suggestions)
      } else {
        cmdStore.hideAutocomplete()
      }
    },
    async execute(args, { chatStore, sessionId }) {
      if (!sessionId) throw new Error('Primero debe iniciar una sesión de chat.')

      const { params, errors } = parseCommandArgs(args, {
        clave: { required: true },
        valor: { required: false },
        'proyecto-id': { required: false },
      })
      if (errors.length > 0) throw new Error(errors.join('. '))

      const proyectoId = await _resolveProyectoId(args, chatStore, sessionId)
      if (!proyectoId) throw new Error('No hay proyecto seleccionado. Use /chat_set_proyecto o --proyecto-id.')

      const getRes = await fetch(`${API_BASE}/notas/${encodeURIComponent(proyectoId)}/${encodeURIComponent(params.clave)}`, { credentials: 'include' })
      if (!getRes.ok) {
        if (getRes.status === 404) throw new Error(`No se encontró la nota "${params.clave}"`)
        const errData = await getRes.json()
        throw new Error(errData.error || 'Error al obtener nota')
      }
      const existing = await getRes.json()

      const updatePayload = {
        clave: params.clave,
        valor: params.valor ?? existing.valor,
        id_ticket: existing.id_ticket,
      }

      const res = await fetch(`${API_BASE}/notas/${existing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updatePayload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al actualizar nota')

      return `✓ Nota "${params.clave}" actualizada`
    },
  },
  {
    name: '/doc_nota_eliminar',
    category: 'Documentación',
    description: 'Elimina una nota de documentación.',
    usage: '/doc_nota_eliminar --clave=<key> [--proyecto-id=<id>]',
    autocomplete(args, cmdStore) {
      const usedFlags = getUsedFlags(args)
      const allFlags = ['--clave=', '--proyecto-id=']
      const suggestions = allFlags.filter(f => {
        const base = f.split('=')[0]
        return !usedFlags.includes(f) && !usedFlags.includes(base)
      })
      if (suggestions.length > 0) {
        cmdStore.showAutocomplete(suggestions)
      } else {
        cmdStore.hideAutocomplete()
      }
    },
    async execute(args, { chatStore, sessionId }) {
      if (!sessionId) throw new Error('Primero debe iniciar una sesión de chat.')

      const { params, errors } = parseCommandArgs(args, {
        clave: { required: true },
        'proyecto-id': { required: false },
      })
      if (errors.length > 0) throw new Error(errors.join('. '))

      const proyectoId = await _resolveProyectoId(args, chatStore, sessionId)
      if (!proyectoId) throw new Error('No hay proyecto seleccionado. Use /chat_set_proyecto o --proyecto-id.')

      const getRes = await fetch(`${API_BASE}/notas/${encodeURIComponent(proyectoId)}/${encodeURIComponent(params.clave)}`, { credentials: 'include' })
      if (!getRes.ok) {
        if (getRes.status === 404) throw new Error(`No se encontró la nota "${params.clave}"`)
        const errData = await getRes.json()
        throw new Error(errData.error || 'Error al obtener nota')
      }
      const existing = await getRes.json()

      const res = await fetch(`${API_BASE}/notas/${existing.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Error al eliminar nota')
      }

      return `✓ Nota "${params.clave}" eliminada`
    },
  },
]
