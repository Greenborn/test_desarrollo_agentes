# ENDPOINTS — API REST

- **api_gestor_servicios:** Puerto `4250` (configurable vía `SERVICIO_GESTOR_PORT`). Punto de entrada que orquesta el resto de servicios. Los endpoints operativos requieren `GESTOR_API_KEY`. El frontend no lo llama directamente.
- **Backend Express principal:** Puerto `4000` (configurable vía `PORT` en `.env`). Actúa como proxy para `api_gestor_servicios` y `api_procesos_consola` (inyecta la API key automáticamente).
- **api_memoria (`memoriaClient.js`):** La comunicación desde el backend hacia el servicio de memoria se realiza **exclusivamente por WebSocket** (`ws://`, puerto 4101, path `/api/memoria`). Los endpoints HTTP del servicio de memoria se mantienen para compatibilidad con consumidores externos.
- **api_procesos_consola:** Puerto `3575` (configurable vía `SERVICIO_PROCESOS_CONSOLA_PORT`). Gestiona procesos de terminal (PTY) catalogados por sesión de chat. HTTP REST para gestión + WebSocket para streaming de terminal. Ver sección específica más abajo.
- Todas las rutas protegidas requieren sesión activa (cookie `session_token` almacenada en el servicio de memoria `api_memoria`).

---

## Gestor de Servicios (`/api/gestor`)

Endpoints del orquestador `api_gestor_servicios`. Los endpoints operativos (`/services`, `/services/:name/restart`) requieren autenticación vía `GESTOR_API_KEY` (header `X-API-Key` o `Authorization: Bearer`). El frontend accede a través del backend (proxy, puerto 4000) que inyecta la API key automáticamente.

### `GET /api/gestor/keepalive`
- **Auth:** No
- **Respuesta:** `{ status: "ok", timestamp: "2026-06-26T..." }`
- **Descripción:** Endpoint de salud del orquestador. Confirma que `api_gestor_servicios` está funcionando.

### `GET /api/gestor/services`
- **Auth:** GESTOR_API_KEY
- **Respuesta:**
```json
{
  "services": [
    { "name": "backend", "port": 4000, "running": true },
    { "name": "playwright", "port": 4098, "running": true },
    { "name": "documental", "port": 4099, "running": false },
    { "name": "gastos", "port": 4100, "running": true },
    { "name": "memoria", "port": 4101, "running": true },
    { "name": "procesos_consola", "port": 3575, "running": true }
  ]
}
```
- **Descripción:** Lista todos los servicios gestionados por el orquestador con su puerto y estado de ejecución.

### `POST /api/gestor/services/:name/restart`
- **Auth:** GESTOR_API_KEY
- **Params:** `name` — nombre del servicio (`backend`, `playwright`, `documental`, `gastos`, `memoria`, `procesos_consola`)
- **Respuesta 200:** `{ success: true, message: "Servicio \"backend\" reiniciado", running: true }`
- **Respuesta 404:** `{ error: "Servicio \"...\" no encontrado" }`
- **Descripción:** Mata el proceso del servicio y lo vuelve a spawnear.

---

## Procesos Consola (`/api/procesos`)

Servicio independiente `api_procesos_consola` (puerto `3575`, configurable vía `SERVICIO_PROCESOS_CONSOLA_PORT`). Gestiona terminales interactivas bash por sesión de chat. Los metadatos de cada terminal se almacenan en `api_memoria`.

### Autenticación

Los endpoints REST requieren `PROCESOS_CONSOLA_API_KEY` (header `X-API-Key` o `Authorization: Bearer`). El frontend accede a través del backend (puerto 4000) que inyecta la API key automáticamente. Las conexiones WebSocket se autentican mediante el `terminalId` (sin API key).

### `POST /api/procesos/terminal`
- **Auth:** Sesión activa (backend), API key (directo)
- **Body:** `{ chatSessionId: number, cwd?: string, cmd?: string }`
- **Respuesta 201:**
```json
{ "terminalId": "a1b2c3d4e5f6...", "wsUrl": "ws://localhost:3575?terminalId=a1b2c3d4e5f6..." }
```
- **Descripción:** Crea un registro de terminal en `api_memoria` con estado `pending`. El `terminalId` se usa para conectar vía WebSocket. El PTY se crea al conectarse el WebSocket (creación perezosa). Si no se especifica `cwd`, usa `process.cwd()`.

### `GET /api/procesos/terminal`
- **Auth:** Sesión activa (backend), API key (directo)
- **Query:** `?chatSessionId=xxx` (opcional — filtra por sesión)
- **Respuesta 200:**
```json
[
  { "terminalId": "...", "chatSessionId": 1, "cwd": "/home", "cmd": null, "pid": 12345, "status": "active", "createdAt": "...", "activatedAt": "..." }
]
```
- **Descripción:** Lista las terminales activas. Sin filtro devuelve todas las del servicio.

### `DELETE /api/procesos/terminal/:terminalId`
- **Auth:** Sesión activa (backend), API key (directo)
- **Respuesta 200:** `{ "terminalId": "...", "status": "closed" }`
- **Descripción:** Cierra/kill una terminal específica. Elimina sus metadatos de `api_memoria`.

### `DELETE /api/procesos/terminal`
- **Auth:** Sesión activa (backend), API key (directo)
- **Query:** `?chatSessionId=xxx` (requerido)
- **Respuesta 200:** `{ "closed": 3 }`
- **Descripción:** Cierra TODAS las terminales de una sesión de chat. Útil para limpieza al cambiar de workspace o cerrar sesión.

### `GET /api/health` (directo, sin auth)
- **Respuesta:** `{ "status": "ok", "service": "api_procesos_consola" }`

### Protocolo WebSocket

**URL de conexión:** `ws://localhost:3575?terminalId=xxx`

Una vez conectado, el servidor crea el PTY (bash), envía `{ "type": "created", "terminalId": "xxx" }` y comienza a transmitir datos.

**Mensajes Cliente → Servidor:**

| type | Campos | Descripción |
|------|--------|-------------|
| `input` | `{ data: string }` | Escribe datos en el PTY |
| `resize` | `{ cols: number, rows: number }` | Redimensiona el PTY |

**Mensajes Servidor → Cliente:**

| type | Campos | Descripción |
|------|--------|-------------|
| `data` | `{ data: string }` | Salida del PTY (puede contener códigos ANSI) |
| `exit` | `{ code: number, signal: string\|null }` | Proceso terminado |
| `created` | `{ terminalId: string }` | Confirmación de creación del PTY |
| `error` | `{ message: string }` | Error (ej: terminalId inválido) |

**Almacenamiento en api_memoria:**

- `terminal:{terminalId}` → `{ chatSessionId, cwd, cmd, pid, createdAt, activatedAt, status }`
- `chat_terminals:{chatSessionId}` → `[terminalId1, terminalId2, ...]` (índice para listado rápido)

---

## Servicio de Memoria — Protocolo WebSocket (`api_memoria`)

El servicio `api_memoria` (puerto `4101`) expone un servidor WebSocket en la misma dirección y puerto que HTTP, path `/api/memoria`.

**Conexión:** `ws://localhost:4101/api/memoria`

### Autenticación

Al conectarse, el cliente debe enviar un mensaje `auth` como primer mensaje:

```json
{ "id": "auth_1", "type": "auth", "token": "MEMORIA_API_KEY" }
```

El servidor responde:
```json
{ "id": "auth_1", "type": "auth_result", "success": true }
```

Si el token es inválido, la conexión se cierra.

### Formato general

**Request:** `{ "id": string, "type": string, ...campos según operación }`
**Response éxito:** `{ "id": string, "type": "${type}_result", ...datos }`
**Response error:** `{ "id": string, "type": "error", "error": string }`

El campo `id` permite correlacionar request y response; el cliente lo genera.

### Operaciones

| type | Campos request | Response éxito | Descripción |
|------|---------------|----------------|-------------|
| `set` | `namespace`, `key`, `value`, `ttl?` | `set_result: { success, namespace, key }` | Guarda un valor |
| `get` | `namespace`, `key` | `get_result: { namespace, key, value }` | Obtiene un valor |
| `del` | `namespace`, `key` | `del_result: { success }` | Elimina una clave |
| `keys` | `namespace` | `keys_result: { namespace, keys: [...] }` | Lista claves de un namespace |
| `clear` | `namespace` | `clear_result: { success }` | Elimina todo un namespace |
| `expire` | `namespace`, `key`, `ttl` | `expire_result: { success, namespace, key, expiresAt }` | Asigna TTL a una clave |
| `health` | — | `health_result: { status: "ok" }` | Health check |

### Ejemplos

```json
→ { "id": "r1", "type": "set", "namespace": "session", "key": "abc-123", "value": { "userId": 1 }, "ttl": 86400 }
← { "id": "r1", "type": "set_result", "success": true, "namespace": "session", "key": "abc-123" }

→ { "id": "r2", "type": "get", "namespace": "session", "key": "abc-123" }
← { "id": "r2", "type": "get_result", "namespace": "session", "key": "abc-123", "value": { "userId": 1 } }

→ { "id": "r3", "type": "del", "namespace": "session", "key": "abc-123" }
← { "id": "r3", "type": "del_result", "success": true }
```

### Cliente interno

El backend se comunica con `api_memoria` exclusivamente por WebSocket a través de `backend/src/services/memoriaClient.js`. Los endpoints HTTP REST de `api_memoria` se mantienen para consumidores externos.

---

## Autenticación (`/api/auth`)

### `GET /api/auth/me`
- **Auth:** Session cookie (opcional)
- **Respuesta:** `{ id: number|null, username: string|null, role: string|null }`

### `POST /api/auth/login`
- **Auth:** No
- **Body:** `{ username: string, password: string }`
- **Respuesta 200:** `{ success: true, user: { id, username, role } }`
- **Respuesta 401:** `{ success: false, error: "Credenciales inválidas" }`

### `POST /api/auth/logout`
- **Auth:** Session
- **Respuesta:** `{ success: true }`

---

## Chat (`/api/chat`)

### `GET /api/chat/sessions`
- **Auth:** Requerida
- **Workspace:** Filtra por `workspace_id` de la sesión
- **Respuesta:** `{ sessions: [{ id, title, updated_at, cwd, proyecto_id, proyecto_descripcion, proyecto_color, id_ticket_redmine, workspace_id, priority_id, priority_name }] }`
- **Descripción:** Lista las sesiones activas (no archivadas) del usuario.

