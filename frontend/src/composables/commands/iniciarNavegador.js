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

async function fetchDefaultResolution(resolutions) {
  try {
    const res = await fetch('/api/command/setting/default_resolution', { credentials: 'include' });
    const data = await res.json();
    if (data.value) {
      return resolutions.find(r => r.id === data.value) || null;
    }
  } catch {
    return null;
  }
  return null;
}

function parseArgs(args) {
  let navegador = 'chrome';
  let url = '';
  let resolutionId = '';

  for (const arg of args) {
    if (arg.startsWith('--resolution=')) {
      resolutionId = arg.slice('--resolution='.length);
    } else if (arg.startsWith('--navegador=')) {
      const val = arg.slice('--navegador='.length);
      if (val === 'chrome' || val === 'firefox') navegador = val;
    } else if (arg.startsWith('--url=')) {
      url = arg.slice('--url='.length);
    } else if (arg === 'chrome' || arg === 'firefox') {
      navegador = arg;
    } else if (!arg.startsWith('--')) {
      url = arg;
    }
  }

  return { navegador, url, resolutionId };
}

register({
  name: '/navegador_iniciar',
  category: 'Navegador',
  description: 'Inicia una sesión de navegador web (chrome o firefox). Usa --resolution=ID o la resolución por defecto del usuario.',
  usage: '/navegador_iniciar [--navegador=chrome|firefox] [--resolution=ID] [--url=URL]',
  async autocomplete(args, cmdStore) {
    const hasResolution = args.find(a => a.startsWith('--resolution='))
    const hasUrl = args.find(a => a.startsWith('--url='))

    const navegadorArg = args.find(a => a.startsWith('--navegador='))
    if (navegadorArg) {
      const val = navegadorArg.slice('--navegador='.length)
      if (val === 'chrome' || val === 'firefox') {
        // flag completo, seguir para sugerir flags restantes
      } else if (!val) {
        cmdStore.showAutocomplete([
          { display: 'chrome', value: '--navegador=chrome' },
          { display: 'firefox', value: '--navegador=firefox' },
        ])
        return
      } else {
        const prefix = val.toLowerCase()
        const filtered = ['chrome', 'firefox'].filter(b => b.includes(prefix))
        cmdStore.showAutocomplete(
          filtered.map(b => ({ display: b, value: `--navegador=${b}` }))
        )
        return
      }
    }

    const resolutionArg = args.find(a => a.startsWith('--resolution='))
    if (resolutionArg) {
      const resolutions = await fetchResolutions()
      if (!resolutions.length) {
        cmdStore.hideAutocomplete()
        return
      }
      const val = resolutionArg.slice('--resolution='.length)
      if (val && resolutions.find(r => r.id === val)) {
        // flag completo, seguir para sugerir flags restantes
      } else if (!val) {
        cmdStore.showAutocomplete(
          resolutions.map(r => ({
            display: `${r.id} — ${r.width}x${r.height}`,
            value: `--resolution=${r.id}`,
          }))
        )
        return
      } else {
        const prefix = val.toLowerCase()
        const filtered = resolutions.filter(r => r.id.toLowerCase().includes(prefix))
        cmdStore.showAutocomplete(
          filtered.map(r => ({
            display: `${r.id} — ${r.width}x${r.height}`,
            value: `--resolution=${r.id}`,
          }))
        )
        return
      }
    }

    const suggestions = []
    if (!args.find(a => a.startsWith('--navegador='))) suggestions.push('--navegador=')
    if (!hasResolution) suggestions.push('--resolution=')
    if (!hasUrl) suggestions.push('--url=')
    cmdStore.showAutocomplete(suggestions)
  },
  async execute(args, { chatStore, loadingIdx, sessionId }) {
    const { navegador, url, resolutionId } = parseArgs(args)

    if (navegador !== 'chrome' && navegador !== 'firefox') {
      throw new Error(`Navegador no soportado: "${navegador}". Usa chrome o firefox.`)
    }

    const resolutions = await fetchResolutions()
    let resolution = null
    if (resolutionId) {
      resolution = resolutions.find(r => r.id === resolutionId)
      if (!resolution) {
        const avail = resolutions.map(r => r.id).join(', ')
        throw new Error(`Resolución no válida: "${resolutionId}". Resoluciones disponibles: ${avail || '(ninguna configurada)'}`)
      }
    } else {
      resolution = await fetchDefaultResolution(resolutions)
    }

    try {
      chatStore.messages[loadingIdx].content = `Iniciando ${navegador}${resolution ? ' (' + resolution.width + 'x' + resolution.height + ')' : ''}...`

      const startRes = await fetch('/api/navegador/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          comando: 'start',
          parametros: { navegador, ...(resolution ? { resolution } : {}) },
          sessionId,
        }),
      })
      const startData = await startRes.json()

      if (!startRes.ok) {
        throw new Error(startData.error || 'Error al iniciar navegador')
      }

      const idSession = startData.id_session

      if (url) {
        chatStore.messages[loadingIdx].content = `Navegando a ${url}...`

        const navRes = await fetch('/api/navegador/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ comando: 'go_to_url', parametros: { id_session: idSession, url }, sessionId }),
        })
        const navData = await navRes.json()

        if (!navRes.ok) {
          throw new Error(navData.error || 'Error al navegar')
        }
      }

      const parts = [`${navegador} iniciado correctamente`]
      if (url) parts.push(`navegó a ${url}`)
      if (resolution) parts.push(`resolución: ${resolution.width}x${resolution.height}`)
      chatStore.pushMessage({
        role: 'result',
        content: parts.join(', '),
        _key: 'result-' + Date.now(),
      }, sessionId)
    } catch (err) {
      console.error('Error en /navegador_iniciar:', err.message)
      throw err
    }
  },
})
