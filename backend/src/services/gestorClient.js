const GESTOR_PORT = process.env.SERVICIO_GESTOR_PORT || 4200;
const API_KEY = process.env.GESTOR_API_KEY;
const BASE_URL = `http://localhost:${GESTOR_PORT}/api/gestor`;

const headers = {
  'Content-Type': 'application/json',
  ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
};

async function request(method, path, body) {
  const opts = { method, headers };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, opts);

  if (!res.ok) {
    const text = await res.text();
    let detail;
    try { detail = JSON.parse(text).error; } catch { detail = text; }
    throw new Error(`Gestor API error ${res.status}: ${detail}`);
  }

  return res.json();
}

export default {
  listServices() {
    return request('GET', '/services');
  },

  restartService(name) {
    return request('POST', `/services/${encodeURIComponent(name)}/restart`);
  },

  restartAllServices() {
    return request('POST', '/services/restart-all');
  },
};
