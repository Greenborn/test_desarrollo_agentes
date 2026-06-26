const API_KEY = process.env.GESTOR_API_KEY;
if (!API_KEY) {
  console.log('GESTOR_API_KEY no está definida en .env');
  process.exit(1);
}

export default function authMiddleware(req, res, next) {
  if (req.path === '/keepalive') {
    return next();
  }

  const token = req.headers['authorization']?.replace(/^Bearer\s+/i, '')
    || req.headers['x-api-key']
    || req.query.api_key;

  if (!token || token !== API_KEY) {
    return res.status(401).json({ error: 'API key inválida' });
  }

  next();
}
