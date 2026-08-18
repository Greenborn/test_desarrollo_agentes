import { useCommandRegistry } from '../useCommandRegistry.js';
import { useModal } from 'vue-greenborn-modal-manager';
import FuncionalidadWizard from '../../components/wizards/FuncionalidadWizard.vue';

const { register } = useCommandRegistry();

register({
  name: '/dev_funcionalidad_crear',
  category: 'Desarrollo',
  description: 'Inicia el wizard para relevar y desarrollar una nueva funcionalidad',
  usage: '/dev_funcionalidad_crear',
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.');
    }

    try {
      const res = await fetch(`/api/proyecto/session/${sessionId}`, { credentials: 'include' });
      const data = await res.json();
      if (!data.proyectoId) {
        throw new Error('No hay proyecto seleccionado. Use /chat_set_proyecto primero.');
      }
      const { mostrar_modal } = useModal();
      mostrar_modal(FuncionalidadWizard, 'Asistente de Creación de Nueva Funcionalidad', {
        sessionId, proyectoId: data.proyectoId,
      }, { size: 'full' });
    } catch (err) {
      console.error('Error al verificar proyecto:', err.message);
      throw err;
    }
  },
});
