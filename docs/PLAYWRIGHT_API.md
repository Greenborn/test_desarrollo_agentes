# Playwright Service API

Microservicio wrapper de Playwright que permite controlar navegadores (Chrome, Firefox) mediante una API REST. Diseñado para ser usado tanto por humanos como por agentes IA.

---

## 1. Stack

| Capa | Tecnología |
|---|---|
| Runtime | Node.js 21+ (ESM) |
| Framework | Express 4.21+ |
| Automatización | Playwright 1.52+ |
| Entorno | dotenv 16+ |
| Puertos | `backend/.env` → `SERVICIO_PLAYWRIGHT_PORT` |

---

## 2. Configuración

### 2.1 Variables de entorno (en `backend/.env`)

```
SERVICIO_PLAYWRIGHT_PORT=4098
```

### 2.2 Instalación

```bash
cd playwright
npm run setup
# Ejecuta: npm install && npx playwright install chromium firefox
```

### 2.3 Inicio

```bash
npm run dev    # Desarrollo con --watch
npm start      # Producción
```

---

## 3. Endpoints

### 3.1 `POST /api/command`

Endpoint único y genérico que recibe un comando y sus parámetros.

#### Request

```
POST http://localhost:{SERVICIO_PLAYWRIGHT_PORT}/api/command
Content-Type: application/json
```

```json
{
  "comando": "<nombre del comando>",
  "parametros": { <objeto con parámetros> }
}
```

#### Response (éxito)

```json
{
  "success": true
}
```

O para comandos que devuelven datos:

```json
{
  "id_session": "uuid"
}
```

#### Response (error)

```json
{
  "error": "mensaje descriptivo"
}
```

Códigos HTTP:
- `200` — éxito
- `400` — error del cliente (parámetros faltantes, comando desconocido)
- `500` — error interno (fallo al lanzar navegador, navegación fallida)

---

## 4. Comandos

### 4.1 `start`

Inicia una nueva sesión de navegador. Lanza el navegador especificado, crea un contexto y una página, y devuelve un UUID que identifica la sesión.

#### Parámetros

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|---|
| `navegador` | `string` | Sí | Identificador del navegador: `"chrome"` o `"firefox"` |
| `chat_session_id` | `integer` | No | ID de la sesión de chat asociada. Se usa para relacionar los logs de red y console.log almacenados en BD con la sesión de chat que inició el navegador |

#### Ejemplo

```bash
curl -X POST http://localhost:4098/api/command \
  -H 'Content-Type: application/json' \
  -d '{"comando":"start","parametros":{"navegador":"chrome"}}'
```

#### Respuesta

```json
{
  "id_session": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Errores posibles

| Causa | HTTP | Mensaje |
|---|---|---|
| Falta `navegador` | 400 | `Parámetro "navegador" es requerido` |
| Navegador no soportado | 500 | `Navegador no soportado: "edge". Soporta: chrome, firefox` |
| No se pudo iniciar | 500 | `No se pudo iniciar chrome: ...` |

#### Logs automáticos

Cuando se provee `chat_session_id`, el servicio registra automáticamente en BD:

| Tabla | Contenido |
|---|---|
| `playwright_network_logs` | Peticiones de red (`document`, `xhr`, `fetch`) con method, URL, status code, headers, body truncado, tamaño de datos y cuerpo de petición |
| `playwright_console_logs` | Mensajes de consola del navegador con tipo (`log`, `warn`, `error`, etc.), texto y ubicación |
| `playwright_events` | Eventos de usuario del navegador capturados con `start_event_recording` (clicks, inputs, keydown, scroll, etc.) |

Además del almacenamiento en BD, los errores de red (peticiones fallidas + respuestas 4xx/5xx) se notifican en tiempo real al backend vía `POST /api/playwright-logs/network/notify` y se reenvían a los clientes SSE conectados a `GET /api/playwright-logs/network/stream` (ver [`ENDPOINTS.md`](ENDPOINTS.md)). De igual forma, los console errors/warnings se notifican a `POST /api/playwright-logs/console/notify` y se reenvían por `GET /api/playwright-logs/console/stream`.

---

### 4.2 `go_to_url`

Navega a una URL dentro de una sesión activa.

#### Parámetros

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id_session` | `string` | Sí | UUID de la sesión obtenido de `start` |
| `url` | `string` | Sí | URL completa a navegar (incluye protocolo) |

