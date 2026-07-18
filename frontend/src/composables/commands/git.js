import { useCommandRegistry } from '../useCommandRegistry.js';

const { register } = useCommandRegistry();

register({
  name: '/git',
  category: 'Git',
  description: 'Ejecuta un comando de Git en el directorio de la sesión y muestra el resultado.',
  usage: '/git <comando>',
  async execute(args, { cmdStore, chatStore, sessionId }) {
    const command = args.join(' ');
    if (!command) {
      throw new Error('Debe especificar un comando git. Ej: /git status');
    }

    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.');
    }

    try {
      const res = await fetch('/api/command/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command, sessionId }),
      });

      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
        const text = await res.text().catch(() => '');
        throw new Error(`Respuesta vacía o inválida del servidor (status ${res.status}): "${text.slice(0, 200)}". El comando git puede haber tardado demasiado o requerido entrada interactiva.`);
      }

      if (data.success) {
        return data.stdout || '(sin salida)';
      }
      throw new Error(data.stderr || data.error || 'Error desconocido');
    } catch (err) {
      console.error('Error en /git:', err);
      throw err;
    }
  },
});
