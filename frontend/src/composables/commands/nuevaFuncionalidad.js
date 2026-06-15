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
    const modal = useModalStore();
    modal.open(FuncionalidadWizard, { sessionId }, {
      title: 'Asistente de Creación de Nueva Funcionalidad',
      wide: true,
    });
  },
});
