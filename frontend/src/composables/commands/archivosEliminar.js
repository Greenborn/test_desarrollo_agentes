import { useCommandRegistry } from '../useCommandRegistry.js';
import { getUsedFlags } from '../parseCommandArgs.js';

const { register } = useCommandRegistry();
const ALL_FLAGS = ['--id=']

register({
  name: '/archivos_eliminar',
  category: 'Archivos',
  description: 'Elimina un archivo del proyecto. Requiere sesión vinculada a un proyecto.',
  usage: '/archivos_eliminar --id=<id_archivo>',
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
    if (!idFlag) {
      throw new Error('Debe especificar --id=<id_archivo>')
    }
    const archivoId = idFlag.slice(5)
    if (!archivoId) {
      throw new Error('Debe especificar un ID de archivo válido')
    }

    try {
      const res = await fetch(`/api/archivos/${encodeURIComponent(archivoId)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Error al eliminar archivo')
      }
      const data = await res.json()

      if (data.success) {
        return `Archivo #${archivoId} eliminado correctamente.`
      }
      throw new Error('Error al eliminar archivo')
    } catch (err) {
      console.error('Error en /archivos_eliminar:', err.message)
      throw err
    }
  },
})