### `POST /api/chat/sessions`
- **Auth:** Requerida
- **Workspace:** Asigna `workspace_id` de la sesión
- **Body (opcional):** `{ cwd: string }`
- **Respuesta 201:** `{ session: { id, title, cwd, ... } }`

### `GET /api/chat/sessions/:id/messages`
- **Auth:** Requerida
- **Respuesta:** `{ sessionId, messages: [{ id, role, content, thinking, created_at }] }`

### `POST /api/chat/sessions/:id/messages`
- **Auth:** Requerida
- **Body:** `{ message: string }`
- **Respuesta:** SSE stream (`text/event-stream`)
  - `data: {"type":"thinking","content":"..."}`
  - `data: {"type":"response","content":"..."}`
  - `data: {"type":"done","sessionId":...}`
  - `data: {"type":"error","content":"..."}`
- Los roles no estándar (`command`, `result`, `opencode_info`, `opencode_result`) se normalizan a `user`/`system` antes de enviar a DeepSeek. Ver `normalizeMessages()` en `services/deepseek.js`.

### `POST /api/chat/summarize-file`
- **Auth:** Requerida
- **Body:** `{ fileContent: string, filePath?: string, sessionId?: number }`
- **Respuesta:** `{ description: string }`
- **Descripción:** Envía el contenido de un archivo a DeepSeek para obtener una descripción de máximo 300 caracteres. No streaming — respuesta directa JSON.

### `POST /api/chat/summarize-files-batch`
- **Auth:** Requerida
- **Body:** `{ files: [{ path: string, content: string }], model?: string, thinking?: string, sessionId?: number }`
- **Respuesta:** `{ descriptions: { [path]: string } }`
- **Descripción:** Envía múltiples archivos en un solo prompt a DeepSeek. Retorna un JSON con las rutas como claves y descripciones como valores. Usado por `/deteccion_funcionalidades` para procesar batches de 10 archivos en una sola llamada, reduciendo significativamente las requests a la API.

### `GET /api/chat/sessions/archived`
- **Auth:** Requerida
- **Workspace:** Filtra por `workspace_id` de la sesión
- **Respuesta:** `{ sessions: [{ id, title, updated_at, cwd, proyecto_id, proyecto_descripcion, proyecto_color, id_ticket_redmine, workspace_id, priority_id, priority_name }] }`
- **Descripción:** Lista únicamente las sesiones archivadas del usuario. Misma estructura que `GET /sessions` pero filtrando `archived = true`.

### `POST /api/chat/sessions/:id/archive`
- **Auth:** Requerida
- **Respuesta 200:** `{ success: true, sessionId }`
- **Respuesta 404:** `{ error: "Sesión no encontrada" }`
- **Descripción:** Marca la sesión como archivada (`archived = true`). La sesión deja de aparecer en `GET /sessions` y pasa a `GET /sessions/archived`.

### `POST /api/chat/sessions/:id/unarchive`
- **Auth:** Requerida
- **Respuesta 200:** `{ success: true, sessionId }`
- **Respuesta 404:** `{ error: "Sesión no encontrada" }`
- **Descripción:** Desarchiva la sesión (`archived = false`). Vuelve a aparecer en `GET /sessions`.

### `DELETE /api/chat/sessions/:id`
- **Auth:** Requerida
- **Respuesta:** `{ success: true, sessionId }`

### `DELETE /api/chat/sessions/:id/messages`
- **Auth:** Requerida
- **Respuesta:** `{ success: true, sessionId }`
- **Descripción:** Elimina todos los mensajes de una sesión sin eliminar la sesión ni sus metadatos (ticket, proyecto, etc.).

---

## Configuración (`/api/settings`)

### `GET /api/settings`
- **Auth:** Requerida
- **Query:** `?workspace_id=X` (opcional, default: primary workspace)
- **Respuesta:** `{ deepseek_key: string (mascarado), system_prompt: string|null, ... }`

### `POST /api/settings`
- **Auth:** Requerida
- **Body:** `{ key: string, value: string, workspace_id?: number }` — si no se envía `workspace_id`, usa el primary
- Si `key === "deepseek_key"` se encripta con AES-256-CBC antes de almacenar
- Keys soportadas: `deepseek_key`, `redmine_token`, `redmine_url`, `system_prompt`, `documentacion_prompt_*`, `ticket_descripcion_prompt`, `deteccion_funcionalidades_prompt`, `code_file_extensions`, `code_file_max_size_kb`, `omnifilter_debounce_ms`, `screen_resolutions`, `request_response_max_size_kb`, `terminal_max_terminals`
- **Respuesta:** `{ success: true }`

### `GET /api/settings/global`
- **Auth:** Requerida
- **Descripción:** Devuelve todas las configuraciones globales (compartidas entre todos los workspaces). Estas settings no dependen de ningún workspace.
- **Respuesta:** `{ ticket_descripcion_mejorar_prompt: string, ... }`

### `POST /api/settings/global`
- **Auth:** Requerida
- **Descripción:** Guarda o actualiza una configuración global (sin workspace asociado).
- **Body:** `{ key: string, value: string }`
- **Respuesta 200:** `{ success: true }`
- **Respuesta 400:** `{ error: "key es requerido" }`

### `GET /api/settings/export-all`
- **Auth:** Requerida
- **Descripción:** Exporta todas las configuraciones de todos los workspaces, incluyendo settings, ambientes (DEV/TST/PRD) y configuraciones globales. Los valores encriptados (`deepseek_key`, `redmine_token`) se devuelven en texto plano. Sin hardcoding de keys — incluye automáticamente cualquier key presente en la DB.
- **Respuesta 200:**
```json
{
  "version": 1,
  "exported_at": "2026-06-23T12:00:00.000Z",
  "configuracion_general": {
    "ticket_descripcion_mejorar_prompt": "Eres un asistente experto..."
  },
  "workspaces": {
    "Por Defecto": {
      "deepseek_key": "sk-plain-text",
      "redmine_token": "token-plain-text",
      "redmine_url": "https://...",
      "system_prompt": "...",
      "ambientes": [
        { "nombre": "DEV", "rama": "develop", "descripcion": "Desarrollo" },
        { "nombre": "TST", "rama": "TST", "descripcion": "Testing" },
        { "nombre": "PRD", "rama": "PRD", "descripcion": "Producción" }
      ]
    },
    "Otro Workspace": { "...": "..." }
  }
}
```

### `POST /api/settings/import-all`
- **Auth:** Requerida
- **Body:** Misma estructura que `GET /api/settings/export-all`. El campo `configuracion_general` se restaura en la tabla `global_settings` (compartido entre workspaces).
- **Descripción:** Importa configuraciones desde un JSON. Busca cada workspace por **nombre** en la DB. Las credenciales (`deepseek_key`, `redmine_token`) se re-encriptan antes de almacenar. Los ambientes se actualizan por nombre dentro de cada workspace. Las keys nuevas se crean automáticamente sin necesidad de actualizar el código.
- **Respuesta 200:** `{ success: true }`
- **Respuesta 400:** `{ error: "workspaces es requerido" }`

---

## Comandos del sistema (`/api/command`)

### `GET /api/command/list-directories`
- **Auth:** Requerida
- **Query:** `prefix` (default `/`), `cwd` (default `process.cwd()`)
- **Respuesta:** `{ directories: string[] }`

### ~~`GET /api/command/setting/:key`~~ → Migrado a WebSocket (`setting:get`)
- ~~**Auth:** Requerida~~
- ~~**Respuesta:** `{ value: string|null }`~~

### ~~`POST /api/command/setting`~~ → Migrado a WebSocket (`setting:set`)
- ~~**Auth:** Requerida~~
- ~~**Body:** `{ key: string, value: string }`~~
- ~~**Respuesta:** `{ success: true }`~~

### `GET /api/command/history`
- **Auth:** Requerida
- **Respuesta:** `{ history: [{ command, created_at }] }` (últimos 50)

### `POST /api/command/history`
- **Auth:** Requerida
- **Body:** `{ command: string }`
- **Respuesta:** `{ success: true }`

### `POST /api/command/git-merge`
- **Auth:** Requerida
- **Body:** `{ sessionId: number, ambienteName: string, mensaje?: string, comentar?: "enviar"|"encolar" }`
- **Descripción:** Ejecuta el flujo completo de merge a rama de ambiente: verifica que no haya cambios pendientes, obtiene la rama destino desde la tabla `workspace_environments`, hace checkout a la rama destino, ejecuta `git merge` con el mensaje indicado, hace `git push` si el merge es exitoso, y opcionalmente envía o encola un comentario en Redmine si hay un ticket asignado a la sesión.
- **Respuesta 200 (éxito):** `{ success: true, hasConflicts: false, mergeOutput, pushOutput, targetBranch, sourceBranch, redmineComment?: { action, ticketId } }`
- **Respuesta 200 (conflictos):** `{ success: true, hasConflicts: true, mergeOutput, checkoutOutput, targetBranch, sourceBranch, instruction }`
- **Respuesta 400 (error):** `{ success: false, error: "..." }` (cambios pendientes, no es repositorio, ambiente no encontrado, etc.)

### `POST /api/proxy/request`
- **Auth:** Requerida
- **Body:** `{ url: string (requerido), method: string (default "GET"), headers?: [{ key: string, value: string }], body?: string }`
- **Descripción:** Proxy para realizar peticiones HTTP desde el servidor (evita CORS). Lee `request_response_max_size_kb` de la configuración del workspace para limitar el tamaño del body de respuesta. Si se excede el límite, el body se trunca sin error. Timeout de 30 segundos.
- **Métodos permitidos:** `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`
- **Header restringido:** `Host` no puede sobrescribirse.
- **Respuesta 200:**
```json
{
  "status": 200,
  "statusText": "OK",
  "headers": { "content-type": "application/json", ... },
  "body": "... (contenido truncado si excede el límite) ...",
  "truncated": false,
  "originalSize": 12345,
  "bodySize": 12345,
  "elapsed": 234
}
```
- **Respuesta 200 (error de red/redirección inválida/name resolution):**
```json
{
  "status": 0,
  "statusText": "Error",
  "headers": {},
  "body": "",
  "truncated": false,
  "originalSize": 0,
  "bodySize": 0,
  "elapsed": 0,
  "error": "getaddrinfo ENOTFOUND dominioinexistente"
}
```
- **Respuesta 200 (timeout):**
```json
{
  "status": 0,
  "statusText": "Timeout",
  "headers": {},
  "body": "",
  "truncated": false,
  "originalSize": 0,
  "bodySize": 0,
  "elapsed": 30000,
  "error": "La petición excedió el tiempo de espera (30s)."
}
```

