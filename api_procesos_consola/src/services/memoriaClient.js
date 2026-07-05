import http from 'http';

const MEMORIA_HOST = process.env.MEMORIA_HOST || 'localhost';
const MEMORIA_PORT = process.env.SERVICIO_MEMORIA_PORT || 4101;
const MEMORIA_API_KEY = process.env.MEMORIA_API_KEY;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: MEMORIA_HOST,
      port: MEMORIA_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': MEMORIA_API_KEY || '',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body !== undefined) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

export function setKey(key, value) {
  return request('POST', `/api/memoria/${encodeURIComponent(key)}`, value);
}

export function getKey(key) {
  return request('GET', `/api/memoria/${encodeURIComponent(key)}`);
}

export function delKey(key) {
  return request('DELETE', `/api/memoria/${encodeURIComponent(key)}`);
}

export function keys(pattern) {
  return request('GET', `/api/memoria/keys/${encodeURIComponent(pattern)}`);
}
