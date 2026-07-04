import { useCommandRegistry } from '../useCommandRegistry.js';

const { register } = useCommandRegistry();

register({
  name: '/despliegue_crear_config',
  category: 'Despliegue',
  description: 'Escanea el directorio del proyecto, detecta subproyectos con package.json y genera un archivo deploy.json con la configuración de despliegue.',
  usage: '/despliegue_crear_config [--dir=<ruta>]',
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.');
    }

    const dirArg = args.find(a => a.startsWith('--dir='));
    const body = { sessionId };
    if (dirArg) body.dir = dirArg.slice('--dir='.length);

    const res = await fetch('/api/despliegue/crear-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Error al crear configuración de despliegue.');
    }

    return `${data.message}\n\n${JSON.stringify(data.config, null, 2)}`;
  },
});
