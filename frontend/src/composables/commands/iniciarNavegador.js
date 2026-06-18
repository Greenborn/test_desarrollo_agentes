import { useCommandRegistry } from '../useCommandRegistry.js';

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

function parseArgs(args) {
  let navegador = 'chrome';
  let url = '';
  let resolutionId = '';

  for (const arg of args) {
    if (arg.startsWith('--resolution=')) {
      resolutionId = arg.slice('--resolution='.length);
    } else if (arg === 'chrome' || arg === 'firefox') {
      navegador = arg;
    } else if (!arg.startsWith('--')) {
      url = arg;
    }
  }

  return { navegador, url, resolutionId };
}

register({
  name: '/iniciar_navegador',
  category: 'Navegador',
  description: 'Inicia una sesión de navegador web (chrome o firefox). Opcional: --resolution=ID y URL.',
  usage: '/iniciar_navegador [chrome|firefox] [--resolution=ID] [url]',
  async autocomplete(args, cmdStore) {
    const resolutionArg = args.find(a => a.startsWith('--resolution='))
    if (!resolutionArg) {
      cmdStore.showAutocomplete(['--resolution='])
      return
    }
    const resolutions = await fetchResolutions()
    if (!resolutions.length) {
      cmdStore.hideAutocomplete()
      return
    }
    const prefix = resolutionArg.slice('--resolution='.length).toLowerCase()
    const filtered = prefix
      ? resolutions.filter(r => r.id.toLowerCase().includes(prefix))
      : resolutions
    cmdStore.showAutocomplete(
      filtered.map(r => ({
        display: `${r.id} — ${r.width}x${r.height}`,
        value: `--resolution=${r.id}`,
      }))
    )
  },
  async execute(args, { chatStore, loadingIdx }) {
    const { navegador, url, resolutionId } = parseArgs(args)

    if (navegador !== 'chrome' && navegador !== 'firefox') {
      throw new Error(`Navegador no soportado: "${navegador}". Usa chrome o firefox.`)
    }

    let resolution = null
    if (resolutionId) {
      const resolutions = await fetchResolutions()
      resolution = resolutions.find(r => r.id === resolutionId)
      if (!resolution) {
        const avail = resolutions.map(r => r.id).join(', ')
        throw new Error(`Resolución no válida: "${resolutionId}". Resoluciones disponibles: ${avail || '(ninguna configurada)'}`)
      }
    }

    try {
      chatStore.messages[loadingIdx].content = `Iniciando ${navegador}${resolution ? ' (' + resolution.width + 'x' + resolution.height + ')' : ''}...`

      const startRes = await fetch('/api/playwright/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          comando: 'start',
          parametros: { navegador, ...(resolution ? { resolution } : {}) },
        }),
      })
      const startData = await startRes.json()

      if (!startRes.ok) {
        throw new Error(startData.error || 'Error al iniciar navegador')
      }

      const idSession = startData.id_session

      if (url) {
        chatStore.messages[loadingIdx].content = `Navegando a ${url}...`

        const navRes = await fetch('/api/playwright/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ comando: 'go_to_url', parametros: { id_session: idSession, url } }),
        })
        const navData = await navRes.json()

        if (!navRes.ok) {
          throw new Error(navData.error || 'Error al navegar')
        }
      }

      const parts = [`${navegador} iniciado correctamente`]
      if (url) parts.push(`navegó a ${url}`)
      if (resolution) parts.push(`resolución: ${resolution.width}x${resolution.height}`)
      chatStore.messages.push({
        role: 'result',
        content: parts.join(', '),
        _key: 'result-' + Date.now(),
      })
    } catch (err) {
      console.error('Error en /iniciar_navegador:', err.message)
      throw err
    }
  },
})
