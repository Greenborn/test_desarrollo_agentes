// Empuja eventos de streaming (chat, opencode, componentes) hacia el servicio
// `interfaz_remota`, que es quien sostiene la conexión socket.io con la gestión interna
// y los reenvía. Reemplaza al antiguo `socket.emit(...)` directo de este proceso.
const API_KEY = process.env.INTERFAZ_REMOTA_API_KEY;

function targetUrl() {
  const port = process.env.SERVICIO_INTERFAZ_REMOTA_PORT;
  if (!port) return null;
  return `http://127.0.0.1:${port}/internal/relay`;
}

export async function emitToInterfazRemota(event, payload) {
  const url = targetUrl();
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ event, payload }),
    });
  } catch (err) {
    console.log('[interfaz_remota_bridge] error al reenviar evento', event, ':', err.message);
  }
}