#### Ejemplo

```bash
curl -X POST http://localhost:4098/api/command \
  -H 'Content-Type: application/json' \
  -d '{"comando":"go_to_url","parametros":{"id_session":"550e8400-e29b-41d4-a716-446655440000","url":"https://example.com"}}'
```

#### Respuesta

```json
{
  "success": true
}
```

#### Errores posibles

| Causa | HTTP | Mensaje |
|---|---|---|
| Falta `id_session` o `url` | 400 | `Parámetros "id_session" y "url" son requeridos` |
| Sesión no existe | 500 | `Sesión no encontrada: "uuid..."` |
| Error de navegación | 500 | `Error al navegar a https://...: ...` |

### 4.3 `extract_form_controls`

Extrae todos los controles de formulario (`input`, `select`, `textarea`, `button`) de la página actual de una sesión activa, junto con metadatos de los formularios.

#### Parámetros

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id_session` | `string` | No (usa sesión activa si se omite) | UUID de la sesión obtenido de `start` |

#### Ejemplo

```bash
curl -X POST http://localhost:4098/api/command \
  -H 'Content-Type: application/json' \
  -d '{"comando":"extract_form_controls","parametros":{"id_session":"550e8400-e29b-41d4-a716-446655440000"}}'
```

#### Respuesta

```json
{
  "success": true,
  "id_session": "550e8400-...",
  "url": "https://ejemplo.com/login",
  "title": "Iniciar Sesión",
  "scrollX": 0,
  "scrollY": 0,
  "viewportWidth": 1920,
  "viewportHeight": 1080,
  "pageWidth": 1920,
  "pageHeight": 3000,
  "forms": [
    { "id": "login-form", "name": null, "action": "https://ejemplo.com/login", "method": "post", "autocomplete": "on", "novalidate": false }
  ],
  "controls": [
    {
      "tag": "input",
      "type": "email",
      "name": "email",
      "id": "email-input",
      "placeholder": "correo@ejemplo.com",
      "value": "",
      "disabled": false,
      "required": true,
      "visible": true,
      "label": "Correo electrónico",
      "maxLength": 255,
      "autocomplete": "email",
      "rect": { "x": 200, "y": 150, "width": 300, "height": 38 },
      "documentRect": { "x": 200, "y": 150, "width": 300, "height": 38 },
      "form": "login-form"
    }
  ]
}
```

> **Nota:** `rect` contiene coordenadas relativas al viewport (`getBoundingClientRect`). `documentRect` contiene coordenadas relativas al documento completo (`rect + scrollX/Y`), útiles para localizar elementos en capturas fullpage. Los campos `scrollX`, `scrollY`, `viewportWidth`, `viewportHeight`, `pageWidth` y `pageHeight` describen el estado del viewport y el tamaño total de la página al momento de la extracción.

#### Errores posibles

| Causa | HTTP | Mensaje |
|---|---|---|
| No hay sesión activa | 400 | `No hay sesión activa. Usá "start" primero o pasá "id_session"` |
| Sesión no existe | 500 | `Sesión no encontrada: "uuid..."` |

---

### 4.4 `start_event_recording`

Inicia la grabación de eventos de usuario en la página activa. Inyecta listeners JavaScript que capturan: `click`, `dblclick`, `input`, `change`, `submit`, `keydown`, `scroll`, `focus`, `blur`. Los eventos se almacenan en la tabla `playwright_events`.

#### Parámetros

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id_session` | `string` | No (usa sesión activa si se omite) | UUID de la sesión |
| `chat_session_id` | `integer` | No | ID de sesión de chat para asociar eventos |
| `recording_id` | `integer` | No | ID de grabación para agrupar eventos |

