import { useCommandRegistry } from '../useCommandRegistry.js';
import wsClient from '../../services/wsClient.js';
import { useAuthStore } from '../../stores/auth.js';

const { register } = useCommandRegistry();

register({
  name: '/peticion',
  category: 'Utilidades',
  description: 'Abre un formulario inline para simular una petición HTTP (tipo Postman). Ingresá URL, método, headers y body. La respuesta se muestra en el chat.',
  usage: '/peticion',
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) throw new Error('Primero debe iniciar una sesión de chat.')

    const session = chatStore.sessions.find(s => Number(s.id) === Number(sessionId))
    const proyectoId = session?.proyecto_id || null
    let initialData = null

    if (proyectoId) {
      try {
        const auth = useAuthStore()
        const data = await wsClient.send('proyectoVarListar', {
          sessionToken: auth.getSessionToken(),
          proyectoId,
        })
        if (data.variables) {
          const peticionVar = data.variables.find(v => v.key === 'peticion_datos')
          if (peticionVar && peticionVar.value) {
            initialData = JSON.parse(peticionVar.value)
          }
        }
      } catch (err) {
        console.error('Error al cargar peticion_datos:', err.message)
      }
    }

    return {
      role: 'opencode_control',
      controlData: {
        controlType: 'peticion',
        controlId: 'peticion-' + Date.now(),
        initialData,
      },
    }
  },
})
