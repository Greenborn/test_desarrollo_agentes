import { useCommandRegistry } from '../useCommandRegistry.js';
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js';

const { register } = useCommandRegistry();

register({
  name: '/db_export',
  category: 'Base de datos',
  description: 'Exporta la base de datos completa mediante mysqldump a un archivo .sql. Con --output=<ruta> se guarda donde se indique; sin él se guarda en /tmp/ con timestamp.',
  usage: '/db_export [--output=<ruta>]',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args);
    if (!usedFlags.includes('--output=')) {
      cmdStore.showAutocomplete(['--output=']);
    } else {
      cmdStore.hideAutocomplete();
    }
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.');
    }

    const { params } = parseCommandArgs(args, { output: { required: false } });

    try {
      const res = await fetch('/api/db/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ output: params.output || null }),
      });

      const data = await res.json();
      if (data.success) {
        return data.result;
      }
      throw new Error(data.error || 'Error al exportar la base de datos');
    } catch (err) {
      console.error('Error en /db_export:', err.message);
      throw err;
    }
  },
});
