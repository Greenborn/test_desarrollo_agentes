import { useCommandRegistry } from '../useCommandRegistry.js';

const { register } = useCommandRegistry();

register({
  name: '/peticion',
  category: 'Utilidades',
  description: 'Abre un formulario inline para simular una petición HTTP (tipo Postman). Ingresá URL, método, headers y body. La respuesta se muestra en el chat.',
  usage: '/peticion',
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) throw new Error('Primero debe iniciar una sesión de chat.')

    return {
      role: 'opencode_control',
      controlData: {
        controlType: 'peticion',
        controlId: 'peticion-' + Date.now(),
      },
    }
  },
})
