import { useCommandRegistry } from '../useCommandRegistry.js';
import { useModalStore } from '../../stores/modal.js';
import FuncionalidadWizard from '../../components/FuncionalidadWizard.vue';

const { register } = useCommandRegistry();

register({
  name: '/nueva_funcionalidad',
  category: 'Desarrollo',
  description: 'Inicia el wizard para relevar y desarrollar una nueva funcionalidad',
  usage: '/nueva_funcionalidad',
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId;
    if (!sessionId) {
      chatStore.messages.push({
        role: 'result',
        content: 'Primero debe iniciar una sesión de chat.',
        _key: 'result-' + Date.now(),
      });
      return;
    }

    try {
      const res = await fetch(`/api/proyecto/session/${sessionId}`, { credentials: 'include' });
      const data = await res.json();
      if (!data.proyectoId) {
        chatStore.messages.push({
          role: 'result',
          content: 'No hay proyecto seleccionado. Use /proyecto_set primero.',
          _key: 'result-' + Date.now(),
        });
        return;
      }
      const modal = useModalStore();
      modal.open(FuncionalidadWizard, { sessionId, proyectoId: data.proyectoId }, {
        title: 'Asistente de Creación de Nueva Funcionalidad',
        wide: true,
      });
    } catch (err) {
      console.error('Error al verificar proyecto:', err.message);
      chatStore.messages.push({
        role: 'result',
        content: 'Error al verificar proyecto: ' + err.message,
        _key: 'result-' + Date.now(),
      });
    }
  },
});