#### Ejemplo

```json
{ "comando": "start_event_recording", "parametros": { "id_session": "uuid", "chat_session_id": 123, "recording_id": 1 } }
```

---

### 4.5 `stop_event_recording`

Pausa la grabación de eventos (desactiva el flag `window.__pwRecording = false`). No destruye los listeners, por lo que se puede reanudar con `start_event_recording`.

#### Parámetros

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id_session` | `string` | No (usa sesión activa si se omite) | UUID de la sesión |

#### Ejemplo

```json
{ "comando": "stop_event_recording", "parametros": { "id_session": "uuid" } }
```

---

### 4.6 `execute_action` — Simulación de eventos en inputs

Ejecuta una acción simulada sobre un elemento de la página. Diseñado para pruebas automatizadas y replay de grabaciones.

#### Parámetros

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id_session` | `string` | No (usa sesión activa si se omite) | UUID de la sesión |
| `action` | `object` | Sí | Objeto con la acción a ejecutar |

#### Tipos de acción

| Tipo | Parámetros adicionales | Descripción |
|---|---|---|
| `click` | `selector` | Click en el elemento |
| `fill` | `selector`, `value` | Rellena un input con valor (Playwright nativo) |
| `type` | `selector`, `value`, `delay` (opcional, default 50ms) | Escribe caracter por caracter simulando tipeo |
| `select` | `selector`, `value` | Selecciona opción en un `<select>` |
| `submit` | `selector` | Envía un formulario |
| `press` | `selector`, `key` | Presiona una tecla (default `Enter`) |
| `focus` | `selector` | Fija el foco en un elemento |
| `blur` | `selector` | Quita el foco de un elemento |
| `check` | `selector` | Marca un checkbox |
| `uncheck` | `selector` | Desmarca un checkbox |
| `hover` | `selector` | Posiciona el cursor sobre un elemento |
| `scroll` | `x`, `y` | Desplaza la ventana a las coordenadas |
| `dispatch_event` | `selector`, `eventType`, `eventInit` | Dispara un evento DOM arbitrario |

#### Ejemplos

```json
{ "comando": "execute_action", "parametros": { "action": { "type": "focus", "selector": "#email" } } }
{ "comando": "execute_action", "parametros": { "action": { "type": "type", "selector": "#username", "value": "admin", "delay": 30 } } }
{ "comando": "execute_action", "parametros": { "action": { "type": "blur", "selector": "#username" } } }
{ "comando": "execute_action", "parametros": { "action": { "type": "check", "selector": "#terms" } } }
{ "comando": "execute_action", "parametros": { "action": { "type": "dispatch_event", "selector": "#miBoton", "eventType": "mouseenter", "eventInit": {} } } }
```

> **Nota:** Durante la ejecución de `execute_action`, la grabación de eventos se pausa automáticamente para evitar contaminar los eventos grabados. Al finalizar, se restaura el estado anterior de grabación.

---

### 4.7 `evaluate_selector` — Consulta de valores en la vista

Evalúa un selector CSS en la página activa y extrae un valor específico (valor de input, texto, HTML, atributo, etc.). El resultado se retorna en la respuesta, y desde la interfaz se puede persistir en la sesión de chat y en eventos de grabación.

