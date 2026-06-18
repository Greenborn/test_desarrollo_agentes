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

register({
  name: '/iniciar_instancia_dev',
  category: 'Despliegue',
  description: 'Instala dependencias (npm ci) e inicia los procesos de desarrollo (nodemon para backend, npm run dev para frontend) según la configuración de despliegue.',
  usage: '/iniciar_instancia_dev',
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId;
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.');
    }

    const res = await fetch('/api/despliegue/iniciar-instancia-dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Error al iniciar instancia de desarrollo.');
    }

    const lines = data.results.map((r) => {
      const icon = r.status === 'running' ? '✅' : r.status === 'error' ? '❌' : '⚠️';
      const typeLabel = r.type === 'backend' ? 'nodemon' : 'npm run dev';
      return `${icon} ${r.name} (${typeLabel}) — ${r.status}${r.error ? ': ' + r.error : ''}`;
    });

    return lines.join('\n');
  },
});

register({
  name: '/instancia_dev_detener',
  category: 'Despliegue',
  description: 'Detiene todos los procesos de desarrollo iniciados con /iniciar_instancia_dev.',
  usage: '/instancia_dev_detener',
  async execute(args, { chatStore }) {
    const res = await fetch('/api/despliegue/detener-instancia-dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Error al detener instancia de desarrollo.');
    }

    return 'Instancia de desarrollo detenida.';
  },
});

register({
  name: '/instancia_dev_estado',
  category: 'Despliegue',
  description: 'Muestra el estado actual de los procesos de desarrollo.',
  usage: '/instancia_dev_estado',
  async execute(args, { chatStore }) {
    const res = await fetch('/api/despliegue/estado-instancia-dev', {
      credentials: 'include',
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Error al obtener estado de la instancia de desarrollo.');
    }

    if (!data.processes || data.processes.length === 0) {
      return '(No hay procesos de desarrollo activos. Use /iniciar_instancia_dev para iniciarlos.)';
    }

    const lines = data.processes.map((p) => {
      const icon = p.status === 'running' ? '🟢' : p.status === 'error' ? '🔴' : '⚫';
      const typeLabel = p.type === 'backend' ? 'nodemon' : 'npm run dev';
      return `${icon} ${p.name} (${typeLabel}) — ${p.status}`;
    });

    return lines.join('\n');
  },
});
