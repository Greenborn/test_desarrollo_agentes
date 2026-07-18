import { useCommandRegistry } from '../useCommandRegistry.js';
import { getUsedFlags } from '../parseCommandArgs.js';

const { register } = useCommandRegistry();
const ALL_FLAGS = ['--id=']

register({
  name: '/archivos_listar',
  category: 'Proyecto',
  description: 'Lista los archivos del proyecto vinculado a la sesión actual.',
  usage: '/archivos_listar [--id=proyecto]',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)
    const suggestions = ALL_FLAGS.filter(f => {
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
      const res = await fetch(`/api/archivos?proyecto_id=${encodeURIComponent(proyectoId)}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Error al listar archivos')
      }
      const data = await res.json()

      if (!data.archivos || data.archivos.length === 0) {
        return `(sin archivos para el proyecto "${proyectoId}")`
      }

      const lines = data.archivos.map(a => {
        const fecha = a.created_at ? new Date(a.created_at).toLocaleString() : '-'
        const tamano = a.tamano ? `${(a.tamano / 1024).toFixed(1)} KB` : '-'
        return `[${a.id}] ${a.nombre_original} (${tamano}) — ${fecha}`
      })

      return `Archivos de "${proyectoId}":\n${lines.join('\n')}`
    } catch (err) {
      console.error('Error en /archivos_listar:', err.message)
      throw err
    }
  },
})
