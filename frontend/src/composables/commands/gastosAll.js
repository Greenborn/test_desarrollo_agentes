import { useCommandRegistry } from '../useCommandRegistry.js';

const { register } = useCommandRegistry();

register({
  name: '/gastos_all',
  category: 'Gastos',
  description: 'Muestra todos los registros de gastos de tokens.',
  usage: '/gastos_all',
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId;
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.');
    }

    try {
      const res = await fetch('/api/gastos', { credentials: 'include' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al obtener gastos');
      }
      const data = await res.json();

      if (!data || data.length === 0) {
        return '(sin registros de gastos)';
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
      console.error('Error en /gastos_all:', err.message);
      throw err;
    }
  },
});
