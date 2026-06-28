import { useCommandRegistry } from '../useCommandRegistry.js';

const { register } = useCommandRegistry();

register({
  name: '/navegador_capturar_pantalla',
  category: 'Navegador',
  description: 'Toma una captura de pantalla del navegador activo y la guarda en el proyecto vinculado a la sesión.',
  usage: '/navegador_capturar_pantalla [--fullpage=true]',
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const fullpageFlag = args.find(a => a.startsWith('--fullpage='))
    const fullpage = fullpageFlag ? fullpageFlag.slice(11) === 'true' : false

    const res = await fetch('/api/navegador/capturar-pantalla', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId, fullpage }),
    })

    const data = await res.json()

    if (data.error) {
      throw new Error(data.error)
    }

    const a = data.archivo
    return [
      `Captura de pantalla guardada:`,
      `  ID: ${a.id}`,
      `  Nombre: ${a.nombre_original}`,
      `  Tamaño: ${(a.tamano / 1024).toFixed(1)} KB`,
      `  Proyecto: ${a.proyecto_id}`,
      `  Fecha: ${a.created_at}`,
    ].join('\n')
  },
})
