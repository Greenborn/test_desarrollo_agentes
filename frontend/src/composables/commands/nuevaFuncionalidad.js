import { useCommandRegistry } from '../useCommandRegistry.js';
import { useModalStore } from '../../stores/modal.js';
import FuncionalidadWizard from '../../components/FuncionalidadWizard.vue';

const { register } = useCommandRegistry();

register({
  name: '/dev_funcionalidad_crear',
  category: 'Desarrollo',
  description: 'Inicia el wizard para relevar y desarrollar una nueva funcionalidad',
  usage: '/dev_funcionalidad_crear',
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId;
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.');
    }

    try {
      const res = await fetch(`/api/proyecto/session/${sessionId}`, { credentials: 'include' });
      const data = await res.json();
      if (!data.proyectoId) {
        throw new Error('No hay proyecto seleccionado. Use /chat_set_proyecto primero.');
      }
      const modal = useModalStore();
      modal.open(FuncionalidadWizard, { sessionId, proyectoId: data.proyectoId }, {
        title: 'Asistente de Creación de Nueva Funcionalidad',
        wide: true,
      });
    } catch (err) {
      console.error('Error al verificar proyecto:', err.message);
      throw err;
    }
  },
});