### `POST /api/command/execute`
- **Auth:** Requerida
- **Body:** `{ command: string, sessionId?: number }`
- Comandos soportados: `/cd`, `/ls`, `/help`, `/history`
- Si `sessionId` existe, guarda `command`/`result` en `chat_messages`
- **Respuesta:** `{ success: boolean, result: string, command: string }`

### `POST /api/command/open-in-explorer`
- **Auth:** Requerida
- **Body:** `{ path: string }` — ruta absoluta del archivo o directorio
- **Descripción:** Abre la carpeta en el explorador de archivos del sistema. Si `path` es un archivo, abre la carpeta contenedora. Usa `xdg-open` (Linux), `open` (macOS) o `explorer` (Windows).
- **Respuesta:** `{ success: true, path: string }`

---

## OpenCode (`/api/opencode`)

### `GET /api/opencode/start`
- **Auth:** Requerida
- **Query:** `?sessionId=<chatSessionId>` (opcional — asigna el servidor OpenCode a una sesión de chat específica)
- **Respuesta:** `{ providers, defaultModels, savedProvider, savedModel, savedThinking, savedMode, savedTemperature }`
- **Comportamiento:**
  - Los campos `saved*` se leen primero de `user_settings` (key `opencode_last_*`).
  - Si `sessionId` tiene un proyecto asociado, los valores guardados en `project_variables` (keys `opencode_*`) sobreescriben los de `user_settings`.
  - El frontend aplica estos `saved*` como valores por defecto de los `selected*` en el store.

### `POST /api/opencode/select`
- **Auth:** Requerida
- **Body:** `{ key: string, value: string, sessionId?: number }`
- Guarda en `user_settings` como `opencode_last_<key>`.
- Si `sessionId` está presente y tiene un proyecto asociado, también guarda en `project_variables` como `opencode_<key>` (type `'db'`).
- Keys válidas: `provider`, `model`, `thinking`, `mode`, `temperature`.
- **Respuesta:** `{ success: true }`

### `POST /api/opencode/send`
- **Auth:** Requerida
- **Body:** `{ prompt, provider?, model?, thinking?, mode?, sessionId?, ocSessionId? }`
- **Respuesta:** SSE stream
  - `data: {"type":"thinking","content":"..."}`
  - `data: {"type":"response","content":"..."}`
  - `data: {"type":"control_request","control":{...}}`
  - `data: {"type":"done","ocSessionId","hash","fullResponse","diff":[...]}`
  - `data: {"type":"error","content":"..."}`

### `POST /api/opencode/control`
- **Auth:** Requerida
- **Body:** `{ controlId: string, response: "yes"|"no", remember?: boolean }`
- **Respuesta:** `{ success: true }`

### `POST /api/opencode/finish`
- **Auth:** Requerida
- **Body:** `{ ocSessionId?: string, sessionId: number }` — detiene y elimina el servidor OpenCode asociado a la sesión de chat
- **Respuesta:** `{ success: true, hash: string|null }`

---

## Navegador / Playwright (`/api/navegador`)

Hace proxy al servicio Playwright independiente (puerto `4098`).

### `POST /api/navegador/command`
- **Auth:** Requerida
- **Body:** `{ comando: string, parametros?: object, sessionId?: number }`
- Comandos proxy: `start`, `go_to_url`, `set_headless`, `close`
- Guarda `command`/`result` en `chat_messages` si `sessionId` existe
- **Respuesta:** Passthrough del servicio Playwright

### `POST /api/navegador/finish`
- **Auth:** Requerida
- **Body:** `{ id_session: string, sessionId?: number }`
- Envía `close` al servicio Playwright
- **Respuesta:** Passthrough del servicio Playwright

---

## Funcionalidades (`/api/funcionalidad`)

### `GET /api/funcionalidad/:sessionId`
- **Auth:** Requerida
- **Respuesta:** `{ funcionalidad: { id, session_id, fecha_hora, etapa, parametros (objeto), proyecto_id } | null }`

### `POST /api/funcionalidad`
- **Auth:** Requerida
- **Body:** `{ sessionId (req), etapa?, parametros?, proyectoId? }`
- Upsert por `session_id`. Valida que `proyectoId` exista en tabla `proyectos`.
- **Respuesta 200/201:** `{ success: true, funcionalidad: {...} }`
- **Respuesta 400:** `{ error: "..." }`

### `DELETE /api/funcionalidad/:sessionId`
- **Auth:** Requerida
- **Respuesta:** `{ success: true }`

---

## Proyectos (`/api/proyecto`)

### `GET /api/proyecto`
- **Auth:** Requerida
- **Descripción:** Lista proyectos. El proyecto pineado (si existe) aparece primero.
- **Respuesta:** `{ proyectos: [{ id, descripcion, color }], pinnedProjectId: string|null }`

### `POST /api/proyecto`
- **Auth:** Requerida
- **Body:** `{ id: string, descripcion: string }`
- **Respuesta:** `{ success: true }`

### `POST /api/proyecto/crear-en-redmine`
- **Auth:** Requerida
- **Body:** `{ nombre: string, identificador?: string, descripcion?: string, workspace_id?: number, tracker_ids?: number[], asignar_a_sesion?: boolean, sessionId?: number }`
- **Descripción:** Crea un proyecto en Redmine (`POST /projects.json`) y lo guarda en la tabla `proyectos` local con el `redmine_id` devuelto. Si `asignar_a_sesion` y `sessionId` se proveen, asigna el proyecto a la sesión. `tracker_ids` permite especificar qué trackers habilitar en el proyecto Redmine. Si no se provee `identificador`, se genera automáticamente desde el nombre (slug).
- **Respuesta 200:** `{ success: true, proyecto: { id, workspace_id, descripcion, redmine_id, ... } }`
- **Respuesta 400:** `{ error: "..." }` (nombre requerido, workspace no encontrado, Redmine no configurado, duplicado)
- **Respuesta 500:** `{ error: "..." }` (error al crear en Redmine o al insertar local)

### `GET /api/proyecto/session/:sessionId`
- **Auth:** Requerida
- **Respuesta:** `{ proyectoId: string|null }`

### `POST /api/proyecto/session`
- **Auth:** Requerida
- **Body:** `{ sessionId (req), proyectoId?: string|null }`
- **Respuesta:** `{ success: true }`

### `PUT /api/proyecto/:id/color`
- **Auth:** Requerida
- **Params:** `id` — slug del proyecto
- **Body:** `{ color: string }` — color hexadecimal (ej: `#ff6b6b`)
- **Descripción:** Actualiza el color identificativo del proyecto para los iconos de sesión de chat.
- **Respuesta 200:** `{ success: true }`
- **Respuesta 400:** `{ error: "color es requerido" }`
- **Respuesta 404:** `{ error: "Proyecto no encontrado" }`

### `PUT /api/proyecto/repositorio`
- **Auth:** Requerida
- **Body:** `{ proyectoId: string, url_github: string }`
- **Descripción:** Actualiza la URL del repositorio GitHub del proyecto especificado.
- **Respuesta 200:** `{ success: true }`
- **Respuesta 400:** `{ error: "proyectoId es requerido" }`
- **Respuesta 404:** `{ error: "Proyecto no encontrado" }`

### `GET /api/proyecto/repositorio/:proyectoId`
- **Auth:** Requerida
- **Descripción:** Obtiene la URL del repositorio GitHub del proyecto especificado.
- **Respuesta 200:** `{ url_github: string|null }`

### `POST /api/proyecto/pin`
- **Auth:** Requerida
- **Body:** `{ proyectoId: string|null }`
- **Descripción:** Fija o quita el proyecto pineado para el usuario. Si `proyectoId` es `null` o se omite, quita el pin.
- **Almacenamiento:** `user_settings` con key `pinned_project`
- **Respuesta:** `{ success: true }`

### `GET /api/proyecto/:id/variables`
- **Auth:** Requerida
- **Params:** `id` — slug del proyecto
- **Workspace:** Valida que el proyecto pertenezca al workspace de la sesión
- **Descripción:** Lista todas las variables del proyecto (clave-valor) ordenadas por nombre ascendente.
- **Respuesta 200:** `{ variables: [{ key: string, value: string }] }`
- **Respuesta 404:** `{ error: "Proyecto no encontrado" }`

### `POST /api/proyecto/:id/variables`
- **Auth:** Requerida
- **Params:** `id` — slug del proyecto
- **Body:** `{ key: string, value: string }`
- **Descripción:** Crea una nueva variable en el proyecto.
- **Respuesta 201:** `{ success: true }`
- **Respuesta 400:** `{ error: "key es requerido" }` o `{ error: "value es requerido" }`
- **Respuesta 404:** `{ error: "Proyecto no encontrado" }`
- **Respuesta 409:** `{ error: "La variable \"...\" ya existe en este proyecto" }`

### `PUT /api/proyecto/:id/variables/:key`
- **Auth:** Requerida
- **Params:** `id` — slug del proyecto, `key` — nombre de la variable
- **Body:** `{ value: string }`
- **Descripción:** Actualiza el valor de una variable existente.
- **Respuesta 200:** `{ success: true }`
- **Respuesta 400:** `{ error: "value es requerido" }`
- **Respuesta 404:** `{ error: "Variable \"...\" no encontrada" }` o `{ error: "Proyecto no encontrado" }`

### `DELETE /api/proyecto/:id/variables/:key`
- **Auth:** Requerida
- **Params:** `id` — slug del proyecto, `key` — nombre de la variable
- **Descripción:** Elimina una variable del proyecto.
- **Respuesta 200:** `{ success: true }`
- **Respuesta 404:** `{ error: "Variable \"...\" no encontrada" }` o `{ error: "Proyecto no encontrado" }`

---

## Archivos (`/api/archivos`)

