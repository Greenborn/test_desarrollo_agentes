import { useCommandRegistry } from '../useCommandRegistry.js';

const { register } = useCommandRegistry();

register({
  name: '/archivos_listar',
  category: 'Archivos',
  description: 'Lista los archivos del proyecto vinculado a la sesión actual.',
  usage: '/archivos_listar [--id=proyecto]',
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
