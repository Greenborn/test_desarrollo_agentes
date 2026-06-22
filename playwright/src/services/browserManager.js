import { chromium, firefox } from 'playwright';
import crypto from 'crypto';

const sessions = new Map();
let defaultHeadless = false;
let db = null;

const ALLOWED_RESOURCE_TYPES = ['document', 'xhr', 'fetch'];
const MAX_BODY_LENGTH = 10000;

function setDb(knexInstance) {
  db = knexInstance;
}

function generateId() {
  return crypto.randomUUID();
}

function getBrowserType(navegador) {
  if (navegador === 'chrome') return chromium;
  if (navegador === 'firefox') return firefox;
  return null;
}

function setDefaultHeadless(value) {
  defaultHeadless = !!value;
}

function getDefaultHeadless() {
  return defaultHeadless;
}

function setupPageListeners(page, sessionId, chatSessionId) {
  page.on('response', async (response) => {
    const req = response.request();
    const resourceType = req.resourceType();
    if (!ALLOWED_RESOURCE_TYPES.includes(resourceType)) return;

    let body = null;
    try {
      const buf = await response.body();
      body = buf.toString('utf-8').substring(0, MAX_BODY_LENGTH);
    } catch {
      body = null;
    }

    try {
      if (!db) return;
      await db('playwright_network_logs').insert({
        chat_session_id: chatSessionId,
        playwright_session_id: sessionId,
        method: req.method(),
        url: req.url(),
        status_code: response.status(),
        request_headers: JSON.stringify(req.headers()),
        response_headers: JSON.stringify(response.headers()),
        resource_type: resourceType,
        response_body: body,
      });
    } catch (err) {
      console.log(`[browserManager] Error al guardar network log:`, err.message);
    }
  });

  page.on('requestfailed', async (request) => {
    const resourceType = request.resourceType();
    if (!ALLOWED_RESOURCE_TYPES.includes(resourceType)) return;

    try {
      if (!db) return;
      await db('playwright_network_logs').insert({
        chat_session_id: chatSessionId,
        playwright_session_id: sessionId,
        method: request.method(),
        url: request.url(),
        status_code: null,
        request_headers: JSON.stringify(request.headers()),
        resource_type: resourceType,
        error: request.failure()?.errorText || 'Unknown error',
      });
    } catch (err) {
      console.log(`[browserManager] Error al guardar request failed:`, err.message);
    }
  });

  page.on('console', async (msg) => {
    try {
      if (!db) return;
      const location = msg.location();
      const locationStr = location ? `${location.url}:${location.lineNumber}:${location.columnNumber}` : null;

      await db('playwright_console_logs').insert({
        chat_session_id: chatSessionId,
        playwright_session_id: sessionId,
        type: msg.type(),
        text: msg.text(),
        location: locationStr,
      });
    } catch (err) {
      console.log(`[browserManager] Error al guardar console log:`, err.message);
    }
  });
}

