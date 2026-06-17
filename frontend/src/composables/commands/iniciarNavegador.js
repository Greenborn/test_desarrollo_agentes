import { useCommandRegistry } from '../useCommandRegistry.js';

const { register } = useCommandRegistry();

register({
  name: '/iniciar_navegador',
  category: 'Utilidades',
  description: 'Abre un navegador (chrome/firefox) en una URL usando Playwright',
  usage: '/iniciar_navegador <chrome|firefox> <url>',
  async execute(args, { chatStore, loadingIdx }) {
    const navegador = args[0];
    const url = args[1];

    if (!navegador || !url) {
      throw new Error('Uso: /iniciar_navegador <chrome|firefox> <url>');
    }

    if (navegador !== 'chrome' && navegador !== 'firefox') {
      throw new Error(`Navegador no soportado: "${navegador}". Usa chrome o firefox.`);
    }

    try {
      chatStore.messages[loadingIdx].content = `Iniciando ${navegador}...`;

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
      chatStore.messages[loadingIdx].content = `Navegando a ${url}...`;

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
      throw err;
    }
  },
});
