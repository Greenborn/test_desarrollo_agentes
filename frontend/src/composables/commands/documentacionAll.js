import { useCommandRegistry } from '../useCommandRegistry.js';

const { register } = useCommandRegistry();

register({
  name: '/documentacion_all',
  category: 'Desarrollo',
  description: 'Obtiene toda la documentación de un proyecto y la pega en el chat. Si no se especifica proyecto, usa el de la sesión actual.',
  usage: '/documentacion_all [id_proyecto]',
  async autocomplete(args, cmdStore) {
    try {
      const res = await fetch('/api/proyecto', { credentials: 'include' });
      const data = await res.json();
      if (data.proyectos) {
        cmdStore.showAutocomplete(data.proyectos.map((p) => p.id));
      }
    } catch (err) {
      console.error('Error en autocomplete de /documentacion_all:', err);
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
      content: `/documentacion_all ${proyectoId}`,
      _key: 'cmd-' + Date.now(),
    });

    const msgIdx = chatStore.messages.length;
    chatStore.messages.push({
      role: 'result',
      content: 'Obteniendo documentación...',
      _key: 'result-' + Date.now(),
    });

    try {
      const res = await fetch(`/api/documentacion/${encodeURIComponent(proyectoId)}`, { credentials: 'include' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al obtener documentación');
      }
      const data = await res.json();

      const lines = [];
      for (const [type, entries] of Object.entries(data)) {
        if (entries.length === 0) continue;
        lines.push(`=== ${type.toUpperCase()} ===`);
        for (const entry of entries) {
          let content = entry.data !== null ? (typeof entry.data === 'object' ? JSON.stringify(entry.data, null, 2) : entry.data) : '(sin datos)';
          content = content.split('\n').map((l) => '  ' + l).join('\n');
          lines.push(`  id: ${entry.id}`);
          lines.push(`  creado: ${entry.fecha_creacion}`);
          lines.push(`  editado: ${entry.fecha_edicion}`);
          lines.push(`  data:\n${content}`);
          lines.push('');
        }
      }

      const formatted = lines.join('\n') || '(sin documentación para este proyecto)';

      chatStore.messages[msgIdx] = {
        role: 'result',
        content: formatted,
        _key: 'result-' + Date.now(),
      };
    } catch (err) {
      console.error('Error en /documentacion_all:', err.message);
      chatStore.messages[msgIdx] = {
        role: 'result',
        content: 'Error: ' + err.message,
        _key: 'result-' + Date.now(),
      };
    }
  },
});
