import { useCommandRegistry } from '../useCommandRegistry.js';

const { register } = useCommandRegistry();

register({
  name: '/proyecto_var_listar',
  category: 'Proyecto',
  description: 'Lista las variables de un proyecto.',
  usage: '/proyecto_var_listar [--id=proyecto]',
  autocomplete(args, cmdStore) {
    const used = args.filter(a => a.startsWith('--id='))
    if (used.length > 0) return []
    const last = args[args.length - 1] || ''
    if (last.startsWith('--id=') || last === '--id') {
      return ['--id=']
    }
    return ['--id=']
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const idFlag = args.find(a => a.startsWith('--id='))
    let proyectoId = idFlag ? idFlag.slice(5) : null

    if (!proyectoId) {
      try {
        const res = await fetch(`/api/proyecto/session/${sessionId}`, { credentials: 'include' })
        const data = await res.json()
        proyectoId = data.proyectoId
      } catch (err) {
        console.error('Error al obtener proyecto de sesión:', err.message)
      }
    }

    if (!proyectoId) {
      throw new Error('No hay proyecto definido. Use --id=proyecto o asigne un proyecto a la sesión.')
    }

    try {
      const res = await fetch(`/api/proyecto/${encodeURIComponent(proyectoId)}/variables`, {
        credentials: 'include',
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Error al listar variables')
      }
      const data = await res.json()

      if (!data.variables || data.variables.length === 0) {
        return `(sin variables para el proyecto "${proyectoId}")`
      }

      const lines = data.variables.map(v => `${v.key}=${v.value}`)
      return `Variables de "${proyectoId}":\n${lines.join('\n')}`
    } catch (err) {
      console.error('Error en /proyecto_var_listar:', err.message)
      throw err
    }
  },
})
