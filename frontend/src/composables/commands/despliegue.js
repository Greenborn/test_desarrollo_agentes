import { useCommandRegistry } from '../useCommandRegistry.js';

const { register } = useCommandRegistry();

register({
  name: '/despliegue_upd_config',
  category: 'Despliegue',
  description: 'Lee deploy.json del directorio del proyecto y guarda la configuración de despliegue en la base de datos.',
  usage: '/despliegue_upd_config',
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId;
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.');
    }

    const res = await fetch('/api/despliegue/upd-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Error al actualizar configuración de despliegue.');
    }

    return data.message;
  },
});

register({
  name: '/despliegue_show_config',
  category: 'Despliegue',
  description: 'Muestra la configuración de despliegue guardada para el proyecto actual.',
  usage: '/despliegue_show_config',
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId;
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.');
    }

    const res = await fetch(`/api/despliegue/config?sessionId=${sessionId}`, {
      credentials: 'include',
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Error al obtener configuración de despliegue.');
    }

    return JSON.stringify(data.config, null, 2);
  },
});
