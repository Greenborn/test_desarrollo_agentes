import { chromium, firefox } from 'playwright';
import crypto from 'crypto';

const sessions = new Map();
let defaultHeadless = false;
let db = null;

const ALLOWED_RESOURCE_TYPES = ['document', 'xhr', 'fetch'];
const MAX_BODY_LENGTH = 10000;
const MAX_REQUEST_BODY_LENGTH = 8192;

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

function setupEventRecording(page, sessionId, chatSessionId, recordingId) {
  if (!chatSessionId) return;

  page.exposeFunction('__pwRecordEvent', async (eventData) => {
    try {
      if (!db) return;
      await db('playwright_events').insert({
        chat_session_id: chatSessionId,
        recording_id: recordingId || null,
        playwright_session_id: sessionId,
        event_type: eventData.type,
        selector: eventData.selector || null,
        tag_name: eventData.tagName || null,
        text_content: eventData.textContent ? eventData.textContent.substring(0, 1000) : null,
        value: eventData.value ? eventData.value.substring(0, 1000) : null,
        url: eventData.url || null,
        x: eventData.x != null ? eventData.x : null,
        y: eventData.y != null ? eventData.y : null,
        key: eventData.key || null,
        key_code: eventData.code || null,
        alt_key: eventData.altKey != null ? eventData.altKey : null,
        ctrl_key: eventData.ctrlKey != null ? eventData.ctrlKey : null,
        shift_key: eventData.shiftKey != null ? eventData.shiftKey : null,
        meta_key: eventData.metaKey != null ? eventData.metaKey : null,
        scroll_x: eventData.scrollX != null ? eventData.scrollX : null,
        scroll_y: eventData.scrollY != null ? eventData.scrollY : null,
        target_rect: eventData.targetRect ? JSON.stringify(eventData.targetRect) : null,
        metadata: eventData.metadata ? JSON.stringify(eventData.metadata) : null,
      });
    } catch (err) {
      console.log(`[browserManager] Error al guardar evento:`, err.message);
    }
  });

  async function injectListeners() {
    try {
      await page.evaluate(() => {
        if (window.__pwEventListenersInjected) return;
        window.__pwEventListenersInjected = true;

        function getSelector(el) {
          if (!el || el === document || el === window) return '';
          try {
            if (el.id) return '#' + CSS.escape(el.id);
            if (el.getAttribute && el.getAttribute('data-testid')) {
              return '[data-testid="' + CSS.escape(el.getAttribute('data-testid')) + '"]';
            }
            if (el.getAttribute && el.getAttribute('data-test-id')) {
              return '[data-test-id="' + CSS.escape(el.getAttribute('data-test-id')) + '"]';
            }
            if (el.name && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) {
              const form = el.closest('form');
              if (form && form.id) {
                return '#' + CSS.escape(form.id) + ' ' + el.tagName.toLowerCase() + '[name="' + CSS.escape(el.name) + '"]';
              }
              return el.tagName.toLowerCase() + '[name="' + CSS.escape(el.name) + '"]';
            }
            let path = [];
            let current = el;
            while (current && current !== document && current !== document.body) {
              let segment = current.tagName.toLowerCase();
              if (current.id) {
                segment = '#' + CSS.escape(current.id);
                path.unshift(segment);
                break;
              }
              const parent = current.parentElement;
              if (parent) {
                const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
                if (siblings.length > 1) {
                  segment += ':nth-child(' + (Array.from(parent.children).indexOf(current) + 1) + ')';
                }
              }
              if (current.classList && current.classList.length > 0) {
                const classes = Array.from(current.classList).slice(0, 2).map(c => '.' + CSS.escape(c)).join('');
                segment += classes;
              }
              path.unshift(segment);
              current = current.parentElement;
            }
            return path.join(' > ');
          } catch (e) {
            return el.tagName ? el.tagName.toLowerCase() : '';
          }
        }

        function getLabel(el) {
          try {
            let text = '';
            if (el.textContent) text = el.textContent.trim().substring(0, 100);
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
              const label = el.closest('label');
              if (label) text = label.textContent.trim().substring(0, 100);
              if (!text && el.placeholder) text = el.placeholder;
              if (!text && el.id) {
                const labelById = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
                if (labelById) text = labelById.textContent.trim().substring(0, 100);
              }
            }
            if (el.tagName === 'SELECT') {
              const label = el.closest('label');
              if (label) text = label.textContent.trim().substring(0, 100);
              if (!text && el.id) {
                const labelById = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
                if (labelById) text = labelById.textContent.trim().substring(0, 100);
              }
              if (!text) text = 'Select';
            }
            if (el.tagName === 'BUTTON' || el.tagName === 'A') {
              if (!text) text = el.textContent.trim().substring(0, 100);
            }
            return text;
          } catch (e) {
            return '';
          }
        }

        let inputDebounceTimers = {};
        let scrollDebounceTimer = null;

        window.__pwRecording = true;

        document.addEventListener('click', function (e) {
          if (!window.__pwRecording) return;
          try {
            const el = e.target;
            const rect = el.getBoundingClientRect();
            window.__pwRecordEvent({
              type: 'click',
              selector: getSelector(el),
              tagName: el.tagName.toLowerCase(),
              textContent: getLabel(el),
              value: el.value || null,
              url: window.location.href,
              x: Math.round(e.pageX),
              y: Math.round(e.pageY),
              targetRect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
              altKey: e.altKey,
              ctrlKey: e.ctrlKey,
              shiftKey: e.shiftKey,
              metaKey: e.metaKey,
            });
          } catch (e) {}
        }, true);

        document.addEventListener('dblclick', function (e) {
          if (!window.__pwRecording) return;
          try {
            const el = e.target;
            const rect = el.getBoundingClientRect();
            window.__pwRecordEvent({
              type: 'dblclick',
              selector: getSelector(el),
              tagName: el.tagName.toLowerCase(),
              textContent: getLabel(el),
              url: window.location.href,
              x: Math.round(e.pageX),
              y: Math.round(e.pageY),
              targetRect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
            });
          } catch (e) {}
        }, true);

        document.addEventListener('change', function (e) {
          if (!window.__pwRecording) return;
          try {
            const el = e.target;
            if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
              let val = el.value;
              if (el.type === 'checkbox' || el.type === 'radio') val = el.checked;
              window.__pwRecordEvent({
                type: 'change',
                selector: getSelector(el),
                tagName: el.tagName.toLowerCase(),
                textContent: getLabel(el),
                value: String(val),
                url: window.location.href,
              });
            }
          } catch (e) {}
        }, true);

        document.addEventListener('submit', function (e) {
          if (!window.__pwRecording) return;
          try {
            const el = e.target;
            window.__pwRecordEvent({
              type: 'submit',
              selector: el.id ? '#' + CSS.escape(el.id) : el.tagName.toLowerCase(),
              tagName: 'form',
              textContent: el.id || el.name || '',
              url: window.location.href,
            });
          } catch (e) {}
        }, true);

        document.addEventListener('input', function (e) {
          if (!window.__pwRecording) return;
          try {
            const el = e.target;
            if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
            if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file') return;

            const key = getSelector(el) || el.name || el.id || Math.random();
            if (inputDebounceTimers[key]) clearTimeout(inputDebounceTimers[key]);
            inputDebounceTimers[key] = setTimeout(function () {
              window.__pwRecordEvent({
                type: 'input',
                selector: getSelector(el),
                tagName: el.tagName.toLowerCase(),
                textContent: getLabel(el),
                value: el.value ? el.value.substring(0, 500) : null,
                url: window.location.href,
                metadata: { inputType: el.type || 'text' },
              });
              delete inputDebounceTimers[key];
            }, 300);
          } catch (e) {}
        }, true);

        document.addEventListener('keydown', function (e) {
          if (!window.__pwRecording) return;
          try {
            const el = e.target;
            window.__pwRecordEvent({
              type: 'keydown',
              selector: getSelector(el),
              tagName: el.tagName.toLowerCase(),
              textContent: getLabel(el),
              key: e.key,
              code: e.code,
              altKey: e.altKey,
              ctrlKey: e.ctrlKey,
              shiftKey: e.shiftKey,
              metaKey: e.metaKey,
              url: window.location.href,
            });
          } catch (e) {}
        }, true);

        document.addEventListener('scroll', function () {
          if (!window.__pwRecording) return;
          if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
          scrollDebounceTimer = setTimeout(function () {
            window.__pwRecordEvent({
              type: 'scroll',
              scrollX: Math.round(window.scrollX),
              scrollY: Math.round(window.scrollY),
              url: window.location.href,
            });
          }, 300);
        }, true);

        document.addEventListener('focusin', function (e) {
          if (!window.__pwRecording) return;
          try {
            const el = e.target;
            window.__pwRecordEvent({
              type: 'focus',
              selector: getSelector(el),
              tagName: el.tagName.toLowerCase(),
              textContent: getLabel(el),
              url: window.location.href,
            });
          } catch (e) {}
        }, true);

        document.addEventListener('focusout', function (e) {
          if (!window.__pwRecording) return;
          try {
            const el = e.target;
            window.__pwRecordEvent({
              type: 'blur',
              selector: getSelector(el),
              tagName: el.tagName.toLowerCase(),
              textContent: getLabel(el),
              url: window.location.href,
            });
          } catch (e) {}
        }, true);
      });

      // Also register for future navigations
      page.addInitScript(() => {
        if (window.__pwEventListenersInjected) return;

        function getSelector(el) {
          if (!el || el === document || el === window) return '';
          try {
            if (el.id) return '#' + CSS.escape(el.id);
            if (el.getAttribute && el.getAttribute('data-testid')) {
              return '[data-testid="' + CSS.escape(el.getAttribute('data-testid')) + '"]';
            }
            if (el.getAttribute && el.getAttribute('data-test-id')) {
              return '[data-test-id="' + CSS.escape(el.getAttribute('data-test-id')) + '"]';
            }
            if (el.name && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) {
              const form = el.closest('form');
              if (form && form.id) {
                return '#' + CSS.escape(form.id) + ' ' + el.tagName.toLowerCase() + '[name="' + CSS.escape(el.name) + '"]';
              }
              return el.tagName.toLowerCase() + '[name="' + CSS.escape(el.name) + '"]';
            }
            let path = [];
            let current = el;
            while (current && current !== document && current !== document.body) {
              let segment = current.tagName.toLowerCase();
              if (current.id) {
                segment = '#' + CSS.escape(current.id);
                path.unshift(segment);
                break;
              }
              const parent = current.parentElement;
              if (parent) {
                const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
                if (siblings.length > 1) {
                  segment += ':nth-child(' + (Array.from(parent.children).indexOf(current) + 1) + ')';
                }
              }
              if (current.classList && current.classList.length > 0) {
                const classes = Array.from(current.classList).slice(0, 2).map(c => '.' + CSS.escape(c)).join('');
                segment += classes;
              }
              path.unshift(segment);
              current = current.parentElement;
            }
            return path.join(' > ');
          } catch (e) {
            return el.tagName ? el.tagName.toLowerCase() : '';
          }
        }

        function getLabel(el) {
          try {
            let text = '';
            if (el.textContent) text = el.textContent.trim().substring(0, 100);
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
              const label = el.closest('label');
              if (label) text = label.textContent.trim().substring(0, 100);
              if (!text && el.placeholder) text = el.placeholder;
              if (!text && el.id) {
                const labelById = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
                if (labelById) text = labelById.textContent.trim().substring(0, 100);
              }
            }
            if (el.tagName === 'SELECT') {
              const label = el.closest('label');
              if (label) text = label.textContent.trim().substring(0, 100);
              if (!text && el.id) {
                const labelById = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
                if (labelById) text = labelById.textContent.trim().substring(0, 100);
              }
              if (!text) text = 'Select';
            }
            if (el.tagName === 'BUTTON' || el.tagName === 'A') {
              if (!text) text = el.textContent.trim().substring(0, 100);
            }
            return text;
          } catch (e) {
            return '';
          }
        }

        window.__pwEventListenersInjected = true;
        let inputDebounceTimers = {};
        let scrollDebounceTimer = null;
        window.__pwRecording = true;

        document.addEventListener('click', function (e) {
          if (!window.__pwRecording) return;
          try {
            const el = e.target; const rect = el.getBoundingClientRect();
            window.__pwRecordEvent({ type: 'click', selector: getSelector(el), tagName: el.tagName.toLowerCase(), textContent: getLabel(el), value: el.value || null, url: window.location.href, x: Math.round(e.pageX), y: Math.round(e.pageY), targetRect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }, altKey: e.altKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, metaKey: e.metaKey });
          } catch (e) {}
        }, true);

        document.addEventListener('dblclick', function (e) {
          if (!window.__pwRecording) return;
          try {
            const el = e.target; const rect = el.getBoundingClientRect();
            window.__pwRecordEvent({ type: 'dblclick', selector: getSelector(el), tagName: el.tagName.toLowerCase(), textContent: getLabel(el), url: window.location.href, x: Math.round(e.pageX), y: Math.round(e.pageY), targetRect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) } });
          } catch (e) {}
        }, true);

        document.addEventListener('change', function (e) {
          if (!window.__pwRecording) return;
          try {
            const el = e.target;
            if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
              let val = el.value; if (el.type === 'checkbox' || el.type === 'radio') val = el.checked;
              window.__pwRecordEvent({ type: 'change', selector: getSelector(el), tagName: el.tagName.toLowerCase(), textContent: getLabel(el), value: String(val), url: window.location.href });
            }
          } catch (e) {}
        }, true);

        document.addEventListener('submit', function (e) {
          if (!window.__pwRecording) return;
          try {
            const el = e.target;
            window.__pwRecordEvent({ type: 'submit', selector: el.id ? '#' + CSS.escape(el.id) : el.tagName.toLowerCase(), tagName: 'form', textContent: el.id || el.name || '', url: window.location.href });
          } catch (e) {}
        }, true);

        document.addEventListener('input', function (e) {
          if (!window.__pwRecording) return;
          try {
            const el = e.target;
            if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
            if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file') return;
            const key = getSelector(el) || el.name || el.id || Math.random();
            if (inputDebounceTimers[key]) clearTimeout(inputDebounceTimers[key]);
            inputDebounceTimers[key] = setTimeout(function () {
              window.__pwRecordEvent({ type: 'input', selector: getSelector(el), tagName: el.tagName.toLowerCase(), textContent: getLabel(el), value: el.value ? el.value.substring(0, 500) : null, url: window.location.href, metadata: { inputType: el.type || 'text' } });
              delete inputDebounceTimers[key];
            }, 300);
          } catch (e) {}
        }, true);

        document.addEventListener('keydown', function (e) {
          if (!window.__pwRecording) return;
          try {
            const el = e.target;
            window.__pwRecordEvent({ type: 'keydown', selector: getSelector(el), tagName: el.tagName.toLowerCase(), textContent: getLabel(el), key: e.key, code: e.code, altKey: e.altKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, metaKey: e.metaKey, url: window.location.href });
          } catch (e) {}
        }, true);

        document.addEventListener('scroll', function () {
          if (!window.__pwRecording) return;
          if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
          scrollDebounceTimer = setTimeout(function () {
            window.__pwRecordEvent({ type: 'scroll', scrollX: Math.round(window.scrollX), scrollY: Math.round(window.scrollY), url: window.location.href });
          }, 300);
        }, true);

        document.addEventListener('focusin', function (e) {
          if (!window.__pwRecording) return;
          try {
            const el = e.target;
            window.__pwRecordEvent({ type: 'focus', selector: getSelector(el), tagName: el.tagName.toLowerCase(), textContent: getLabel(el), url: window.location.href });
          } catch (e) {}
        }, true);

        document.addEventListener('focusout', function (e) {
          if (!window.__pwRecording) return;
          try {
            const el = e.target;
            window.__pwRecordEvent({ type: 'blur', selector: getSelector(el), tagName: el.tagName.toLowerCase(), textContent: getLabel(el), url: window.location.href });
          } catch (e) {}
        }, true);
      });
    } catch (err) {
      console.log(`[browserManager] Error al inyectar event listeners:`, err.message);
    }
  }

  injectListeners();
}