#### Parámetros

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id_session` | `string` | No (usa sesión activa si se omite) | UUID de la sesión |
| `selector` | `string` | Sí | Selector CSS del elemento a consultar |
| `extract_type` | `string` | No (default `text`) | Tipo de extracción: `value`, `text`, `html`, `attribute`, `checked`, `exists`, `count` |
| `attribute_name` | `string` | No | Nombre del atributo (requerido si `extract_type=attribute`) |

#### Tipos de extracción

| Tipo | Retorna | Descripción |
|---|---|---|
| `value` | `string` | Valor de un input (`element.value`) |
| `text` | `string` | Texto visible del elemento (`textContent.trim()`) |
| `html` | `string` | HTML interno del elemento (`innerHTML`) |
| `attribute` | `string` | Valor de un atributo (`getAttribute(name)`) |
| `checked` | `boolean` | Estado checked de un checkbox/radio |
| `exists` | `boolean` | `true` si el elemento existe en el DOM |
| `count` | `number` | Cantidad de elementos que coinciden con el selector |

#### Ejemplo

```bash
curl -X POST http://localhost:4098/api/command \
  -H 'Content-Type: application/json' \
  -d '{"comando":"evaluate_selector","parametros":{"selector":"#username","extract_type":"value"}}'
```

#### Respuesta

```json
{
  "success": true,
  "id_session": "550e8400-...",
  "selector": "#username",
  "extract_type": "value",
  "found": true,
  "value": "admin"
}
```

Si el elemento no se encuentra:

```json
{
  "success": true,
  "id_session": "550e8400-...",
  "selector": "#no-existe",
  "extract_type": "text",
  "found": false,
  "value": null
}
```

#### Uso en grabaciones

Cuando se usa desde la interfaz de grabaciones (panel inferior), el resultado se puede:
- Mostrar en el panel de eventos
- Guardar como evento de tipo `query` en la grabación (`event_type: 'query'`)
- Enviar a la sesión de chat como mensaje de resultado

Durante el replay de una grabación, los eventos `query` se ejecutan automáticamente y el resultado se actualiza en el evento y se muestra en el chat.

---

### 4.8 `simulate_event` — Simulación de eventos DOM

Simula un evento DOM genérico en un elemento de la página. Útil para pruebas de comportamiento que requieren eventos específicos (mouseenter, mouseleave, transitionend, etc.).

#### Parámetros

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id_session` | `string` | No (usa sesión activa si se omite) | UUID de la sesión |
| `selector` | `string` | Sí | Selector CSS del elemento objetivo |
| `event_type` | `string` | No (default `click`) | Tipo de evento DOM (`click`, `mouseenter`, `focus`, `blur`, `change`, etc.) |
| `event_init` | `object` | No (default `{}`) | Objeto con propiedades del evento (`bubbles`, `cancelable`, `detail`, etc.) |

#### Ejemplo

```bash
curl -X POST http://localhost:4098/api/command \
  -H 'Content-Type: application/json' \
  -d '{"comando":"simulate_event","parametros":{"selector":"#boton","event_type":"mouseenter","event_init":{"bubbles":true}}}'
```

---

### 4.9 `take_screenshot`

Toma una captura de pantalla de la página actual en una sesión de navegador activa.

#### Parámetros

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id_session` | `string` | No (usa sesión activa si se omite) | UUID de la sesión obtenido de `start` |
| `fullpage` | `boolean` | No (default `false`) | Si es `true`, captura la página completa (incluye scroll) |

#### Ejemplo

```bash
curl -X POST http://localhost:4098/api/command \
  -H 'Content-Type: application/json' \
  -d '{"comando":"take_screenshot","parametros":{"fullpage":true}}'
```

#### Respuesta

```json
{
  "success": true,
  "id_session": "550e8400-e29b-41d4-a716-446655440000",
  "fullpage": true,
  "image_base64": "iVBORw0KGgo... (base64 del PNG)",
  "size": 245760
}
```

#### Errores posibles

| Causa | HTTP | Mensaje |
|---|---|---|
| No hay sesión activa | 400 | `No hay sesión activa. Usá "start" primero o pasá "id_session"` |
| Sesión no existe | 500 | `Sesión no encontrada: "uuid..."` |
| Error de captura | 500 | `Error al tomar captura de pantalla: ...` |

---

### 4.10 `get_page_html`

Obtiene el HTML completo de la página actual (`document.documentElement.outerHTML`).

#### Parámetros

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id_session` | `string` | No (usa sesión activa si se omite) | UUID de la sesión |

