import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/dev_funcionalidad_listar',
  category: 'Desarrollo',
  description: 'Lista las funcionalidades del proyecto vinculado a la sesión o del especificado.',
  usage: '/dev_funcionalidad_listar [--id=&lt;id_proyecto&gt;]',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)
    if (usedFlags.includes('--id=')) {
      const idArg = args.find(a => a.startsWith('--id='))
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
        console.error('Error en autocomplete de /dev_funcionalidad_listar:', err)
      }
    } else {
      cmdStore.showAutocomplete(['--id='])
    }
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const { params } = parseCommandArgs(args, { id: { required: false } })
    let proyectoId = params.id

    if (!proyectoId) {
      try {
        const res = await fetch(`/api/proyecto/session/${sessionId}`, { credentials: 'include' })
        const data = await res.json()
        proyectoId = data.proyectoId
      } catch (err) {
        console.error('Error al obtener proyecto de sesión:', err)
      }
      if (!proyectoId) {
        throw new Error('No hay proyecto vinculado a la sesión. Usá /chat_set_proyecto --id=<id> o pasá el ID como argumento.')
      }
    }

    try {
      const res = await fetch(`/api/funcionalidades/${encodeURIComponent(proyectoId)}`, { credentials: 'include' })
      const data = await res.json()
      if (!data.funcionalidades || data.funcionalidades.length === 0) {
        return `No hay funcionalidades registradas para el proyecto "${proyectoId}".`
      }
      const listData = {
        controlType: 'funcionalidad_list',
        controlId: 'funcionalidad-list-' + Date.now(),
        items: data.funcionalidades.map(f => ({
          nombre: f.nombre,
          etapa: f.etapa,
          sessionId: f.session_id,
          proyectoId: proyectoId,
        })),
      }
      return {
        role: 'opencode_control',
        controlData: listData,
      }
    } catch (err) {
      console.error('Error en /dev_funcionalidad_listar:', err)
      throw err
    }
  },
})