function stopEventRecording(page) {
  if (page && !page.isClosed()) {
    page.evaluate(() => { window.__pwRecording = false; }).catch(() => {});
  }
}

function notifyBackend(data) {
  if (!data.chat_session_id) return;
  const backendPort = process.env.PORT || 4000;
  const backendUrl = `http://localhost:${backendPort}`;
  fetch(`${backendUrl}/api/playwright-logs/console/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {});
}

function notifyNetworkError(data) {
  if (!data.chat_session_id) return;
  const backendPort = process.env.PORT || 4000;
  const backendUrl = `http://localhost:${backendPort}`;
  fetch(`${backendUrl}/api/playwright-logs/network/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {});
}

function notifyNetworkRequest(data) {
  if (!data.chat_session_id) return;
  const backendPort = process.env.PORT || 4000;
  const backendUrl = `http://localhost:${backendPort}`;
  fetch(`${backendUrl}/api/playwright-logs/network/store`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {});
}

function setupPageListeners(page, sessionId, chatSessionId, instanceName) {
  page.on('response', async (response) => {
    const req = response.request();
    const resourceType = req.resourceType();
    if (!ALLOWED_RESOURCE_TYPES.includes(resourceType)) return;

    let body = null;
    let responseSize = null;
    try {
      const buf = await response.body();
      body = buf.toString('utf-8').substring(0, MAX_BODY_LENGTH);
      responseSize = buf.length;
    } catch {
      body = null;
      responseSize = null;
    }

    let requestBody = null;
    let requestSize = null;
    try {
      const postData = req.postData();
      if (postData) {
        requestSize = Buffer.byteLength(postData, 'utf-8');
        requestBody = postData.substring(0, MAX_REQUEST_BODY_LENGTH);
      }
    } catch {
      requestBody = null;
      requestSize = null;
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
        request_body: requestBody,
        request_size: requestSize,
        response_size: responseSize,
      });
    } catch (err) {
      console.log(`[browserManager] Error al guardar network log:`, err.message);
    }

    const statusCode = response.status();

    if (instanceName) {
      notifyNetworkRequest({
        chat_session_id: chatSessionId,
        method: req.method(),
        url: req.url().substring(0, 2000),
        status_code: statusCode,
        resource_type: resourceType,
        instance_name: instanceName,
      });
    }

    if (statusCode >= 400) {
      const errorText = statusCode >= 500 ? `Error del servidor (${statusCode})` : `Error del cliente (${statusCode})`;
      notifyNetworkError({
        chat_session_id: chatSessionId,
        method: req.method(),
        url: req.url().substring(0, 2000),
        status_code: statusCode,
        error: errorText,
        resource_type: resourceType,
        instance_name: instanceName,
      });
    }
  });

  page.on('requestfailed', async (request) => {
    const resourceType = request.resourceType();
    if (!ALLOWED_RESOURCE_TYPES.includes(resourceType)) return;

    let requestBody = null;
    let requestSize = null;
    try {
      const postData = request.postData();
      if (postData) {
        requestSize = Buffer.byteLength(postData, 'utf-8');
        requestBody = postData.substring(0, MAX_REQUEST_BODY_LENGTH);
      }
    } catch {
      requestBody = null;
      requestSize = null;
    }

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
        request_body: requestBody,
        request_size: requestSize,
      });
    } catch (err) {
      console.log(`[browserManager] Error al guardar request failed:`, err.message);
    }

    const errorText = request.failure()?.errorText || 'Unknown error';

    if (instanceName) {
      notifyNetworkRequest({
        chat_session_id: chatSessionId,
        method: request.method(),
        url: request.url().substring(0, 2000),
        status_code: null,
        error: errorText,
        resource_type: resourceType,
        instance_name: instanceName,
      });
    }

    notifyNetworkError({
      chat_session_id: chatSessionId,
      method: request.method(),
      url: request.url().substring(0, 2000),
      status_code: null,
      error: errorText,
      resource_type: resourceType,
      instance_name: instanceName,
    });
  });

  page.on('console', async (msg) => {
    try {
      if (!db) return;
      const type = msg.type();
      const location = msg.location();
      const locationStr = location ? `${location.url}:${location.lineNumber}:${location.columnNumber}` : null;

      await db('playwright_console_logs').insert({
        chat_session_id: chatSessionId,
        playwright_session_id: sessionId,
        type,
        text: msg.text(),
        location: locationStr,
      });

      notifyBackend({
        chat_session_id: chatSessionId,
        type,
        text: msg.text(),
        location: locationStr,
        instance_name: instanceName,
      });
    } catch (err) {
      console.log(`[browserManager] Error al guardar console log:`, err.message);
    }
  });

  page.on('pageerror', async (error) => {
    try {
      if (!db) return;
      const stack = (error.stack || error.message || String(error)).substring(0, 5000);

      await db('playwright_console_logs').insert({
        chat_session_id: chatSessionId,
        playwright_session_id: sessionId,
        type: 'error',
        text: stack,
        location: null,
      });

      notifyBackend({
        chat_session_id: chatSessionId,
        type: 'error',
        text: stack,
        location: null,
        instance_name: instanceName,
      });
    } catch (err) {
      console.log(`[browserManager] Error al guardar pageerror:`, err.message);
    }
  });
}