#### Ejemplo

```json
{ "comando": "get_page_html", "parametros": {} }
```

#### Respuesta

```json
{
  "success": true,
  "id_session": "uuid",
  "html": "<!DOCTYPE html><html>..."
}
```

---

### 4.11 `set_headless`

Cambia el modo headless global y reinicia la sesión activa si existe.

#### Parámetros

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `headless` | `boolean\|string` | Sí | `true`, `false`, `"0"` o `"1"` |

#### Ejemplo

```json
{ "comando": "set_headless", "parametros": { "headless": true } }
```

---

## 5. Flujo típico

```
1. POST /api/command  { "comando": "start",                        "parametros": { "navegador": "chrome" } }
   → { "id_session": "abc-123" }

2. POST /api/command  { "comando": "go_to_url",                    "parametros": { "id_session": "abc-123", "url": "https://ejemplo.com" } }
   → { "success": true }

3. POST /api/command  { "comando": "extract_form_controls",        "parametros": { "id_session": "abc-123" } }
   → { "success": true, "forms": [...], "controls": [...], ... }
```

---

## 6. Gestión de sesiones

- Las sesiones se almacenan en memoria (Map) dentro del proceso.
- Cada sesión contiene: instancia del navegador, contexto, página de Playwright y `chat_session_id` (si se proveyó).
- Los logs de red y consola se escriben directamente a la base de datos MariaDB en tiempo real mediante Knex.
- Solo se registran peticiones de tipo `document`, `xhr` y `fetch` (se omiten imágenes, CSS, fuentes, etc.).
- Los cuerpos de respuesta se truncan a 10.000 caracteres.
- Al reiniciar el servicio, todas las sesiones se pierden.
- No hay límite de sesiones simultáneas (sujeto a recursos del sistema).

### Funciones internas (exportadas por `browserManager.js`)

| Función | Descripción |
|---|---|
| `setDb(knexInstance)` | Inyecta instancia Knex para escritura de logs en BD |
| `startSession(navegador, headless, resolution, chatSessionId)` | Lanza navegador, crea sesión, retorna UUID |
| `goToUrl(idSession, url)` | Navega a URL en la sesión |
| `extractFormControls(idSession)` | Extrae todos los controles de formulario de la página (`input`, `select`, `textarea`, `button`) con sus características y metadatos del formulario |
| `getSession(idSession)` | Retorna datos de la sesión o `null` |
| `closeSession(idSession)` | Cierra navegador y elimina sesión |
| `takeScreenshot(idSession, fullpage)` | Toma captura de pantalla de la página actual, retorna Buffer PNG |

---

## 7. Navegadores soportados

| ID | Tipo Playwright | Comportamiento |
|---|---|---|
| `"chrome"` | `chromium` | Lanza Chromium en modo headless |
| `"firefox"` | `firefox` | Lanza Firefox en modo headless |

Ambos navegadores se lanzan en modo headless (sin interfaz gráfica). Para cambiar este comportamiento, modificar `browserType.launch()` en `browserManager.js`.

---

## 8. Estructura del proyecto

```
playwright/
├── package.json
├── src/
│   ├── index.js                   # Entrypoint Express
│   ├── routes/
│   │   └── command.routes.js      # POST /api/command
│   └── services/
│       └── browserManager.js      # Lógica de Playwright
```

---

## 9. Convenciones del código

- **JavaScript puro** (ESM, no TypeScript)
- Parámetros requeridos validados explícitamente — prohibido `||` como fallback silencioso
- Errores registrados con `console.log` — prohibido `catch {}` vacío
- Dependencias externas: express, dotenv, playwright, knex y mysql2

---

## 10. Referencia rápida para agentes IA

