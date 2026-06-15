import { useCommandRegistry } from '../useCommandRegistry.js';

const { register } = useCommandRegistry();

register({
  name: '/gastos_proyecto',
  category: 'Gastos',
  description: 'Muestra gastos del proyecto activo o del especificado.',
  usage: '/gastos_proyecto [id_proyecto]',
  async autocomplete(args, cmdStore) {
    try {
      const res = await fetch('/api/proyecto', { credentials: 'include' });
      const data = await res.json();
      if (data.proyectos) {
        cmdStore.showAutocomplete(data.proyectos.map((p) => p.id));
      }
    } catch (err) {
      console.error('Error en autocomplete de /gastos_proyecto:', err);
    }
  },
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

    let proyectoId = args[0];

    if (!proyectoId) {
      try {
        const res = await fetch(`/api/proyecto/session/${sessionId}`, { credentials: 'include' });
        const data = await res.json();
        proyectoId = data.proyectoId;
      } catch (err) {
        console.error('Error al obtener proyecto de sesión:', err.message);
      }
    }

    if (!proyectoId) {
      chatStore.messages.push({
        role: 'result',
        content: 'No hay proyecto seleccionado. Especifique un id de proyecto o use /proyecto_set primero.',
        _key: 'result-' + Date.now(),
      });
      return;
    }

    chatStore.messages.push({
      role: 'command',
      content: `/gastos_proyecto ${proyectoId}`,
      _key: 'cmd-' + Date.now(),
    });

    const msgIdx = chatStore.messages.length;
    chatStore.messages.push({
      role: 'result',
      content: 'Obteniendo gastos...',
      _key: 'result-' + Date.now(),
    });

    try {
      const res = await fetch(`/api/gastos?id_proyecto=${encodeURIComponent(proyectoId)}`, { credentials: 'include' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al obtener gastos');
      }
      const data = await res.json();

      if (!data || data.length === 0) {
        chatStore.messages[msgIdx] = {
          role: 'result',
          content: `(sin registros de gastos para el proyecto "${proyectoId}")`,
          _key: 'result-' + Date.now(),
        };
        return;
      }

      const lines = data.map((g) => {
        return [
          `ID: ${g.id}`,
          `  Sesión Chat: ${g.id_chat_session}`,
          `  Precio: ${g.precio}`,
          `  Tokens: ${g.tokens}`,
          `  Fecha: ${g.fecha_hora}`,
          g.id_sesion_opencode ? `  OC Session: ${g.id_sesion_opencode}` : '',
        ].filter(Boolean).join('\n');
      });

      const formatted = lines.join('\n\n');

      chatStore.messages[msgIdx] = {
        role: 'result',
        content: formatted,
        _key: 'result-' + Date.now(),
      };
    } catch (err) {
      console.error('Error en /gastos_proyecto:', err.message);
      chatStore.messages[msgIdx] = {
        role: 'result',
        content: 'Error: ' + err.message,
        _key: 'result-' + Date.now(),
      };
    }
  },
});