async function startSession(navegador, headless, resolution, chatSessionId, instanceName) {
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

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  const id = generateId();
  const safeChatSessionId = chatSessionId || null;
  const safeInstanceName = instanceName || null;
  sessions.set(id, { browser, context, page, navegador, headless: headlessMode, resolution: resolution || null, chatSessionId: safeChatSessionId, instanceName: safeInstanceName });

  setupPageListeners(page, id, safeChatSessionId, safeInstanceName);

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

async function executeAction(idSession, action) {
  if (!idSession) {
    throw new Error('Parámetro "id_session" es requerido');
  }
  if (!action || !action.type) {
    throw new Error('Acción inválida: se requiere type');
  }

  const session = sessions.get(idSession);
  if (!session) {
    throw new Error(`Sesión no encontrada: "${idSession}"`);
  }

  const { page } = session;
  const { type, selector, value, key, x, y } = action;

  try {
    // Pausar grabación durante playback para evitar contaminar eventos grabados
    let wasRecording = false;
    try {
      wasRecording = await page.evaluate(() => {
        const val = window.__pwRecording;
        window.__pwRecording = false;
        return val;
      });
    } catch (e) {
      // Página no lista, se ignora
    }

    try {
      switch (type) {
        case 'click': {
          if (!selector) throw new Error('Acción click requiere selector');
          await page.click(selector);
          console.log(`Sesión ${idSession} click en "${selector}"`);
          break;
        }
        case 'fill': {
          if (!selector) throw new Error('Acción fill requiere selector');
          await page.fill(selector, value || '');
          console.log(`Sesión ${idSession} fill en "${selector}" → "${value}"`);
          break;
        }
        case 'select': {
          if (!selector) throw new Error('Acción select requiere selector');
          await page.selectOption(selector, value || '');
          console.log(`Sesión ${idSession} select en "${selector}" → "${value}"`);
          break;
        }
        case 'submit': {
          if (!selector) throw new Error('Acción submit requiere selector');
          await page.evaluate((sel) => {
            const form = document.querySelector(sel);
            if (form) form.submit();
          }, selector);
          console.log(`Sesión ${idSession} submit formulario "${selector}"`);
          break;
        }
        case 'press': {
          if (!selector) throw new Error('Acción press requiere selector');
          await page.press(selector, key || 'Enter');
          console.log(`Sesión ${idSession} press "${key}" en "${selector}"`);
          break;
        }
        case 'scroll': {
          await page.evaluate(({ sx, sy }) => {
            window.scrollTo(sx || 0, sy || 0);
          }, { sx: x, sy: y });
          console.log(`Sesión ${idSession} scroll a x=${x}, y=${y}`);
          break;
        }
        default:
          throw new Error(`Tipo de acción no soportado: "${type}"`);
      }
    } finally {
      // Restaurar estado de grabación (si la página sigue viva)
      try {
        await page.evaluate((val) => { window.__pwRecording = val; }, wasRecording);
      } catch (e) {
        // Página cerrada o navegó, se ignora
      }
    }

    return { success: true, type, selector: selector || null };
  } catch (err) {
    console.log(`Error ejecutando ${type} en sesión ${idSession}:`, err.message);
    throw new Error(`Error al ejecutar ${type}: ${err.message}`);
  }
}

async function takeScreenshot(idSession, fullpage = false) {
  if (!idSession) {
    throw new Error('Parámetro "id_session" es requerido');
  }

  const session = sessions.get(idSession);
  if (!session) {
    throw new Error(`Sesión no encontrada: "${idSession}"`);
  }

  try {
    const buffer = await session.page.screenshot({ fullPage: fullpage, type: 'png' });
    console.log(`Sesión ${idSession} captura de pantalla tomada (fullpage: ${fullpage})`);
    return buffer;
  } catch (err) {
    console.log(`Error al tomar captura en sesión ${idSession}:`, err.message);
    throw new Error(`Error al tomar captura de pantalla: ${err.message}`);
  }
}

async function getPageHtml(idSession) {
  if (!idSession) {
    throw new Error('Parámetro "id_session" es requerido');
  }

  const session = sessions.get(idSession);
  if (!session) {
    throw new Error(`Sesión no encontrada: "${idSession}"`);
  }

  try {
    const html = await session.page.evaluate(() => document.documentElement.outerHTML);
    console.log(`Sesión ${idSession} HTML de página obtenido (${html.length} chars)`);
    return html;
  } catch (err) {
    console.log(`Error al obtener HTML en sesión ${idSession}:`, err.message);
    throw new Error(`Error al obtener HTML de la página: ${err.message}`);
  }
}

export default {
  setDb,
  startSession,
  goToUrl,
  extractFormControls,
  setupEventRecording,
  stopEventRecording,
  executeAction,
  takeScreenshot,
  getPageHtml,
  getSession,
  getActiveSession,
  closeSession,
  closeAllSessions,
  setDefaultHeadless,
  getDefaultHeadless,
};