```
COMANDOS DISPONIBLES:
- start                    → inicia navegador chrome/firefox, devuelve id_session
- take_screenshot          → captura pantalla de la página actual, devuelve base64
- go_to_url                → navega a una URL en una sesión existente
- set_headless             → cambia modo headless (0=visible, 1=headless)
- close                    → cierra una sesión de navegador
- extract_form_controls    → extrae todos los controles de formulario de la página actual
- get_page_html            → obtiene el HTML completo de la página actual
- start_event_recording    → inicia grabación de eventos de usuario (click, input, keydown, scroll, etc.)
- stop_event_recording     → pausa la grabación de eventos (se puede reanudar)
- execute_action           → ejecuta una acción simulada (click, fill, type, focus, blur, check, uncheck, hover, dispatch_event, etc.)
- evaluate_selector        → consulta el valor de un elemento por selector CSS (value, text, html, attribute, checked, exists, count)
- simulate_event           → simula un evento DOM arbitrario en un elemento

USO:
  { "comando": "start",                    "parametros": { "navegador": "chrome"|"firefox", "headless": true|false, "chat_session_id": 123 } }
  { "comando": "go_to_url",                "parametros": { "id_session": "uuid", "url": "https://..." } }
  { "comando": "set_headless",             "parametros": { "headless": "0"|"1" } }
  { "comando": "close",                    "parametros": { "id_session": "uuid" } }
  { "comando": "extract_form_controls",    "parametros": { "id_session": "uuid" } }
  { "comando": "start_event_recording",    "parametros": { "id_session": "uuid", "chat_session_id": 123 } }
  { "comando": "stop_event_recording",     "parametros": { "id_session": "uuid" } }
  { "comando": "take_screenshot",          "parametros": { "id_session": "uuid", "fullpage": true } }
  { "comando": "get_page_html",            "parametros": { "id_session": "uuid" } }
  { "comando": "execute_action",           "parametros": { "id_session": "uuid", "action": { "type": "focus", "selector": "#id" } } }
  { "comando": "evaluate_selector",        "parametros": { "id_session": "uuid", "selector": "#id", "extract_type": "value" } }
  { "comando": "simulate_event",           "parametros": { "id_session": "uuid", "selector": "#id", "event_type": "mouseenter" } }

TIPOS DE ACCIÓN (execute_action):
  click, fill, type, select, submit, press, focus, blur, check, uncheck, hover, scroll, dispatch_event

TIPOS DE EXTRACCIÓN (evaluate_selector):
  value, text, html, attribute, checked, exists, count

LOGS DE RED Y CONSOLA:
  Al iniciar una sesión con `start`, el servicio captura automáticamente:
  - Peticiones de red (solo tipo `document`, `xhr`, `fetch`) → tabla `playwright_network_logs`
  - Mensajes de consola del navegador (`console.log`, `warn`, `error`, etc.) → tabla `playwright_console_logs`
  Ambos se almacenan en la base de datos asociados al `chat_session_id` provisto.

GRABACIÓN DE EVENTOS:
  Al ejecutar `start_event_recording`, el servicio inyecta un script via `page.addInitScript()` que
  registra listeners en el documento para capturar eventos del usuario:
  - click, dblclick, input (debounced 300ms), change, submit, keydown, scroll (debounced 300ms), focus, blur
  - Cada evento genera un registro en la tabla `playwright_events` asociado al `chat_session_id`
  - `stop_event_recording` solo desactiva el flag `window.__pwRecording = false` (no destruye listeners)
  - Se puede reanudar con `start_event_recording` sin necesidad de reinyectar el script
  - Los eventos de tipo `query` (consulta de selectores) se guardan y ejecutan durante el replay

ERRORES:
  - 400: parámetros faltantes o comando desconocido
  - 500: error interno (navegador no disponible, navegación fallida)
  - 502: error de conexión con el servicio Playwright
```
