import { useCommandRegistry } from '../useCommandRegistry.js';
import { useUiStore } from '../../stores/ui.js';

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
    const res = await fetch('/api/command/setting/default_resolution', { credentials: 'include' });
    const data = await res.json();
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
  name: '/despliegue_upd_config',
  category: 'Despliegue',
  description: 'Lee deploy.json del directorio del proyecto y guarda la configuración de despliegue en la base de datos.',
  usage: '/despliegue_upd_config',
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId;
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.');
    }

    const res = await fetch('/api/despliegue/upd-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Error al actualizar configuración de despliegue.');
    }

    return data.message;
  },
});

register({
  name: '/despliegue_show_config',
  category: 'Despliegue',
  description: 'Muestra la configuración de despliegue guardada para el proyecto actual.',
  usage: '/despliegue_show_config',
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId;
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
  name: '/iniciar_instancia_dev',
  category: 'Despliegue',
  description: 'Instala dependencias (npm ci) e inicia los procesos de desarrollo (nodemon para backend, npm run dev para frontend) según la configuración de despliegue.',
  usage: '/iniciar_instancia_dev [--resolucion=ID]',
  async autocomplete(args, cmdStore) {
    const resolutionArg = args.find(a => a.startsWith('--resolucion='));
    if (!resolutionArg) {
      cmdStore.showAutocomplete(['--resolucion=']);
      return;
    }
    const resolutions = await fetchResolutions();
    if (!resolutions.length) {
      cmdStore.hideAutocomplete();
      return;
    }
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
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId;
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
        const fe = (data.frontendPorts || []).find(f => f.name === r.name);
        if (fe) line += ` → ${fe.url}`;
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
  name: '/instancia_dev_detener',
  category: 'Despliegue',
  description: 'Detiene todos los procesos de desarrollo iniciados con /iniciar_instancia_dev.',
  usage: '/instancia_dev_detener',
  async execute(args, { chatStore }) {
    const res = await fetch('/api/despliegue/detener-instancia-dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Error al detener instancia de desarrollo.');
    }

    return 'Instancia de desarrollo detenida.';
  },
});

register({
  name: '/instancia_dev_estado',
  category: 'Despliegue',
  description: 'Muestra el estado actual de los procesos de desarrollo.',
  usage: '/instancia_dev_estado',
  async execute(args, { chatStore }) {
    const res = await fetch('/api/despliegue/estado-instancia-dev', {
      credentials: 'include',
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Error al obtener estado de la instancia de desarrollo.');
    }

    if (!data.processes || data.processes.length === 0) {
      return '(No hay procesos de desarrollo activos. Use /iniciar_instancia_dev para iniciarlos.)';
    }

    const lines = data.processes.map((p) => {
      const icon = p.status === 'running' ? '🟢' : p.status === 'error' ? '🔴' : '⚫';
      const typeLabel = p.type === 'backend' ? 'nodemon' : 'npm run dev';
      let line = `${icon} ${p.name} (${typeLabel}) — ${p.status}`;
      if (p.status === 'running') {
        const fe = (data.frontendPorts || []).find(f => f.name === p.name);
        if (fe) line += ` → ${fe.url}`;
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
