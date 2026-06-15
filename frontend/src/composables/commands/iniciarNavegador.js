import { useCommandRegistry } from '../useCommandRegistry.js';

const { register } = useCommandRegistry();

register({
  name: '/iniciar_navegador',
  category: 'Utilidades',
  description: 'Abre un navegador (chrome/firefox) en una URL usando Playwright',
  usage: '/iniciar_navegador <chrome|firefox> <url>',
  async execute(args, { chatStore }) {
    const navegador = args[0];
    const url = args[1];

    if (!navegador || !url) {
      chatStore.messages.push({
        role: 'result',
        content: 'Uso: /iniciar_navegador <chrome|firefox> <url>',
        _key: 'result-' + Date.now(),
      });
      return;
    }

    if (navegador !== 'chrome' && navegador !== 'firefox') {
      chatStore.messages.push({
        role: 'result',
        content: `Navegador no soportado: "${navegador}". Usa chrome o firefox.`,
        _key: 'result-' + Date.now(),
      });
      return;
    }

    chatStore.messages.push({
      role: 'command',
      content: `/iniciar_navegador ${navegador} ${url}`,
      _key: 'cmd-' + Date.now(),
    });

    const msgIdx = chatStore.messages.length;
    chatStore.messages.push({
      role: 'result',
      content: `Iniciando ${navegador}...`,
      _key: 'result-' + Date.now(),
    });

    try {
      const startRes = await fetch('/api/playwright/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ comando: 'start', parametros: { navegador } }),
      });
      const startData = await startRes.json();

      if (!startRes.ok) {
        throw new Error(startData.error || 'Error al iniciar navegador');
      }

      const idSession = startData.id_session;
      chatStore.messages[msgIdx] = {
        role: 'result',
        content: `Navegando a ${url}...`,
        _key: 'result-' + Date.now(),
      };

      const navRes = await fetch('/api/playwright/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ comando: 'go_to_url', parametros: { id_session: idSession, url } }),
      });
      const navData = await navRes.json();

      if (!navRes.ok) {
        throw new Error(navData.error || 'Error al navegar');
      }

      chatStore.messages.push({
        role: 'result',
        content: `${navegador} navegó a ${url} correctamente`,
        _key: 'result-' + Date.now(),
      });
    } catch (err) {
      console.error('Error en /iniciar_navegador:', err.message);
      chatStore.messages.push({
        role: 'result',
        content: `Error: ${err.message}`,
        _key: 'result-' + Date.now(),
      });
    }
  },
});
