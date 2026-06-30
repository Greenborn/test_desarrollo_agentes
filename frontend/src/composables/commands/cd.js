import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/cd',
  category: 'Navegación',
  description: 'Cambia el directorio de trabajo. Sin argumentos muestra un selector interactivo. Soporta rutas absolutas, relativas, ".", "..", "~" y autocompletado con Tab.',
  usage: '/cd [--dir=<ruta>]',
  autocomplete(args, cmdStore) {
    const dirArg = args.find(a => a.startsWith('--dir='))
    if (dirArg) {
      const prefix = dirArg.slice('--dir='.length) || '/'
      cmdStore.fetchAutocomplete(prefix, cmdStore.currentDir)
    } else {
      cmdStore.showAutocomplete(['--dir='])
    }
  },
  async execute(args, { cmdStore, chatStore, sessionId }) {
    const { params, errors } = parseCommandArgs(args, { dir: { required: false } })

    if (!params.dir) {
      if (!sessionId) {
        throw new Error('Primero debe iniciar una sesión de chat.')
      }
      const initialDir = cmdStore.currentDir || '/'
      return {
        role: 'opencode_control',
        controlData: {
          controlType: 'cd_selector',
          controlId: 'cd-' + Date.now(),
          currentDir: initialDir,
        },
      }
    }

    const dir = params.dir
    try {
      const res = await fetch('/api/command/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command: `/cd ${dir}`, sessionId }),
      })
      const data = await res.json()
      if (data.success) {
        cmdStore.currentDir = data.result
        return data.result
      } else {
        throw new Error(data.result || 'Error al cambiar de directorio')
      }
    } catch (err) {
      console.error('Error en /cd:', err.message)
      throw err
    }
  },
})
