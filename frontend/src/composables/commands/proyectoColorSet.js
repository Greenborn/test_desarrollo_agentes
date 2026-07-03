import { useCommandRegistry } from '../useCommandRegistry.js';
import wsClient from '../../services/wsClient.js';
import { useAuthStore } from '../../stores/auth.js';
import { useProjectStore } from '../../stores/project.js';

const { register } = useCommandRegistry();

register({
  name: '/proyecto_color_set',
  category: 'Proyecto',
  description: 'Establece el color identificativo de un proyecto (ej: #ff6b6b).',
  usage: '/proyecto_color_set --color=#ff6b6b [--id=proyecto]',
  autocomplete(args, cmdStore) {
    const usedFlags = args.map(a => a.startsWith('--') ? a.split('=')[0] + '=' : '')
    const suggestions = []
    if (!usedFlags.some(f => f === '--color=')) suggestions.push('--color=')
    if (!usedFlags.some(f => f === '--id=')) suggestions.push('--id=')
    cmdStore.showAutocomplete(suggestions)
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const colorFlag = args.find(a => a.startsWith('--color='))
    const idFlag = args.find(a => a.startsWith('--id='))

    if (!colorFlag) {
      throw new Error('Debe especificar --color=#hex (ej: --color=#ff6b6b)')
    }

    const color = colorFlag.split('=')[1]
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      throw new Error('Formato de color inválido. Use formato hexadecimal (ej: #ff6b6b)')
    }

    let proyectoId = idFlag ? idFlag.split('=')[1] : null
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
      const res = await fetch(`/api/proyecto/${proyectoId}/color`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ color }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al actualizar color')
      }
      const projectStore = useProjectStore()
      projectStore.updateProjectColor(proyectoId, color)
      return `Color del proyecto "${proyectoId}" actualizado a ${color}`
    } catch (err) {
      console.error('Error en /proyecto_color_set:', err.message)
      throw err
    }
  },
})
