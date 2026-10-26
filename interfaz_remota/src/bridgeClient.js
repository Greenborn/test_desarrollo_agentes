// Cliente HTTP hacia las rutas internas del backend principal (chat_sessions, comandos
// personalizados, opencode, componentes bridgeados): esa lógica depende del estado propio
// del backend (DB de chat, streaming DeepSeek, componentHub/terminalBridge compartidos con
// la UI local) y se queda ahí; este servicio solo retransmite la solicitud/respuesta.
const BACKEND_PORT = process.env.PORT;
const API_KEY = process.env.INTERFAZ_REMOTA_API_KEY;
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}/internal/interfaz-remota`;

export async function callBackend(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    return { success: false, error: `Respuesta no-JSON del backend (status ${res.status})` };
  }
}
