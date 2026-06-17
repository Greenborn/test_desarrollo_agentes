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
      throw new Error('Primero debe iniciar una sesión de chat.');
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
      throw new Error('No hay proyecto seleccionado. Especifique un id de proyecto o use /proyecto_set primero.');
    }

    try {
      const res = await fetch(`/api/gastos?id_proyecto=${encodeURIComponent(proyectoId)}`, { credentials: 'include' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al obtener gastos');
      }
      const data = await res.json();

      if (!data || data.length === 0) {
        return `(sin registros de gastos para el proyecto "${proyectoId}")`;
      }

      const lines = data.map((g) => {
        return [
          `ID: ${g.id}`,
          `  Sesión Chat: ${g.id_chat_session}`,
          `  Proyecto: ${g.id_proyecto}`,
          `  Precio: ${g.precio}`,
          `  Tokens: ${g.tokens}`,
          `  Fecha: ${g.fecha_hora}`,
          g.id_sesion_opencode ? `  OC Session: ${g.id_sesion_opencode}` : '',
        ].filter(Boolean).join('\n');
      });

      return lines.join('\n\n');
    } catch (err) {
      console.error('Error en /gastos_proyecto:', err.message);
      throw err;
    }
  },
});
