import { useCommandRegistry } from '../useCommandRegistry.js';

const { register } = useCommandRegistry();

register({
  name: '/git',
  category: 'Git',
  description: 'Ejecuta un comando de Git en el directorio de la sesión y muestra el resultado.',
  usage: '/git <comando git>',
  async execute(args, { cmdStore, chatStore }) {
    const command = args.join(' ');
    if (!command) {
      chatStore.messages.push({
        role: 'result',
        content: 'Error: debe especificar un comando git. Ej: /git status',
        _key: 'err-' + Date.now(),
      });
      return;
    }

    const sessionId = chatStore.activeSessionId;
    if (!sessionId) {
      chatStore.messages.push({
        role: 'result',
        content: 'Primero debe iniciar una sesión de chat.',
        _key: 'err-' + Date.now(),
      });
      return;
    }

    chatStore.messages.push({
      role: 'command',
      content: `/git ${command}`,
      _key: 'cmd-' + Date.now(),
    });

    const msgIdx = chatStore.messages.length;
    chatStore.messages.push({
      role: 'result',
      content: '⏳ Ejecutando git...',
      _key: 'result-' + Date.now(),
    });

    try {
      const res = await fetch('/api/command/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command, sessionId }),
      });
      const data = await res.json();

      if (data.success) {
        chatStore.messages[msgIdx] = {
          role: 'result',
          content: data.stdout || '(sin salida)',
          _key: 'result-' + Date.now(),
        };
      } else {
        chatStore.messages[msgIdx] = {
          role: 'result',
          content: data.stderr || data.error || 'Error desconocido',
          _key: 'err-' + Date.now(),
        };
      }
    } catch (err) {
      console.error('Error en /git:', err);
      chatStore.messages[msgIdx] = {
        role: 'result',
        content: 'Error: ' + err.message,
        _key: 'err-' + Date.now(),
      };
    }
  },
});
