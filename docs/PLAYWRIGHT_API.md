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
      "form": "login-form"
    }
  ]
}
```

#### Errores posibles

| Causa | HTTP | Mensaje |
|---|---|---|
| No hay sesión activa | 400 | `No hay sesión activa. Usá "start" primero o pasá "id_session"` |
| Sesión no existe | 500 | `Sesión no encontrada: "uuid..."` |

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
- go_to_url                → navega a una URL en una sesión existente
- set_headless             → cambia modo headless (0=visible, 1=headless)
- close                    → cierra una sesión de navegador
- extract_form_controls    → extrae todos los controles de formulario de la página actual
- start_event_recording    → inicia grabación de eventos de usuario (click, input, keydown, scroll, etc.)
- stop_event_recording     → pausa la grabación de eventos (se puede reanudar)

USO:
  { "comando": "start",                    "parametros": { "navegador": "chrome"|"firefox", "headless": true|false, "chat_session_id": 123 } }
  { "comando": "go_to_url",                "parametros": { "id_session": "uuid", "url": "https://..." } }
  { "comando": "set_headless",             "parametros": { "headless": "0"|"1" } }
  { "comando": "close",                    "parametros": { "id_session": "uuid" } }
  { "comando": "extract_form_controls",    "parametros": { "id_session": "uuid" } }
  { "comando": "start_event_recording",    "parametros": { "id_session": "uuid", "chat_session_id": 123 } }
  { "comando": "stop_event_recording",     "parametros": { "id_session": "uuid" } }

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

ERRORES:
  - 400: parámetros faltantes o comando desconocido
  - 500: error interno (navegador no disponible, navegación fallida)
  - 502: error de conexión con el servicio Playwright
```
