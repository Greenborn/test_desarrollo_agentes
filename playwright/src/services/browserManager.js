import { chromium, firefox } from 'playwright';
import crypto from 'crypto';

const sessions = new Map();

function generateId() {
  return crypto.randomUUID();
}

function getBrowserType(navegador) {
  if (navegador === 'chrome') return chromium;
  if (navegador === 'firefox') return firefox;
  return null;
}

async function startSession(navegador) {
  if (!navegador) {
    throw new Error('Parámetro "navegador" es requerido');
  }

  const browserType = getBrowserType(navegador);
  if (!browserType) {
    throw new Error(`Navegador no soportado: "${navegador}". Soporta: chrome, firefox`);
  }

  let browser;
  try {
    browser = await browserType.launch();
  } catch (err) {
    console.log('Error al lanzar navegador:', err.message);
    throw new Error(`No se pudo iniciar ${navegador}: ${err.message}`);
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  const id = generateId();
  sessions.set(id, { browser, context, page, navegador });

  console.log(`Sesión ${id} iniciada con ${navegador}`);
  return id;
}

async function goToUrl(idSession, url) {
  if (!idSession) {
    throw new Error('Parámetro "id_session" es requerido');
  }
  if (!url) {
    throw new Error('Parámetro "url" es requerido');
  }

  const session = sessions.get(idSession);
  if (!session) {
    throw new Error(`Sesión no encontrada: "${idSession}"`);
  }

  try {
    await session.page.goto(url, { waitUntil: 'load' });
    console.log(`Sesión ${idSession} navegó a ${url}`);
  } catch (err) {
    console.log(`Error al navegar en sesión ${idSession} a ${url}:`, err.message);
    throw new Error(`Error al navegar a ${url}: ${err.message}`);
  }
}

function getSession(idSession) {
  return sessions.get(idSession) || null;
}

function closeSession(idSession) {
  const session = sessions.get(idSession);
  if (!session) return false;
  session.browser.close();
  sessions.delete(idSession);
  return true;
}

export default {
  startSession,
  goToUrl,
  getSession,
  closeSession,
};