### `GET /api/archivos`
- **Auth:** Requerida
- **Query:** `proyecto_id` (opcional), `chat_session_id` (opcional), `tipo` (opcional), `include_metadata` (opcional)
- **Descripción:** Lista los archivos almacenados, filtrados opcionalmente por proyecto, sesión de chat o tipo MIME. Ordenados por fecha descendente. Si `include_metadata=true`, cada archivo incluye un array `metadata` con sus registros de `capturas_metadata` asociados.
- **Respuesta 200:** `{ archivos: [{ id, proyecto_id, chat_session_id, nombre_original, nombre_storage, tipo, tamano, created_at, metadata?: [{ id, archivo_id, key, value, created_at }] }] }`

### `GET /api/archivos/:id/download`
- **Auth:** Requerida
- **Params:** `id` — ID del archivo
- **Descripción:** Sirve el archivo binario (imagen, etc.) almacenado en disco. Usado para mostrar previsualizaciones en el frontend.
- **Respuesta 200:** Archivo binario con `Content-Type` apropiado
- **Respuesta 404:** `{ error: "Archivo no encontrado" }` o `{ error: "El archivo no existe en el disco" }`

### `GET /api/archivos/:id/metadata`
- **Auth:** Requerida
- **Params:** `id` — ID del archivo
- **Descripción:** Lista los registros de metadata asociados a un archivo (captura de pantalla). Ordenados por fecha ascendente.
- **Respuesta 200:** `{ metadata: [{ id, archivo_id, key, value, created_at }] }`
- **Respuesta 404:** `{ error: "Archivo no encontrado" }`

### `DELETE /api/archivos/:id/metadata/:mid`
- **Auth:** Requerida
- **Params:** `id` — ID del archivo, `mid` — ID del registro de metadata
- **Descripción:** Elimina un registro de metadata específico.
- **Respuesta 200:** `{ success: true }`
- **Respuesta 404:** `{ error: "Archivo no encontrado" }` o `{ error: "Metadata no encontrada" }`

### `POST /api/archivos/:id/metadata`
- **Auth:** Requerida
- **Body:** `{ key: string, value: string }`
- **Descripción:** Crea o actualiza una entrada de metadata para el archivo. Si ya existe una entrada con la misma `key` para el archivo, actualiza su `value`; si no, crea una nueva. Útil para guardar notas rápidas (`key: 'quick_notes'`) u otros metadatos definidos por el usuario.
- **Respuesta 200:** `{ metadata: { id, archivo_id, key, value, created_at } }`
- **Respuesta 400:** `{ error: "key y value son requeridos" }`
- **Respuesta 404:** `{ error: "Archivo no encontrado" }`

### `DELETE /api/archivos/:id`
- **Auth:** Requerida
- **Params:** `id` — ID del archivo
- **Descripción:** Elimina el archivo del disco y su registro en la base de datos. Los metadatos asociados se eliminan en cascada.
- **Respuesta 200:** `{ success: true }`
- **Respuesta 404:** `{ error: "Archivo no encontrado" }`

### `POST /api/navegador/capturar-pantalla`
- **Auth:** Requerida
- **Body:** `{ sessionId: number, fullpage?: boolean }`
- **Descripción:** Toma una captura de pantalla del navegador activo via Playwright, la guarda en `uploads/archivos/` y crea un registro en la tabla `archivos` vinculado al proyecto de la sesión de chat. La sesión debe tener un proyecto asignado. Adicionalmente guarda en `capturas_metadata` el HTML de la página (`key: 'page_html'`) y los inputs detectados con sus posiciones (`key: 'detected_inputs'`).
- **Respuesta 200:** `{ success: true, archivo: { id, proyecto_id, chat_session_id, nombre_original, nombre_storage, tipo, tamano, created_at } }`
- **Respuesta 400:** `{ error: "La sesión de chat no está vinculada a un proyecto." }` o `{ error: "No hay sesión de navegador activa." }`
- **Respuesta 404:** `{ error: "Sesión de chat no encontrada" }`
- **Respuesta 502:** `{ error: "Servicio Playwright no disponible" }`

---

## Servicio Playwright (servidor separado, puerto `4098`)

### `GET /api/health`
- **Respuesta:** `{ status: "ok" }`

### `POST /api/command`
- **Body:** `{ comando: string, parametros?: object }`
- **Comandos:**
  | comando | parametros | Respuesta |
  |---|---|---|
  | `start` | `{ navegador: "chromium"\|"firefox", headless?, url?, resolution?: { width, height }, chat_session_id?: number }` | `{ id_session, headless, url, resolution, chat_session_id }` |
  | `go_to_url` | `{ id_session?, url }` | `{ success: true, id_session }` |
  | `set_headless` | `{ headless: boolean\|"0"\|"1" }` | `{ success: true, reiniciado, id_session?, headless }` |
  | `close` | `{ id_session }` | `{ success: true }` |
  | `take_screenshot` | `{ id_session?, fullpage? }` | `{ success: true, id_session, fullpage, image_base64 (string), size (bytes) }` |
  | `extract_form_controls` | `{ id_session? }` | `{ success: true, id_session, url, title, scrollX, scrollY, viewportWidth, viewportHeight, pageWidth, pageHeight, forms, controls }` |
  | `get_page_html` | `{ id_session? }` | `{ success: true, id_session, html (string) }` |
  | `start_event_recording` | `{ id_session?, chat_session_id?, recording_id? }` | `{ success: true, id_session, recording: true, recording_id }` |
  | `stop_event_recording` | `{ id_session? }` | `{ success: true, id_session, recording: false }` |
  | `execute_action` | `{ id_session?, action: { type, selector?, value?, key?, x?, y?, delay?, eventType?, eventInit? } }` | `{ success: true, id_session, type, selector? }` |
  | `evaluate_selector` | `{ id_session?, selector, extract_type?, attribute_name? }` | `{ success: true, id_session, selector, extract_type, found (boolean), value }` |
  | `simulate_event` | `{ id_session?, selector, event_type?, event_init? }` | `{ success: true, id_session, selector, event_type }` |
- **Tipos de action (execute_action):** `click`, `fill`, `type`, `select`, `submit`, `press`, `focus`, `blur`, `check`, `uncheck`, `hover`, `scroll`, `dispatch_event`
- **Tipos de extract_type (evaluate_selector):** `value`, `text`, `html`, `attribute`, `checked`, `exists`, `count`

---

## Gastos Tokens (`/api/gastos`)

Hace proxy al servicio de gastos independiente (puerto `4100`).

### `GET /api/gastos`
- **Auth:** Requerida
- **Query params:** `id_proyecto` (opcional), `id_chat_session` (opcional)
- **Respuesta:** `[{ id, id_chat_session, id_proyecto, precio, tokens, fecha_hora }]`

### `POST /api/gastos/register`
- **Auth:** Requerida
- **Body:** `{ id_chat_session: number, id_proyecto: string, precio: number, tokens: number }`
- **Respuesta 200:** `{ success: true, id: number }`
- **Respuesta 400:** `{ error: "Campo \"...\" es requerido" }`

---
## Redmine (`/api/redmine`)

### `POST /api/redmine/test`
- **Auth:** Requerida
- **Body:** ninguno
- **Descripción:** Lee `redmine_token` y `redmine_url` de la configuración, hace una petición GET a `${redmine_url}/projects.json` con autenticación Bearer, y devuelve si la conexión fue exitosa o no.
- **Respuesta 200:** `{ success: true, message: "Conexión exitosa a Redmine." }`
- **Respuesta 200 (error):** `{ success: false, message: "Error: ..." }`

### `GET /api/redmine/proyectos/options`
- **Auth:** Requerida
- **Query:** `workspace_id` (number, opcional — usa el primero de la sesión si no se provee)
- **Descripción:** Obtiene los trackers, prioridades y estados disponibles desde la instancia Redmine configurada para el espacio de trabajo especificado. Consulta `/trackers.json`, `/enumerations/issue_priorities.json` y `/issue_statuses.json`.
- **Respuesta 200:** `{ trackers: [{ id, name }], priorities: [{ id, name }], statuses: [{ id, name }] }`

### `GET /api/redmine/proyectos`
- **Auth:** Requerida
- **Body:** ninguno
- **Descripción:** Obtiene el listado de proyectos Redmine desde `${redmine_url}/projects.json` con autenticación Bearer. Incluye `time_entry_activities`, `issue_categories` y `enabled_modules`.
- **Respuesta 200:** `{ success: true, proyectos: [{ id, name, identifier, description, status, created_on, updated_on, parent, slug }] }`
- **Respuesta 200 (error):** `{ success: false, message: "..." }`

### `POST /api/redmine/proyectos/import-all`
- **Auth:** Requerida
- **Body:** ninguno
- **Descripción:** Obtiene todos los proyectos desde Redmine API (con paginación automática, límite 100 por página) y los importa a la tabla `proyectos` local. Verifica existencia por `redmine_id` (columna UNIQUE). Los errores individuales no detienen el proceso.
- **Respuesta 200:** `{ success: true, importados: [{ id, name, identifier }], yaExistentes: [{ id, name, identifier }], errores: [{ id, name, error }], total: number }`

### `GET /api/redmine/proyectos/:proyectoId/tickets`
- **Auth:** Requerida
- **Params:** `proyectoId` — ID local del proyecto (slug en tabla `proyectos`)
- **Descripción:** Busca el proyecto en la base local, obtiene su `redmine_id` y consulta la API de Redmine (`${url}/issues.json?project_id=${redmineId}`) para obtener los tickets del proyecto. Incluye orden por `updated_on` descendente, límite 100.
- **Respuesta 200:** `{ success: true, tickets: [{ id, subject, status, priority, tracker, assigned_to, created_on, updated_on }], total: number }`
- **Respuesta 200 (error):** `{ success: false, message: "Proyecto no encontrado..." | "El proyecto no tiene ID de Redmine..." | "Token o URL no configurados..." | "Error al obtener tickets..." }`

### `POST /api/redmine/proyectos/importar-tickets-all`
- **Auth:** Requerida
- **Body:** ninguno
- **Descripción:** Itera sobre todos los proyectos de la base local que tengan `redmine_id` (no nulo) e importa/actualiza sus tickets desde Redmine. Para cada proyecto usa paginación automática (límite 100). Los errores por proyecto no detienen el proceso.
- **Respuesta 200:** `{ success: true, total_proyectos: number, resultados: [{ proyecto_id, importados, actualizados, total_redmine } | { proyecto_id, error }], totales: { importados, actualizados } }`
- **Respuesta 200 (error):** `{ success: false, message: "..." }`

