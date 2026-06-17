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

      return lines.join('\n') || '(sin documentación para este proyecto)';
    } catch (err) {
      console.error('Error en /documentacion_all:', err.message);
      throw err;
    }
  },
});
