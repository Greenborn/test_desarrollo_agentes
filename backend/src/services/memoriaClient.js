const MEMORIA_PORT = process.env.SERVICIO_MEMORIA_PORT || 4101;
const API_KEY = process.env.MEMORIA_API_KEY;
const BASE_URL = `http://localhost:${MEMORIA_PORT}/api/memoria`;

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
    throw new Error(`Memoria API error ${res.status}: ${detail}`);
  }

  return res.json();
}

export default {
  async set(namespace, key, value, ttl) {
    return request('POST', '/set', { namespace, key, value, ttl });
  },

  async get(namespace, key) {
    return request('GET', `/get/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`);
  },

  async del(namespace, key) {
    return request('DELETE', `/del/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`);
  },

  async keys(namespace) {
    return request('GET', `/keys/${encodeURIComponent(namespace)}`);
  },

  async clear(namespace) {
    return request('DELETE', `/clear/${encodeURIComponent(namespace)}`);
  },

  async expire(namespace, key, ttl) {
    return request('POST', `/expire/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`, { ttl });
  },

  async health() {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      return res.ok;
    } catch {
      return false;
    }
  },
};
