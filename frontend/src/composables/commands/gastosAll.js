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
      chatStore.messages.push({
        role: 'result',
        content: 'Primero debe iniciar una sesión de chat.',
        _key: 'result-' + Date.now(),
      });
      return;
    }

    chatStore.messages.push({
      role: 'command',
      content: '/gastos_all',
      _key: 'cmd-' + Date.now(),
    });

    const msgIdx = chatStore.messages.length;
    chatStore.messages.push({
      role: 'result',
      content: 'Obteniendo gastos...',
      _key: 'result-' + Date.now(),
    });

    try {
      const res = await fetch('/api/gastos', { credentials: 'include' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al obtener gastos');
      }
      const data = await res.json();

      if (!data || data.length === 0) {
        chatStore.messages[msgIdx] = {
          role: 'result',
          content: '(sin registros de gastos)',
          _key: 'result-' + Date.now(),
        };
        return;
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

      const formatted = lines.join('\n\n');

      chatStore.messages[msgIdx] = {
        role: 'result',
        content: formatted,
        _key: 'result-' + Date.now(),
      };
    } catch (err) {
      console.error('Error en /gastos_all:', err.message);
      chatStore.messages[msgIdx] = {
        role: 'result',
        content: 'Error: ' + err.message,
        _key: 'result-' + Date.now(),
      };
    }
  },
});
