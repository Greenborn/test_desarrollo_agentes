import { useCommandRegistry } from '../useCommandRegistry.js';
import { parseCommandArgs } from '../parseCommandArgs.js';

const { register } = useCommandRegistry();

register({
  name: '/gastos_listar_proyecto',
  category: 'Gastos',
  description: 'Muestra gastos del proyecto activo o del especificado.',
  usage: '/gastos_listar_proyecto [--id=&lt;id_proyecto&gt;]',
  async autocomplete(args, cmdStore) {
    const idArg = args.find(a => a.startsWith('--id='))
    if (idArg) {
      const val = idArg.slice('--id='.length)
      try {
        const res = await fetch('/api/proyecto', { credentials: 'include' });
        const data = await res.json();
        if (data.proyectos) {
          const prefix = val.toLowerCase()
          const filtered = data.proyectos.filter(p => p.id.toLowerCase().includes(prefix))
          if (val && filtered.length === 1 && filtered[0].id === val) {
            cmdStore.hideAutocomplete()
          } else {
            cmdStore.showAutocomplete(filtered.map(p => ({ display: p.id, value: `--id=${p.id}` })));
          }
        }
      } catch (err) {
        console.error('Error en autocomplete de /gastos_listar_proyecto:', err);
      }
    } else {
      cmdStore.showAutocomplete(['--id='])
    }
  },
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId;
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.');
    }

    const { params } = parseCommandArgs(args, { id: { required: false } })
    let proyectoId = params.id;

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
      throw new Error('No hay proyecto seleccionado. Especifique un id de proyecto o use /chat_set_proyecto primero.');
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
      console.error('Error en /gastos_listar_proyecto:', err.message);
      throw err;
    }
  },
});
