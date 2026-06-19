import { useCommandRegistry } from '../useCommandRegistry.js';
import { parseCommandArgs } from '../parseCommandArgs.js';

const { register } = useCommandRegistry();

register({
  name: '/arbol_directorios',
  category: 'Navegación',
  description: 'Muestra el árbol de directorios en formato JSON. Si no se especifica ruta, usa el directorio base de la sesión.',
  usage: '/arbol_directorios [--dir=&lt;ruta&gt;] [--gitignore=&lt;bool&gt;] [--filter-extension=&lt;ext1,ext2&gt;]',
  autocomplete(args, cmdStore) {
    const dirArg = args.find(a => a.startsWith('--dir='))
    if (dirArg) {
      const prefix = dirArg.slice('--dir='.length) || '/'
      cmdStore.fetchAutocomplete(prefix, cmdStore.currentDir)
    } else {
      const hasGitignore = args.find(a => a.startsWith('--gitignore'))
      const hasFilter = args.find(a => a.startsWith('--filter-extension'))
      const suggestions = []
      if (!dirArg) suggestions.push('--dir=')
      if (!hasGitignore) suggestions.push('--gitignore=')
      if (!hasFilter) suggestions.push('--filter-extension=')
      cmdStore.showAutocomplete(suggestions)
    }
  },
  async execute(args, { cmdStore, chatStore }) {
    const { params } = parseCommandArgs(args, {
      dir: { required: false },
      gitignore: { required: false },
      'filter-extension': { required: false },
    })
    const dir = params.dir || ''
    const useGitignore = params.gitignore === undefined ? true : params.gitignore !== 'false'
    const filterExtension = params['filter-extension'] || ''
    const sessionId = chatStore.activeSessionId
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    try {
      const qparams = new URLSearchParams()
      if (dir) qparams.set('dir', dir)
      qparams.set('sessionId', sessionId)
      qparams.set('useGitignore', String(useGitignore))
      if (filterExtension) qparams.set('filterExtension', filterExtension)
      const res = await fetch(`/api/command/arbol-directorios?${qparams.toString()}`, { credentials: 'include' })
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Error desconocido')
      }

      return JSON.stringify(data.tree, null, 2)
    } catch (err) {
      console.error('Error en /arbol_directorios:', err)
      throw err
    }
  },
})