### `POST /api/redmine/proyectos/:proyectoId/importar-tickets`
- **Auth:** Requerida
- **Params:** `proyectoId` — ID local del proyecto (slug en tabla `proyectos`)
- **Descripción:** Busca el proyecto en la base local, obtiene su `redmine_id` y consulta la API de Redmine (`${url}/issues.json?project_id=${redmineId}`) con paginación automática (límite 100). Cada issue se guarda en la tabla `tickets` usando `redmine_id` como clave única: si ya existe se actualiza, si no existe se inserta.
- **Respuesta 200:** `{ success: true, importados: number, actualizados: number, total_redmine: number }`
- **Respuesta 200 (error):** `{ success: false, message: "..." }`

### `POST /api/redmine/proyectos/import`
- **Auth:** Requerida
- **Body:** `{ id, name, description?, status?, created_on?, updated_on?, parent?: { id, name } }`
- **Descripción:** Importa un proyecto Redmine a la tabla `proyectos` local. Genera un slug (minúsculas, solo letras/números, espacios → `_`, sin acentos/símbolos) como `id` del proyecto. Verifica que no exista duplicado.
- **Respuesta 200:** `{ success: true, proyectoId: "slug_del_proyecto" }`
- **Respuesta 200 (error):** `{ success: false, message: "..." }`

### `POST /api/redmine/comments`
- **Auth:** Requerida
- **Body:** `{ session_id: number, ticket_redmine_id: number, comentario: string, tipo?: string }`
- **Descripción:** Encola un comentario en la tabla `redmine_comentarios` con estado `pendiente`. `tipo` es opcional (default `'comentario_commit'`). Usar `'ticket_comment'` para comentarios directos del usuario que deben enviarse sin formato adicional.
- **Respuesta 200:** `{ success: true, id: number }`
- **Respuesta 400:** `{ error: "..." }` (campos requeridos faltantes)

### `GET /api/redmine/comments`
- **Auth:** Requerida
- **Query:** `estado` (string, default `"pendiente"`)
- **Descripción:** Obtiene los comentarios de Redmine filtrados por estado y workspace, ordenados por fecha de creación ascendente.
- **Respuesta 200:** `{ success: true, comentarios: [{ id, session_id, ticket_redmine_id, comentario, estado, created_at, updated_at }] }`

### `POST /api/redmine/comments/send`
- **Auth:** Requerida
- **Body:** `{ comentarios_ids: number[], mensaje: string }`
- **Descripción:** Envía los comentarios pendientes a Redmine. Todos los comentarios deben pertenecer al mismo ticket. Concatena el mensaje y lo envía vía `PUT /issues/{ticketId}.json` con `{ issue: { notes: mensaje } }`. En caso de éxito marca los comentarios como `enviado`; en caso de error los marca como `error`.
- **Respuesta 200:** `{ success: true, ticket_id: number, cantidad: number }`
- **Respuesta 400:** `{ error: "..." }` (IDs inválidos, mensaje vacío, comentarios de distintos tickets, etc.)
- **Respuesta 500:** `{ error: "..." }` (error de API Redmine)

### `DELETE /api/redmine/comments/sent`
- **Auth:** Requerida
- **Body:** `{ sessionId: number }`
- **Descripción:** Elimina todos los comentarios con estado `enviado` de la sesión de chat indicada. Verifica que la sesión pertenezca a un workspace accesible por el usuario.
- **Respuesta 200:** `{ success: true, deletedCount: number }`
- **Respuesta 400:** `{ error: "sessionId es requerido" }`

### `DELETE /api/redmine/comments/:id`
- **Auth:** Requerida
- **Params:** `id` — ID del comentario en la base local
- **Descripción:** Elimina un comentario de la tabla `redmine_comentarios`. Verifica que el comentario exista y que pertenezca a un workspace accesible por el usuario.
- **Respuesta 200:** `{ success: true }`
- **Respuesta 404:** `{ error: "Comentario no encontrado" }`
- **Respuesta 403:** `{ error: "Acceso denegado al comentario" }`

---

## Tickets (`/api/tickets`)

### `GET /api/tickets`
- **Auth:** Requerida
- **Descripción:** Obtiene todos los tickets almacenados en la base de datos local (tabla `tickets`), ordenados por `redmine_updated_on` descendente.
- **Respuesta 200:** `{ success: true, tickets: [{ id, proyecto_id, redmine_id, subject, description, status_name, tracker_name, priority_name, assigned_to_name, author_name, start_date, due_date, estimated_hours, done_ratio, fixed_version_name, redmine_created_on, redmine_updated_on, redmine_closed_on }] }`

### `GET /api/tickets/options`
- **Auth:** Requerida
- **Descripción:** Obtiene las opciones disponibles desde la API de Redmine para los campos del ticket: estados, prioridades y usuarios activos. Consulta tres endpoints en paralelo: `/issue_statuses.json`, `/enumerations/issue_priorities.json` y `/users.json?limit=100&status=1`. Si Redmine no está configurado o falla la conexión, retorna arreglos vacíos.
- **Respuesta 200:** `{ statuses: [{ id: 1, name: "New" }, ...], priorities: [{ id: 3, name: "High" }, ...], users: [{ id: 5, name: "John Doe", login: "jdoe" }, ...] }`

### `GET /api/tickets/ticket-options/:ticketId`
- **Auth:** Requerida
- **Params:** `ticketId` — ID numérico del ticket en Redmine (`redmine_id`)
- **Descripción:** Obtiene las opciones contextuales para un ticket específico desde la API de Redmine. Consulta `GET /issues/{ticketId}.json?include=allowed_statuses` para obtener los estados permitidos y el ID del proyecto. Luego obtiene las prioridades desde `/enumerations/issue_priorities.json` y los miembros del proyecto desde `/projects/{projectId}/memberships.json` (si se obtuvo el proyecto; si no, cae a `/users.json`). Si Redmine no está configurado o falla la conexión, retorna arreglos vacíos.
- **Respuesta 200:** `{ statuses: [{ id, name }], priorities: [{ id, name }], users: [{ id, name }] }`

### `GET /api/tickets/statuses/:ticketId`
- **Auth:** Requerida
- **Params:** `ticketId` — ID numérico del ticket en Redmine (`redmine_id`)
- **Descripción:** Obtiene los estados permitidos (transiciones válidas) para un ticket específico desde la API de Redmine. Consulta `GET /issues/{ticketId}.json?include=allowed_statuses`. Si Redmine no está configurado o falla la conexión, retorna arreglo vacío.
- **Respuesta 200:** `{ statuses: [{ id: 1, name: "New" }, { id: 2, name: "In Progress" }, ...] }`

### `GET /api/tickets/session/:sessionId`
- **Auth:** Requerida
- **Params:** `sessionId` — ID de la sesión de chat
- **Query:** `?comments=true` — opcional, incluye los comentarios desde la API de Redmine
- **Descripción:** Obtiene el `id_ticket_redmine` asignado a la sesión y, si existe, los datos completos del ticket desde la tabla `tickets` (JOIN por `redmine_id`). Si `?comments=true`, también consulta la API de Redmine (`/issues/:id.json?include=attachments,journals`) para obtener los comentarios y los adjuntos. Los attachments se devuelven siempre que el ticket tenga ID Redmine y la conexión esté configurada.
- **Respuesta 200 (con ticket):** `{ idTicketRedmine: 143, ticket: { id, proyecto_id, redmine_id, subject, description, status_name, priority_name, assigned_to_name, ... }, comments: [{ user, notes, created_on }] | null, attachments: [{ id, filename, content_type, content_url, description, filesize, created_on }] | null }`
- **Respuesta 200 (sin ticket):** `{ idTicketRedmine: null, ticket: null, comments: null, attachments: null }`

### `GET /api/tickets/attachments/by-ticket/:redmineId`
- **Auth:** Requerida
- **Params:** `redmineId` — ID numérico del ticket en Redmine
- **Descripción:** Obtiene los adjuntos de un ticket específico desde la API de Redmine. Consulta `GET /issues/{redmineId}.json?include=attachments`. Retorna arreglo vacío si Redmine no está configurado o falla la conexión.
- **Respuesta 200:** `{ attachments: [{ id, filename, content_type, content_url, description, filesize, created_on }] }`

### `GET /api/tickets/attachments/:attachmentId/download`
- **Auth:** Requerida
- **Params:** `attachmentId` — ID del adjunto en Redmine
- **Descripción:** Proxy de descarga de adjuntos. Obtiene el archivo desde `${redmineUrl}/attachments/download/{attachmentId}` usando la API key de Redmine y lo reenvía al cliente con el mismo `Content-Type` y `Content-Disposition`. Útil para mostrar imágenes inline y descargar archivos sin exponer la API key al frontend.
- **Respuesta:** Stream binario del archivo (imagen, PDF, etc.) con headers `Content-Type` y `Content-Disposition` originales de Redmine

### `POST /api/tickets/session`
- **Auth:** Requerida
- **Body:** `{ sessionId: number, idTicketRedmine: number }`
- **Descripción:** Asigna un ticket de Redmine a la sesión de chat. Si `idTicketRedmine` es `null` o se omite, limpia la asignación.
- **Respuesta 200:** `{ success: true }`
- **Respuesta 400:** `{ error: "sessionId es requerido" }`

### `PUT /api/tickets/session/:sessionId`
- **Auth:** Requerida
- **Params:** `sessionId` — ID de la sesión de chat
- **Body:** `{ subject?, description?, status_name?, priority_name?, assigned_to_name?, status_id?, priority_id?, assigned_to_id?, notes? }`
- **Descripción:** Actualiza los datos del ticket asignado a la sesión. Los campos `_name` se guardan en la base local. Los campos `_id` (status_id, priority_id, assigned_to_id) y `notes` se envían a Redmine vía `PUT /issues/:id.json`. Valida que `subject` no esté vacío si se envía.
- **Respuesta 200:** `{ success: true, ticket: { ...datos actualizados... } }`
- **Respuesta 400:** `{ error: "El asunto no puede estar vacío." }` o `{ error: "No hay ticket asignado a esta sesión." }`

---

## Espacios de Trabajo (`/api/workspaces`)

### `GET /api/workspaces`
- **Auth:** Requerida
- **Respuesta:** `{ workspaces: [{ id, name, color, created_at }] }`

