import { useCommandRegistry } from '../useCommandRegistry.js';
import { parseCommandArgs } from '../parseCommandArgs.js';
import { useComandosPersonalizadosStore } from '../../stores/comandosPersonalizados.js';

const { register } = useCommandRegistry();

function _getProyectoId(sessions, activeSessionId) {
  const session = sessions.find(s => Number(s.id) === Number(activeSessionId))
  return session?.proyecto_id || null
}

async function _ejecutarComandoSimple(comandoId, sessionId) {
  const store = useComandosPersonalizadosStore()

  let comandoData = null
  for (const arr of Object.values(store.commandsByProject)) {
    const found = arr.find(c => Number(c.id) === Number(comandoId))
    if (found) { comandoData = found; break }
  }

  if (!comandoData) {
    const res = await fetch(`/api/comandos-personalizados/detail/${comandoId}`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      if (data.comando) comandoData = data.comando
    }
  }

  if (!comandoData) {
    throw new Error(`Comando con id ${comandoId} no encontrado.`)
  }

  let fullOutput = ''

  const res = await fetch(`/api/comandos-personalizados/${comandoId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ sessionId }),
  })

  if (!res.ok) {
    const errData = await res.json()
    throw new Error(errData.error || 'Error al ejecutar comando')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''

    for (const line of lines) {
      const t = line.trim()
      if (!t || t === 'data: [DONE]') continue
      if (!t.startsWith('data: ')) continue
      try {
        const json = JSON.parse(t.slice(6))
        if (json.type === 'stdout' || json.type === 'stderr') {
          fullOutput += json.content
        } else if (json.type === 'error') {
          fullOutput += '\n[Error: ' + json.content + ']'
        }
      } catch {}
    }
  }

  return fullOutput || '(sin salida)'
}

register({
  name: '/comando_listar',
  category: 'Comandos Personalizados',
  description: 'Lista los comandos personalizados del proyecto de la sesión o del especificado.',
  usage: '/comando_listar [--id=proyecto]',
  autocomplete(args, cmdStore) {
    if (!args.some(a => a.startsWith('--id='))) return ['--id=']
    return []
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) throw new Error('Primero debe iniciar una sesión de chat.')
    const { params, errors } = parseCommandArgs(args, { id: { required: false } })
    if (errors.length > 0) throw new Error(errors.join('. '))

    const proyectoId = params.id || _getProyectoId(chatStore.sessions, sessionId)
    if (!proyectoId) throw new Error('No hay proyecto asignado a la sesión. Usá --id o /chat_set_proyecto.')

    const store = useComandosPersonalizadosStore()
    await store.loadCommands(proyectoId)
    const list = store.getCommandsForProject(proyectoId)

    if (list.length === 0) return 'No hay comandos personalizados para este proyecto.'

    return list.map(c =>
      `• ${c.label}${c.descripcion ? ': ' + c.descripcion : ''}  (id: ${c.id})\n  \`${c.comando}\``
    ).join('\n\n')
  },
})

register({
  name: '/comando_crear',
  category: 'Comandos Personalizados',
  description: 'Abre un formulario inline para crear un nuevo comando personalizado.',
  usage: '/comando_crear',
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) throw new Error('Primero debe iniciar una sesión de chat.')
    const proyectoId = _getProyectoId(chatStore.sessions, sessionId)
    if (!proyectoId) throw new Error('No hay proyecto asignado a la sesión. Usá /chat_set_proyecto primero.')

    chatStore.pushMessage({
      role: 'opencode_control',
      content: JSON.stringify({
        controlId: 'comando-edit-create-' + Date.now(),
        controlType: 'comando_edit',
        mode: 'create',
        proyectoId,
      }),
      controlData: {
        controlId: 'comando-edit-create-' + Date.now(),
        controlType: 'comando_edit',
        mode: 'create',
        proyectoId,
      },
      _key: 'ctrl-comando-' + Date.now(),
    })
  },
})

register({
  name: '/comando_editar',
  category: 'Comandos Personalizados',
  description: 'Abre un formulario inline para editar un comando personalizado existente.',
  usage: '/comando_editar --id=ID',
  autocomplete(args, cmdStore) {
    if (!args.some(a => a.startsWith('--id='))) return ['--id=']
    return []
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) throw new Error('Primero debe iniciar una sesión de chat.')
    const { params, errors } = parseCommandArgs(args, { id: { required: true } })
    if (errors.length > 0) throw new Error(errors.join('. '))

    const store = useComandosPersonalizadosStore()

    const proyectoId = _getProyectoId(chatStore.sessions, sessionId)
    if (!proyectoId) throw new Error('No hay proyecto asignado a la sesión.')

    await store.loadCommands(proyectoId)
    const allCommands = store.getCommandsForProject(proyectoId)
    const cmd = allCommands.find(c => Number(c.id) === Number(params.id))
    if (!cmd) throw new Error(`Comando con id ${params.id} no encontrado.`)

    chatStore.pushMessage({
      role: 'opencode_control',
      content: JSON.stringify({
        controlId: 'comando-edit-update-' + Date.now(),
        controlType: 'comando_edit',
        mode: 'update',
        id: cmd.id,
        proyectoId: cmd.id_proyecto,
        label: cmd.label,
        descripcion: cmd.descripcion || '',
        comando: cmd.comando,
      }),
      controlData: {
        controlId: 'comando-edit-update-' + Date.now(),
        controlType: 'comando_edit',
        mode: 'update',
        id: cmd.id,
        proyectoId: cmd.id_proyecto,
        label: cmd.label,
        descripcion: cmd.descripcion || '',
        comando: cmd.comando,
      },
      _key: 'ctrl-comando-' + Date.now(),
    })
  },
})

register({
  name: '/comando_eliminar',
  category: 'Comandos Personalizados',
  description: 'Elimina un comando personalizado.',
  usage: '/comando_eliminar --id=ID',
  autocomplete(args, cmdStore) {
    if (!args.some(a => a.startsWith('--id='))) return ['--id=']
    return []
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) throw new Error('Primero debe iniciar una sesión de chat.')
    const { params, errors } = parseCommandArgs(args, { id: { required: true } })
    if (errors.length > 0) throw new Error(errors.join('. '))

    const store = useComandosPersonalizadosStore()
    const proyectoId = _getProyectoId(chatStore.sessions, sessionId)

    try {
      await store.deleteCommand(params.id, proyectoId)
      return `✓ Comando (id: ${params.id}) eliminado correctamente.`
    } catch (err) {
      throw new Error('Error al eliminar comando: ' + err.message)
    }
  },
})

register({
  name: '/comando_ejecutar',
  category: 'Comandos Personalizados',
  description: 'Ejecuta un comando personalizado por su ID. Los resultados parciales se muestran en vivo.',
  usage: '/comando_ejecutar --id=ID',
  autocomplete(args, cmdStore) {
    if (!args.some(a => a.startsWith('--id='))) return ['--id=']
    return []
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) throw new Error('Primero debe iniciar una sesión de chat.')
    const { params, errors } = parseCommandArgs(args, { id: { required: true } })
    if (errors.length > 0) throw new Error(errors.join('. '))

    return await _ejecutarComandoSimple(params.id, sessionId)
  },
})