async function startSession(navegador, headless, resolution, chatSessionId) {
  if (!navegador) {
    throw new Error('Parámetro "navegador" es requerido');
  }

  const browserType = getBrowserType(navegador);
  if (!browserType) {
    throw new Error(`Navegador no soportado: "${navegador}". Soporta: chrome, firefox`);
  }

  const headlessMode = headless !== undefined ? !!headless : defaultHeadless;

  const launchArgs = [];
  if (resolution && resolution.width && resolution.height) {
    if (navegador === 'chrome') {
      launchArgs.push(`--window-size=${resolution.width},${resolution.height}`);
    } else if (navegador === 'firefox') {
      launchArgs.push(`--width=${resolution.width}`);
      launchArgs.push(`--height=${resolution.height}`);
    }
  }

  let browser;
  try {
    browser = await browserType.launch({
      headless: headlessMode,
      args: launchArgs.length > 0 ? launchArgs : undefined,
    });
  } catch (err) {
    console.log('Error al lanzar navegador:', err.message);
    throw new Error(`No se pudo iniciar ${navegador}: ${err.message}`);
  }

  const contextOptions = {};
  if (resolution && resolution.width && resolution.height) {
    contextOptions.viewport = { width: resolution.width, height: resolution.height };
  }
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  const id = generateId();
  const safeChatSessionId = chatSessionId || null;
  sessions.set(id, { browser, context, page, navegador, headless: headlessMode, resolution: resolution || null, chatSessionId: safeChatSessionId });

  setupPageListeners(page, id, safeChatSessionId);

  const resInfo = resolution ? `, resolución: ${resolution.width}x${resolution.height}` : '';
  const chatInfo = safeChatSessionId ? `, chat_session: ${safeChatSessionId}` : '';
  console.log(`Sesión ${id} iniciada con ${navegador} (headless: ${headlessMode}${resInfo}${chatInfo})`);
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

async function extractFormControls(idSession) {
  if (!idSession) {
    throw new Error('Parámetro "id_session" es requerido');
  }

  const session = sessions.get(idSession);
  if (!session) {
    throw new Error(`Sesión no encontrada: "${idSession}"`);
  }

  const { page } = session;

  try {
    const result = await page.evaluate(() => {
      const controls = [];

      document.querySelectorAll('input, select, textarea, button').forEach((el) => {
        const tag = el.tagName.toLowerCase();
        const rect = el.getBoundingClientRect();

        const control = {
          tag,
          type: el.type || null,
          name: el.name || null,
          id: el.id || null,
          class: el.className || null,
          placeholder: el.placeholder || null,
          value: el.value !== undefined ? el.value : null,
          disabled: el.disabled || false,
          required: el.required || false,
          readOnly: el.readOnly || false,
          visible: rect.width > 0 && rect.height > 0,
          tabIndex: el.tabIndex >= 0 ? el.tabIndex : null,
          checked: (el.type === 'checkbox' || el.type === 'radio') ? el.checked : undefined,
          minLength: el.minLength != null ? el.minLength : null,
          maxLength: el.maxLength != null ? el.maxLength : null,
          min: el.min != null ? el.min : null,
          max: el.max != null ? el.max : null,
          pattern: el.pattern || null,
          autocomplete: el.autocomplete || null,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          form: el.form ? (el.form.id || el.form.name || null) : null,
        };

        if (el.id) {
          const labelEl = document.querySelector(`label[for="${el.id}"]`);
          if (labelEl) control.label = labelEl.textContent.trim();
        }
        if (!control.label && el.closest('label')) {
          control.label = el.closest('label').textContent.trim();
        }
        if (!control.label) {
          control.label = el.getAttribute('aria-label') || null;
        }

        if (tag === 'select') {
          control.multiple = el.multiple || false;
          control.options = Array.from(el.options).map((opt) => ({
            value: opt.value,
            text: opt.textContent.trim(),
            selected: opt.selected,
          }));
        }

        if (tag === 'textarea') {
          control.rows = el.rows || null;
          control.cols = el.cols || null;
        }

        controls.push(control);
      });

      const forms = Array.from(document.querySelectorAll('form')).map((f) => ({
        id: f.id || null,
        name: f.name || null,
        action: f.action || null,
        method: f.method || null,
        autocomplete: f.autocomplete || null,
        novalidate: f.noValidate || false,
      }));

      return {
        controls,
        forms,
        url: window.location.href,
        title: document.title,
      };
    });

    console.log(`Sesión ${idSession} extrajo ${result.controls.length} controles de formulario`);
    return result;
  } catch (err) {
    console.log(`Error al extraer controles en sesión ${idSession}:`, err.message);
    throw new Error(`Error al extraer controles de formulario: ${err.message}`);
  }
}

function getSession(idSession) {
  return sessions.get(idSession) || null;
}

function getActiveSession() {
  for (const [id, session] of sessions) {
    return { id, ...session };
  }
  return null;
}

function closeSession(idSession) {
  const session = sessions.get(idSession);
  if (!session) return false;
  session.browser.close();
  sessions.delete(idSession);
  return true;
}

function closeAllSessions() {
  for (const [id] of sessions) {
    closeSession(id);
  }
}

export default {
  setDb,
  startSession,
  goToUrl,
  extractFormControls,
  getSession,
  getActiveSession,
  closeSession,
  closeAllSessions,
  setDefaultHeadless,
  getDefaultHeadless,
};