### `POST /api/workspaces`
- **Auth:** Requerida
- **Body:** `{ name: string, color?: string }` — color en formato `#RRGGBB`, default `#75AADB`
- **Descripción:** Crea un workspace y copia las settings del workspace con id=1
- **Respuesta 201:** `{ success: true, workspace: { id, name, color, created_at } }`
- **Respuesta 400:** `{ error: "El nombre es requerido" }`

### `PUT /api/workspaces/:id`
- **Auth:** Requerida
- **Body:** `{ name: string, color?: string }` — color en formato `#RRGGBB`
- **Respuesta:** `{ success: true }`
- **Respuesta 400:** `{ error: "El nombre es requerido" }` o `{ error: "Color inválido. Use formato #RRGGBB" }`
- **Respuesta 404:** `{ error: "Workspace no encontrado" }`

### `DELETE /api/workspaces/:id`
- **Auth:** Requerida
- **Descripción:** Elimina el workspace y sus datos asociados en cascada (chat_sessions, proyectos, tickets, settings, environments).
- **Respuesta:** `{ success: true }`

### `POST /api/workspaces/stop-all`
- **Auth:** Requerida
- **Descripción:** Detiene servidores OpenCode y sesiones de navegador activas (sin cambiar de workspace)
- **Respuesta:** `{ success: true }`

### `POST /api/workspaces/select`
- **Auth:** Requerida
- **Body:** `{ workspaceIds: number[] }` — array con al menos un ID
- **Descripción:** Selecciona los workspaces activos. Detiene procesos si se deseleccionó alguno. Guarda array JSON en `user_settings`. Sin restricciones de selección.
- **Respuesta:** `{ success: true, workspaceIds }`
- **Respuesta 400:** `{ error: "workspaceIds debe ser un array no vacío" }` o si algún ID no existe

### `POST /api/workspaces/switch` (deprecado, usar `/select`)
- **Auth:** Requerida
- **Body:** `{ workspaceId: number }`
- **Descripción:** Compatibilidad hacia atrás. Agrega el workspaceId a la selección actual.
- **Respuesta:** `{ success: true, workspaceId, workspaceIds }`

---

## Ambientes (`/api/environments`)

### `GET /api/environments`
- **Auth:** Requerida
- **Workspace:** Filtra por `workspace_id IN (session.workspaceIds)`
- **Descripción:** Lista los ambientes de todos los workspaces seleccionados
- **Respuesta 200:** `{ environments: [{ id, name, branch, description, created_at, updated_at, workspace_id }] }`

### `POST /api/environments`
- **Auth:** Requerida
- **Body:** `{ name, branch, description?, workspace_id? }` — si no se envía `workspace_id`, usa el primary
- **Workspace:** Validado contra `session.workspaceIds`
- **Body:** `{ name: string, branch: string, description?: string }`
- **Descripción:** Crea un nuevo ambiente. El nombre y la rama son obligatorios. `(workspace_id, name)` debe ser único.
- **Respuesta 201:** `{ success: true, environment: { id, name, branch, description, ... } }`
- **Respuesta 400:** `{ error: "El nombre es requerido" }` o `{ error: "La rama es requerida" }`
- **Respuesta 409:** `{ error: 'Ya existe un ambiente con el nombre "..."' }`

### `PUT /api/environments/:id`
- **Auth:** Requerida
- **Body:** `{ name?: string, branch?: string, description?: string }`
- **Descripción:** Actualiza los campos de un ambiente existente. Al menos un campo debe enviarse.
- **Respuesta 200:** `{ success: true, environment: { id, name, branch, description, ... } }`
- **Respuesta 400:** `{ error: "El nombre no puede estar vacío" }` o `{ error: "La rama no puede estar vacía" }`
- **Respuesta 404:** `{ error: "Ambiente no encontrado" }`
- **Respuesta 409:** `{ error: 'Ya existe otro ambiente con el nombre "..."' }`

### `DELETE /api/environments/:id`
- **Auth:** Requerida
- **Descripción:** Elimina un ambiente permanentemente.
- **Respuesta 200:** `{ success: true }`
- **Respuesta 404:** `{ error: "Ambiente no encontrado" }`

---

## Plantillas (`/api/templates`)

### `GET /api/templates`
- **Auth:** Requerida
- **Descripción:** Lista todas las plantillas (id, slug, is_protected, created_at, updated_at) ordenadas por slug ascendente
- **Respuesta 200:** `[{ id, slug, is_protected, created_at, updated_at }]`

### `GET /api/templates/:slug`
- **Auth:** Requerida
- **Descripción:** Obtiene una plantilla completa por slug
- **Respuesta 200:** `{ id, slug, content, created_at, updated_at }`
- **Respuesta 404:** `{ error: "Plantilla no encontrada" }`

### `POST /api/templates`
- **Auth:** Requerida
- **Body:** `{ slug: string, content: string }`
- **Descripción:** Crea una nueva plantilla. El slug solo puede contener letras, números, guiones y guiones bajos. El contenido máximo es 10.000 caracteres.
- **Respuesta 201:** `{ success: true, id: number }`
- **Respuesta 400:** `{ error: "..." }` (slug requerido, slug inválido, contenido requerido, contenido excede 10KB)
- **Respuesta 409:** `{ error: "Ya existe una plantilla con ese slug" }`

### `PUT /api/templates/:slug`
- **Auth:** Requerida
- **Body:** `{ slug?: string, content?: string }`
- **Descripción:** Actualiza una plantilla existente. Se puede cambiar el slug y/o el contenido. Al menos un campo es requerido. Las plantillas protegidas (`is_protected=true`) no pueden modificarse.
- **Respuesta 200:** `{ success: true }`
- **Respuesta 400:** `{ error: "..." }` (slug inválido, contenido excede 10KB, sin campos)
- **Respuesta 403:** `{ error: "No se puede modificar una plantilla protegida del sistema" }`
- **Respuesta 404:** `{ error: "Plantilla no encontrada" }`
- **Respuesta 409:** `{ error: "Ya existe otra plantilla con ese slug" }`

### `DELETE /api/templates/:slug`
- **Auth:** Requerida
- **Descripción:** Elimina una plantilla por slug. Las plantillas protegidas (`is_protected=true`) no pueden eliminarse.
- **Respuesta 200:** `{ success: true }`
- **Respuesta 403:** `{ error: "No se puede eliminar una plantilla protegida del sistema" }`
- **Respuesta 404:** `{ error: "Plantilla no encontrada" }`

---

## Despliegue (`/api/despliegue`)

### `POST /api/despliegue/upd-config`
- **Auth:** Requerida
- **Body:** `{ sessionId: number, dir?: string }`
- **Descripción:** Lee el archivo `deploy.json` del directorio de trabajo de la sesión (campo `cwd` de `chat_sessions` o `dir` si se especifica) y guarda su contenido como JSON en la columna `despliegue_config` de la tabla `proyectos` para el proyecto vinculado a la sesión.
- **Respuesta 200:** `{ success: true, message: "Configuración de despliegue guardada correctamente." }`
- **Respuesta 400:** `{ success: false, error: "La sesión de chat no está vinculada a un proyecto. Use /chat_set_proyecto para seleccionar un proyecto." }`
- **Respuesta (cuando no existe deploy.json):** `{ success: false, code: "MISSING_DEPLOY_JSON", cwd: "<ruta>", error: "No se pudo obtener configuración de despliegue: falta el archivo \"deploy.json\". Se esperaba en: <ruta>" }`

### `POST /api/despliegue/crear-config`
- **Auth:** Requerida
- **Body:** `{ sessionId: number, dir?: string }`
- **Descripción:** Escanea el directorio del proyecto (o `dir` si se especifica) buscando subdirectorios con `package.json`, detecta automáticamente el tipo (`backend` si tiene `express` como dependencia, `frontend` si tiene `vue` o `vite`), genera `deploy.json` con las secciones `install`, `pm2` y `build`, y lo guarda en el proyecto.
- **Respuesta 200:** `{ success: true, message: "deploy.json creado en <ruta> con N subproyecto(s) detectado(s).", config: { install: [...], pm2: [...], build: [...] } }`
- **Respuesta 400:** `{ success: false, error: "..." }` (sin sesión, sin proyecto, sin package.json, directorio no existe)

### `POST /api/despliegue/save-config`
- **Auth:** Requerida
- **Body:** `{ sessionId: number, subprojects: [{ cwd: string, type: "backend"|"frontend" }], dir?: string }`
- **Descripción:** Crea el archivo `deploy.json` en el directorio de trabajo de la sesión (o en `dir` si se especifica) a partir de los subproyectos definidos en el formulario. Construye la estructura `{ install: [{cwd}], pm2: [{cwd}…], build: [{cwd}…] }` según el tipo de cada subproyecto y guarda la configuración en la columna `despliegue_config` del proyecto vinculado.
- **Respuesta 200:** `{ success: true, message: "Configuración de despliegue creada y guardada correctamente." }`
- **Respuesta 400:** `{ success: false, error: "..." }` (sin sesión, sin subproyectos, subproyecto inválido, sin proyecto vinculado)

### `GET /api/despliegue/config`
- **Auth:** Requerida
- **Query:** `sessionId` (number, requerido)
- **Descripción:** Obtiene la configuración de despliegue guardada para el proyecto vinculado a la sesión de chat.
- **Respuesta 200:** `{ success: true, config: <objeto JSON> }`
- **Respuesta 400:** `{ success: false, error: "La sesión de chat no está vinculada a un proyecto. Use /chat_set_proyecto para seleccionar un proyecto." }`
- **Respuesta 404:** `{ success: false, error: "No hay configuración de despliegue guardada. Use /despliegue_actualizar_config para cargarla." }`

### `POST /api/despliegue/iniciar-instancia-dev`
- **Auth:** Requerida
- **Body:** `{ sessionId: number }`
- **Descripción:** Lee la configuración de despliegue del proyecto vinculado a la sesión, identifica subproyectos desde `install[]` (backends por `pm2[]`, fronts por `build[]`), ejecuta `npm ci` en paralelo en cada uno y luego inicia los procesos de desarrollo: `npx nodemon` para backends, `npm run dev` para fronts. Los procesos quedan bajo gestión del servidor (órbita de control).
- **Respuesta 200:** `{ success: true, results: [{ name: string, type: "backend"|"frontend", status: "running"|"error", error?: string }] }`
- **Respuesta 400:** `{ success: false, error: "..." }` (sin proyecto, sin config de despliegue, etc.)

