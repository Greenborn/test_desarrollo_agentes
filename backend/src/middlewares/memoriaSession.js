import crypto from 'crypto';
import memoriaClient from '../services/memoriaClient.js';

const COOKIE_NAME = 'session_token';
const SESSION_TTL = 86400;
const NAMESPACE = 'session';

const cookieOpts = {
  httpOnly: true,
  secure: false,
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_TTL * 1000,
};

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    if (key) cookies[key] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return cookies;
}

function attachSessionMethods(session, req, res) {
  session.save = (callback) => {
    (async () => {
      try {
        let token = session._token;
        const isNew = !token;
        if (!token) {
          token = crypto.randomUUID();
          session._token = token;
        }

        const dataToSave = {};
        for (const key of Object.keys(session)) {
          if (!key.startsWith('_') && key !== 'save' && key !== 'destroy') {
            dataToSave[key] = session[key];
          }
        }

        await memoriaClient.set(NAMESPACE, token, dataToSave, SESSION_TTL);

        if (isNew) {
          res.cookie(COOKIE_NAME, token, cookieOpts);
        }

        if (callback) callback();
      } catch (err) {
        console.log('[memoriaSession] Error al guardar sesión:', err.message);
        if (callback) callback(err);
      }
    })();
  };

  session.destroy = (callback) => {
    (async () => {
      try {
        const token = session._token;
        if (token) {
          await memoriaClient.del(NAMESPACE, token);
        }
      } catch (err) {
        console.log('[memoriaSession] Error al destruir sesión:', err.message);
      }
      res.clearCookie(COOKIE_NAME, { path: '/' });
      for (const key of Object.keys(session)) {
        delete session[key];
      }
      if (callback) callback();
    })();
  };
}

async function memoriaSession(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];

  const sessionData = {};

  if (token) {
    try {
      const data = await memoriaClient.get(NAMESPACE, token);
      if (data && data.value) {
        Object.assign(sessionData, data.value);
        sessionData._token = token;
      }
    } catch (err) {
      console.log('[memoriaSession] Error al cargar sesión:', err.message);
    }
  }

  req.session = sessionData;
  attachSessionMethods(req.session, req, res);
  next();
}

export default memoriaSession;
