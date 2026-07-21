import { useCommandRegistry } from '../useCommandRegistry.js';
import { useUiStore } from '../../stores/ui.js';
import { settingGet } from '../../services/settingService.js';
import { getUsedFlags } from '../parseCommandArgs.js';

const { register } = useCommandRegistry();

async function fetchResolutions() {
  try {
    const res = await fetch('/api/settings', { credentials: 'include' });
    const data = await res.json();
    return data.screen_resolutions || [];
  } catch {
    return [];
  }
}

async function fetchDefaultResolution(resolutions) {
  try {
    const data = await settingGet('default_resolution');
    if (data.value) return resolutions.find(r => r.id === data.value) || null;
  } catch {}
  return null;
}

function parseResolutionArg(args) {
  for (const arg of args) {
    if (arg.startsWith('--resolucion=')) return arg.slice('--resolucion='.length);
  }
  return null;
}

register({
  name: '/despliegue_actualizar_config',
  category: 'Despliegue',
  description: 'Lee deploy.json del directorio del proyecto y guarda la configuración de despliegue. Si no existe deploy.json, muestra un formulario para crearlo.',
  usage: '/despliegue_actualizar_config [--dir=<ruta>]',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)
    if (!usedFlags.includes('--dir=')) {
      cmdStore.showAutocomplete(['--dir=']);
      return;
    }
    cmdStore.hideAutocomplete();
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.');
    }

    let dir = null;
    for (const arg of args) {
      if (arg.startsWith('--dir=')) {
        dir = arg.slice('--dir='.length);
      }
    }

    const body = { sessionId };
    if (dir) body.dir = dir;

    const res = await fetch('/api/despliegue/upd-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.success) {
      return data.message;
    }

    if (data.code === 'MISSING_DEPLOY_JSON') {
      return {
        role: 'opencode_control',
        controlData: {
          controlType: 'deploy_config_form',
          controlId: 'deploy-config-' + Date.now(),
          initialSubprojects: [],
          sessionId,
          dir,
        },
      };
    }

    throw new Error(data.error || 'Error al actualizar configuración de despliegue.');
  },
});

register({
  name: '/despliegue_mostrar_config',
  category: 'Despliegue',
  description: 'Muestra la configuración de despliegue guardada para el proyecto actual.',
  usage: '/despliegue_mostrar_config',
  async execute(args, { chatStore, sessionId }) {
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
  name: '/despliegue_iniciar_instancia',
  category: 'Despliegue',
  description: 'Instala dependencias (npm ci) e inicia los procesos de desarrollo (nodemon para backend, npm run dev para frontend) según la configuración de despliegue.',
  usage: '/despliegue_iniciar_instancia [--resolucion=ID]',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)
    if (!usedFlags.includes('--resolucion=')) {
      cmdStore.showAutocomplete(['--resolucion=']);
      return;
    }
    const resolutions = await fetchResolutions();
    if (!resolutions.length) {
      cmdStore.hideAutocomplete();
      return;
    }
    const resolutionArg = args.find(a => a.startsWith('--resolucion='));
    const val = resolutionArg.slice('--resolucion='.length);
    if (val && resolutions.find(r => r.id === val)) {
      cmdStore.hideAutocomplete();
      return;
    }
    const prefix = val.toLowerCase();
    const filtered = prefix
      ? resolutions.filter(r => r.id.toLowerCase().includes(prefix))
      : resolutions;
    cmdStore.showAutocomplete(
      filtered.map(r => ({
        display: `${r.id} — ${r.width}x${r.height}`,
        value: `--resolucion=${r.id}`,
      }))
    );
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.');
    }

    const resolutions = await fetchResolutions();
    let resolution = null;
    const resIdArg = parseResolutionArg(args);
    if (resIdArg) {
      resolution = resolutions.find(r => r.id === resIdArg);
      if (!resolution) {
        const avail = resolutions.map(r => r.id).join(', ');
        throw new Error(`Resolución no válida: "${resIdArg}". Disponibles: ${avail || '(ninguna configurada)'}`);
      }
    } else {
      resolution = await fetchDefaultResolution(resolutions);
    }

    const body = { sessionId };
    if (resolution) body.resolution = resolution;

    const res = await fetch('/api/despliegue/iniciar-instancia-dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Error al iniciar instancia de desarrollo.');
    }

    const resLabel = resolution ? ` (${resolution.width}x${resolution.height})` : '';

    const lines = data.results.map((r) => {
      const icon = r.status === 'running' ? '✅' : r.status === 'error' ? '❌' : '⚠️';
      const typeLabel = r.type === 'backend' ? 'nodemon' : 'npm run dev';
      let line = `${icon} ${r.name} (${typeLabel}) — ${r.status}${r.error ? ': ' + r.error : ''}`;
      if (r.status === 'running') {
        if (r.url) line += ` → ${r.url}`;
        const bs = (data.browserSessions || []).find(b => b.name === r.name);
        if (bs) line += ` 🖥️${resLabel} (sesión: ${bs.idSession.slice(0, 8)}…)`;
      }
      return line;
    });

    if (resolution) {
      lines.push(`\n🖥️ Resolución: ${resolution.id} — ${resolution.width}x${resolution.height}`);
    }

    const uiStore = useUiStore();
    if (uiStore.panelCollapsed) uiStore.togglePanel();

    return lines.join('\n');
  },
});

register({
  name: '/despliegue_detener_instancia',
  category: 'Despliegue',
  description: 'Detiene todos los procesos de desarrollo iniciados con /despliegue_iniciar_instancia.',
  usage: '/despliegue_detener_instancia',
  async execute(args, { chatStore }) {
    const body = chatStore.activeSessionId ? { sessionId: chatStore.activeSessionId } : {};
    const res = await fetch('/api/despliegue/detener-instancia-dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Error al detener instancia de desarrollo.');
    }

    return 'Instancia de desarrollo detenida.';
  },
});

register({
  name: '/despliegue_ver_estado',
  category: 'Despliegue',
  description: 'Muestra el estado actual de los procesos de desarrollo.',
  usage: '/despliegue_ver_estado',
  async execute(args, { chatStore }) {
    const res = await fetch('/api/despliegue/estado-instancia-dev', {
      credentials: 'include',
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Error al obtener estado de la instancia de desarrollo.');
    }

    if (!data.processes || data.processes.length === 0) {
      return '(No hay procesos de desarrollo activos. Use /despliegue_iniciar_instancia para iniciarlos.)';
    }

    const lines = data.processes.map((p) => {
      const icon = p.status === 'running' ? '🟢' : p.status === 'error' ? '🔴' : '⚫';
      const typeLabel = p.type === 'backend' ? 'nodemon' : 'npm run dev';
      let line = `${icon} ${p.name} (${typeLabel}) — ${p.status}`;
      if (p.status === 'running') {
        if (p.detectedUrl) line += ` → ${p.detectedUrl}`;
        const bs = (data.browserSessions || []).find(b => b.name === p.name);
        if (bs) line += ` 🖥️ (${bs.idSession.slice(0, 8)}…)`;
      }
      return line;
    });

    if (data.resolution) {
      lines.push(`\n🖥️ Resolución: ${data.resolution.id} — ${data.resolution.width}x${data.resolution.height}`);
    }

    return lines.join('\n');
  },
});