### `POST /api/despliegue/detener-instancia-dev`
- **Auth:** Requerida
- **Body:** ninguno
- **Descripción:** Detiene todos los procesos de desarrollo activos iniciados con `/despliegue_iniciar_instancia`.
- **Respuesta 200:** `{ success: true }`

### `GET /api/despliegue/estado-instancia-dev`
- **Auth:** Requerida
- **Descripción:** Devuelve el estado actual de cada proceso de desarrollo gestionado por el servidor.
- **Respuesta 200:** `{ success: true, processes: [{ name: string, type: "backend"|"frontend", status: "running"|"stopped"|"error" }] }`

### `GET /api/despliegue/logs`
- **Auth:** Requerida
- **Query:** `name` (string, requerido) — nombre del subproyecto (ej: `backend`, `admin_frontend`)
- **Descripción:** Devuelve el buffer de logs en tiempo real del proceso especificado (últimas 200 líneas).
- **Respuesta 200:** `{ success: true, name: string, logs: string[] }`
- **Respuesta 400:** `{ success: false, error: "Se requiere el parámetro name." }`

---

## Comandos Personalizados (`/api/comandos-personalizados`)

### `GET /api/comandos-personalizados/:proyectoId`
- **Auth:** Requerida
- **Params:** `proyectoId` — slug del proyecto
- **Descripción:** Lista todos los comandos personalizados de un proyecto, ordenados por label ascendente.
- **Respuesta 200:** `{ comandos: [{ id, label, descripcion, id_proyecto, comando, created_at, updated_at }] }`
- **Respuesta 404:** `{ error: "Proyecto no encontrado" }`

### `GET /api/comandos-personalizados/detail/:id`
- **Auth:** Requerida
- **Params:** `id` — ID del comando
- **Descripción:** Obtiene un comando personalizado por su ID.
- **Respuesta 200:** `{ comando: { id, label, descripcion, id_proyecto, comando, ... } }`
- **Respuesta 404:** `{ error: "Comando no encontrado" }`

### `POST /api/comandos-personalizados`
- **Auth:** Requerida
- **Body:** `{ label: string, descripcion?: string, id_proyecto: string, comando: string }`
- **Descripción:** Crea un nuevo comando personalizado. `comando` no puede exceder 512 caracteres.
- **Respuesta 201:** `{ comando: { id, label, descripcion, id_proyecto, comando, ... } }`
- **Respuesta 400:** `{ error: "label es requerido" }`, `{ error: "comando es requerido" }`, `{ error: "comando no puede exceder 512 caracteres" }`
- **Respuesta 404:** `{ error: "Proyecto no encontrado" }`

### `PUT /api/comandos-personalizados/:id`
- **Auth:** Requerida
- **Params:** `id` — ID del comando
- **Body:** `{ label: string, descripcion?: string, comando: string }`
- **Descripción:** Actualiza un comando personalizado existente. `comando` no puede exceder 512 caracteres.
- **Respuesta 200:** `{ comando: { id, label, descripcion, id_proyecto, comando, ... } }`
- **Respuesta 400:** `{ error: "label es requerido" }`, `{ error: "comando es requerido" }`
- **Respuesta 404:** `{ error: "Comando no encontrado" }` o `{ error: "Proyecto no encontrado" }`

### `DELETE /api/comandos-personalizados/:id`
- **Auth:** Requerida
- **Params:** `id` — ID del comando
- **Descripción:** Elimina un comando personalizado.
- **Respuesta 200:** `{ success: true }`
- **Respuesta 404:** `{ error: "Comando no encontrado" }`

### `POST /api/comandos-personalizados/:id/execute`
- **Auth:** Requerida
- **Body:** `{ sessionId?: number }`
- **Descripción:** Ejecuta el comando shell del registro via `/bin/sh -c` en el directorio de trabajo de la sesión (campo `cwd` de `chat_sessions`). Responde con SSE streaming.
- **Respuesta:** `text/event-stream`
  - `data: {"type":"stdout","content":"..."}` — salida estándar
  - `data: {"type":"stderr","content":"..."}` — salida de error
  - `data: {"type":"exit","code":0}` — proceso terminado
  - `data: {"type":"error","content":"..."}` — error de ejecución
  - `data: [DONE]` — fin del stream
- **Nota:** Si el cliente cierra la conexión, el proceso hijo recibe SIGTERM.

---

## Documentación — Notas (`api_documental`, puerto `4099`)

Endpoint base: `http://localhost:4099/api/documentacion`

### `GET /api/documentacion/notas/:proyectoId`
- **Auth:** No (servicio interno)
- **Path params:** `proyectoId` (string, requerido)
- **Descripción:** Lista todas las notas de documentación de un proyecto. Devuelve solo metadatos (id, clave, id_ticket, created_at, updated_at), sin el contenido.
- **Respuesta 200:** `[{ id, clave, id_ticket, created_at, updated_at }]`
- **Respuesta 400:** `{ error: "proyectoId requerido" }`

### `GET /api/documentacion/notas/:proyectoId/:clave`
- **Auth:** No (servicio interno)
- **Path params:** `proyectoId` (string), `clave` (string)
- **Descripción:** Obtiene una nota de documentación completa por su clave, incluyendo el contenido (`valor`).
- **Respuesta 200:** `{ id, id_proyecto, clave, valor, id_ticket, created_at, updated_at }`
- **Respuesta 404:** `{ error: "Nota no encontrada" }`

### `POST /api/documentacion/notas`
- **Auth:** No (servicio interno)
- **Body (JSON):**
  ```json
  {
    "id_proyecto": "PROY-001",
    "clave": "nombre_de_la_nota",
    "valor": "contenido de la nota (max 16384 caracteres)",
    "id_ticket": 1234
  }
  ```
- **Descripción:** Crea una nueva nota de documentación.
- **Campos requeridos:** `id_proyecto`, `clave`, `valor`
- **Campos opcionales:** `id_ticket` — si se omite, la nota se crea como documentación general (sin asociación a ticket)
- **Restricciones:** `valor` ≤ 16384 caracteres; la combinación `(id_proyecto, clave)` debe ser única.
- **Respuesta 201:** `{ id, id_proyecto, clave, valor, id_ticket, created_at, updated_at }`
- **Respuesta 400:** Error de validación (campo faltante, valor muy largo)
- **Respuesta 409:** `{ error: "Ya existe una nota con esa clave en el proyecto" }`

### `PUT /api/documentacion/notas/:id`
- **Auth:** No (servicio interno)
- **Path params:** `id` (number)
- **Body (JSON):**
  ```json
  {
    "clave": "nombre_de_la_nota",
    "valor": "contenido actualizado (max 16384 caracteres)",
    "id_ticket": 1234
  }
  ```
- **Descripción:** Actualiza una nota existente.
- **Campos requeridos:** `clave`, `valor`
- **Campos opcionales:** `id_ticket` — si se omite, la nota se marca como documentación general (id_ticket = null)
- **Restricciones:** `valor` ≤ 16384 caracteres; la combinación `(id_proyecto, clave)` debe ser única.
- **Respuesta 200:** `{ id, id_proyecto, clave, valor, id_ticket, created_at, updated_at }`
- **Respuesta 404:** `{ error: "Nota no encontrada" }`
- **Respuesta 409:** `{ error: "Ya existe una nota con esa clave en el proyecto" }`

### `DELETE /api/documentacion/notas/:id`
- **Auth:** No (servicio interno)
- **Path params:** `id` (number)
- **Descripción:** Elimina una nota de documentación.
- **Respuesta 200:** `{ success: true }`
- **Respuesta 404:** `{ error: "Nota no encontrada" }`

---

## Playwright Logs (`/api/playwright-logs`)

### `GET /api/playwright-logs/network`
- **Auth:** Requerida
- **Query:** `chat_session_id` (number, requerido)
- **Descripción:** Obtiene las últimas 500 peticiones de red (tipo `document`, `xhr`, `fetch`) registradas para la sesión de chat, ordenadas por fecha descendente.
- **Respuesta 200:** `[{ id, chat_session_id, playwright_session_id, method, url, status_code, request_headers, response_headers, resource_type, response_body, request_body, request_size, response_size, error, created_at }]`

### `GET /api/playwright-logs/console`
- **Auth:** Requerida
- **Query:**
  - `chat_session_id` (number, requerido)
  - `since` (string ISO datetime, opcional) — Filtra logs con `created_at > since`
  - `types` (string, opcional) — Filtra por tipo(s), separados por coma (ej: `error,warn`)
  - `limit` (number, opcional, default 500, max 500) — Número máximo de logs a devolver
- **Descripción:** Obtiene entradas de console log registradas para la sesión de chat, ordenadas por fecha descendente.
- **Respuesta 200:** `[{ id, chat_session_id, playwright_session_id, type, text, location, created_at }]`

### `GET /api/playwright-logs/console/stream`
- **Auth:** Requerida
- **Query:** `chat_session_id` (number, requerido)
- **Descripción:** Endpoint SSE (Server-Sent Events) que transmite en tiempo real los console errors/warnings del navegador Playwright a medida que ocurren. Envía keepalive `:ping` cada 30s.
- **Formato de eventos SSE:**
  - `data: {"type":"connected","chat_session_id":123}` — conexión establecida
  - `data: {"type":"console","chat_session_id":123,"console_type":"error","text":"...","location":"url:line:col"}` — nuevo evento de consola
- **Respuesta:** `text/event-stream`

### `POST /api/playwright-logs/console/notify`
- **Auth:** No (endpoint interno, llamado por el servicio Playwright)
- **Body:** `{ chat_session_id: number, type: string, text: string, location?: string|null }`
- **Descripción:** Endpoint interno que recibe notificaciones de eventos de consola desde el servicio Playwright y los reenvía a los clientes conectados vía SSE. No requiere autenticación de sesión.
- **Respuesta 200:** `{ success: true }`
- **Respuesta 400:** `{ error: "chat_session_id es requerido" }`

