import { useCommandRegistry } from '../useCommandRegistry.js';
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js';

const { register } = useCommandRegistry();

register({
  name: '/db_export',
  category: 'Base de datos',
  description: 'Exporta/backup de base de datos. Con --all exporta todos los .db en zip. Con --upload sube a gestión interna. Con --output=<ruta> guarda donde se indique.',
  usage: '/db_export [--output=<ruta>] [--all] [--upload]',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args);
    const available = ['--output=', '--all', '--upload'].filter(f => !usedFlags.includes(f) && !usedFlags.includes(f.replace('=', '')));
    if (available.length > 0) {
      cmdStore.showAutocomplete(available);
    } else {
      cmdStore.hideAutocomplete();
    }
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.');
    }

    const { params } = parseCommandArgs(args, { output: { required: false } });
    const flags = args.filter(a => a.startsWith('--') && !a.includes('=')).map(f => f.toLowerCase());
    const all = flags.includes('--all');
    const upload = flags.includes('--upload');

    if (!all && !upload) {
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
    }

    try {
      const res = await fetch('/api/db/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ output: params.output || null, all, upload }),
      });

      const data = await res.json();
      if (data.success) {
        let msg = data.result;
        if (data.requestLogs && data.requestLogs.length > 0) {
          const lines = data.requestLogs.map(r => {
            const icon = r.statusCode >= 200 && r.statusCode < 300 ? '✅' : '❌';
            return `${icon} \`${r.method}\` ${r.url} → **${r.statusCode}**`;
          });
          msg += '\n\n**Peticiones realizadas:**\n' + lines.join('\n');
        }
        return msg;
      }
      throw new Error(data.error || 'Error al hacer backup');
    } catch (err) {
      console.error('Error en /db_export:', err.message);
      throw err;
    }
  },
});