### `GET /api/playwright-logs/network/stream`
- **Auth:** Requerida
- **Query:** `chat_session_id` (number, requerido)
- **Descripción:** Endpoint SSE (Server-Sent Events) que transmite en tiempo real los errores de red (peticiones fallidas + respuestas 4xx/5xx) del navegador Playwright a medida que ocurren. Envía keepalive `:ping` cada 30s.
- **Formato de eventos SSE:**
  - `data: {"type":"connected","chat_session_id":123}` — conexión establecida
  - `data: {"type":"network_error","chat_session_id":123,"method":"GET","url":"https://...","status_code":404,"error":"Error del cliente (404)","resource_type":"fetch"}` — nuevo error de red
- **Respuesta:** `text/event-stream`

### `POST /api/playwright-logs/network/notify`
- **Auth:** No (endpoint interno, llamado por el servicio Playwright)
- **Body:** `{ chat_session_id: number, method: string, url: string, status_code: number|null, error: string, resource_type?: string|null }`
- **Descripción:** Endpoint interno que recibe notificaciones de errores de red desde el servicio Playwright y los reenvía a los clientes conectados vía SSE. No requiere autenticación de sesión.
- **Respuesta 200:** `{ success: true }`
- **Respuesta 400:** `{ error: "chat_session_id es requerido" }`

### `DELETE /api/playwright-logs/network`
- **Auth:** Requerida
- **Query:** `chat_session_id` (number, requerido)
- **Descripción:** Elimina todas las peticiones de red registradas para la sesión de chat.
- **Respuesta 200:** `{ success: true }`

### `DELETE /api/playwright-logs/console`
- **Auth:** Requerida
- **Query:** `chat_session_id` (number, requerido)
- **Descripción:** Elimina todos los console logs registrados para la sesión de chat.
- **Respuesta 200:** `{ success: true }`

### `GET /api/playwright-logs/events`
- **Auth:** Requerida
- **Query:** `chat_session_id?` (number, opcional), `recording_id?` (number|"none", opcional), `order?` ("asc"|"desc", opcional, default "desc")
- **Descripción:** Obtiene las últimas 500 entradas de eventos de usuario. Se puede filtrar por `chat_session_id` o `recording_id` (o `recording_id=none` para eventos no asignados). Por defecto ordena descendente; usar `order=asc` para orden ascendente (más antiguos primero).
- **Respuesta 200:** `[{ id, chat_session_id, recording_id, playwright_session_id, event_type, selector, tag_name, text_content, value, url, x, y, key, key_code, alt_key, ctrl_key, shift_key, meta_key, scroll_x, scroll_y, target_rect, metadata, created_at }]`

### `POST /api/playwright-logs/events`
- **Auth:** Requerida
- **Body:** `{ chat_session_id: number, recording_id?: number, event_type: string, selector?: string, tag_name?: string, text_content?: string, value?: string, url?: string, x?: number, y?: number, key?: string, key_code?: string, alt_key?: boolean, ctrl_key?: boolean, shift_key?: boolean, meta_key?: boolean, scroll_x?: number, scroll_y?: number, metadata?: string }`
- **Descripción:** Crea un evento personalizado (ej: tipo `query` para consultas de selector). Útil para agregar pasos de consulta a una grabación.
- **Respuesta 201:** `{ id, chat_session_id, recording_id, event_type, selector, value, ... }`
- **Respuesta 400:** `{ error: "chat_session_id es requerido" }` o `{ error: "event_type es requerido" }`

### `PATCH /api/playwright-logs/events/:id`
- **Auth:** Requerida
- **Params:** `id` (number) — ID del evento
- **Body:** `{ value?: string, text_content?: string, metadata?: string }`
- **Descripción:** Actualiza campos de un evento existente. Usado durante el replay para guardar el resultado de consultas `query` en el evento.
- **Respuesta 200:** Evento actualizado
- **Respuesta 404:** `{ error: "Evento no encontrado" }`

### `DELETE /api/playwright-logs/events`
- **Auth:** Requerida
- **Query:** `chat_session_id?` (number, opcional), `recording_id?` (number|"none", opcional)
- **Descripción:** Elimina eventos. Se puede filtrar por `chat_session_id` o `recording_id` (o `recording_id=none` para eventos no asignados).
- **Respuesta 200:** `{ success: true }`

### `POST /api/playwright-logs/event-recordings`
- **Auth:** Requerida
- **Body:** `{ name: string, chat_session_id: number, project_id?: string }`
- **Descripción:** Crea un registro de grabación de eventos. Si se especifica `project_id`, la grabación queda vinculada directamente al proyecto.
- **Respuesta 201:** `{ id: number, name: string, chat_session_id: number, project_id: string|null, event_count: number }`
- **Respuesta 400:** `{ error: "El nombre es requerido" }` o `{ error: "chat_session_id es requerido" }`

### `GET /api/playwright-logs/event-recordings`
- **Auth:** Requerida
- **Query:** `project_id?` (opcional), `chat_session_id?` (opcional)
- **Descripción:** Lista todas las grabaciones de eventos, filtradas opcionalmente por proyecto o sesión de chat. Cada grabación incluye su `event_count`. También retorna el `uncategorizedCount` de eventos sin grabación asignada.
- **Respuesta 200:** `{ recordings: Array<{ id, name, chat_session_id, project_id, event_count, created_at }>, uncategorizedCount: number }`

### `GET /api/playwright-logs/event-recordings/:id`
- **Auth:** Requerida
- **Params:** `id` (number, requerido)
- **Descripción:** Obtiene una grabación de eventos por su ID, incluyendo el conteo de eventos.
- **Respuesta 200:** `{ id, name, chat_session_id, project_id, event_count, created_at }`
- **Respuesta 404:** `{ error: "Grabación no encontrada" }`

### `PUT /api/playwright-logs/event-recordings/:id`
- **Auth:** Requerida
- **Params:** `id` (number, requerido)
- **Body:** `{ name?: string, project_id?: string }`
- **Descripción:** Actualiza el nombre y/o proyecto de una grabación.
- **Respuesta 200:** `{ id, name, chat_session_id, project_id, event_count, created_at }`
- **Respuesta 404:** `{ error: "Grabación no encontrada" }`

### `POST /api/playwright-logs/event-recordings/:id/clone`
- **Auth:** Requerida
- **Params:** `id` (number, requerido)
- **Descripción:** Clona una grabación existente, creando una copia con nombre "`original (copia)`" y duplicando todos sus eventos.
- **Respuesta 201:** `{ id, name, chat_session_id, project_id, event_count, created_at }`
- **Respuesta 404:** `{ error: "Grabación no encontrada" }`

### `DELETE /api/playwright-logs/event-recordings/:id`
- **Auth:** Requerida
- **Params:** `id` (number, requerido)
- **Descripción:** Elimina una grabación. Los eventos vinculados pasan a tener `recording_id = NULL` (ON DELETE SET NULL).
- **Respuesta 200:** `{ success: true }`
- **Respuesta 404:** `{ error: "Grabación no encontrada" }`

---

## Estado de Base de Datos (`/api/state`)

### `GET /api/state/export`
- **Auth:** Requerida
- **Descripción:** Exporta el estado completo de la base de datos (configuración, proyectos, tickets, plantillas, etc.) en un JSON estructurado. Los valores encriptados (`deepseek_key`, `redmine_token`) se devuelven en texto plano. Incluye las siguientes tablas:
  - `workspaces` — espacios de trabajo
  - `settings` — configuración por workspace
  - `workspace_environments` — ambientes por workspace
  - `proyectos` — proyectos importados
  - `project_variables` — variables por proyecto
  - `tickets` — tickets importados
  - `templates` — plantillas markdown
  - `user_settings` — preferencias de UI por usuario
  - `redmine_comentarios` — comentarios Redmine pendientes
  - `gastos_tokens_usados` — registros de gastos de tokens
- **Respuesta 200:**
```json
{
  "version": 1,
  "exported_at": "2026-06-24T12:00:00.000Z",
  "tables": {
    "workspaces": [],
    "settings": [],
    "workspace_environments": [],
    "proyectos": [],
    "project_variables": [],
    "tickets": [],
    "templates": [],
    "user_settings": [],
    "redmine_comentarios": [],
    "gastos_tokens_usados": []
  }
}
```

### `POST /api/state/import`
- **Auth:** Requerida
- **Body:** Misma estructura que `GET /api/state/export` (campo `tables`)
- **Descripción:** Reemplaza completamente los datos de las tablas incluidas con los del JSON importado. Usa `FOREIGN_KEY_CHECKS=0` para evitar pérdida de datos en tablas no incluidas. El workspace por defecto (id=1) está protegido contra eliminación. Las credenciales (`deepseek_key`, `redmine_token`) se re-encriptan automáticamente. Todo el proceso se ejecuta dentro de una transacción: si algo falla, se revierte completamente.
- **Respuesta 200:** `{ success: true }`
- **Respuesta 400:** `{ error: "tables es requerido" }`

---

## Skills (`/api/skills`)

Endpoints para gestionar skills del proyecto (archivos `.agents/skills/[name]/SKILL.md`).

### `GET /api/skills/list?cwd=...`
- **Auth:** Requerida
- **Descripción:** Lista todos los skills en el directorio `.agents/skills/` relativo a `cwd`. Cada skill es un subdirectorio que contiene un archivo `SKILL.md`.
- **Respuesta 200:**
```json
{
  "skills": [
    { "name": "mi-skill", "path": "/absoluto/a/.agents/skills/mi-skill/SKILL.md" }
  ]
}
```

### `POST /api/skills/create`
- **Auth:** Requerida
- **Body:** `{ name: "nombre-skill", cwd: "/ruta/del/proyecto" }`
- **Descripción:** Crea un nuevo skill: crea el directorio `.agents/skills/[name]/` y escribe un `SKILL.md` con contenido por defecto.
- **Respuesta 200:** `{ success: true, name: "nombre-skill", path: "/ruta/.../SKILL.md" }`
- **Respuesta 400:** `{ error: "El skill '...' ya existe" }`

---

## Notas

- Todas las rutas protegidas devuelven `401 { error: "Sesión no válida" }` si no hay sesión
- Los endpoints con `sessionId` opcional solo persisten en `chat_messages` cuando se proveen
- El streaming SSE se usa para respuestas de DeepSeek (chat) y OpenCode
- Los espacios de trabajo (workspaces) agrupan configuraciones, sesiones de chat, proyectos y tickets. El workspace_id se almacena en la sesión del usuario y se usa para filtrar datos en todos los endpoints relevantes.
