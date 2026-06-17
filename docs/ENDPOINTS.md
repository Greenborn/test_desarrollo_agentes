# ENDPOINTS — API REST

Servidor Express principal en puerto `4000` (configurable vía `PORT` en `.env`).
Todas las rutas protegidas requieren sesión activa (cookie `connect.sid`).

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
- **Respuesta:** `{ sessions: [{ id, title, updated_at, cwd, proyecto_id, proyecto_descripcion }] }`

### `POST /api/chat/sessions`
- **Auth:** Requerida
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

### `DELETE /api/chat/sessions/:id`
- **Auth:** Requerida
- **Respuesta:** `{ success: true, sessionId }`

---

## Configuración (`/api/settings`)

### `GET /api/settings`
- **Auth:** Requerida
- **Respuesta:** `{ deepseek_key: string (mascarado), system_prompt: string|null }`

### `POST /api/settings`
- **Auth:** Requerida
- **Body:** `{ key: string, value: string }`
- Si `key === "deepseek_key"` se encripta con AES-256-CBC antes de almacenar
- **Respuesta:** `{ success: true }`

---

## Comandos del sistema (`/api/command`)

### `GET /api/command/list-directories`
- **Auth:** Requerida
- **Query:** `prefix` (default `/`), `cwd` (default `process.cwd()`)
- **Respuesta:** `{ directories: string[] }`

### `GET /api/command/setting/:key`
- **Auth:** Requerida
- **Respuesta:** `{ value: string|null }`

### `POST /api/command/setting`
- **Auth:** Requerida
- **Body:** `{ key: string, value: string }`
- **Respuesta:** `{ success: true }`

### `GET /api/command/history`
- **Auth:** Requerida
- **Respuesta:** `{ history: [{ command, created_at }] }` (últimos 50)

### `POST /api/command/history`
- **Auth:** Requerida
- **Body:** `{ command: string }`
- **Respuesta:** `{ success: true }`

### `POST /api/command/execute`
- **Auth:** Requerida
- **Body:** `{ command: string, sessionId?: number }`
- Comandos soportados: `/cd`, `/ls`, `/help`, `/history`
- Si `sessionId` existe, guarda `command`/`result` en `chat_messages`
- **Respuesta:** `{ success: boolean, result: string, command: string }`

---

## OpenCode (`/api/opencode`)

### `GET /api/opencode/start`
- **Auth:** Requerida
- **Respuesta:** `{ providers, defaultModels, savedProvider, savedModel, savedThinking, savedMode }`

### `POST /api/opencode/select`
- **Auth:** Requerida
- **Body:** `{ key: string, value: string }`
- Guarda en `user_settings` como `opencode_last_<key>`
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
- **Body:** `{ ocSessionId?: string, directory: string }`
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
- **Respuesta:** `{ proyectos: [{ id, descripcion }] }`

### `POST /api/proyecto`
- **Auth:** Requerida
- **Body:** `{ id: string, descripcion: string }`
- **Respuesta:** `{ success: true }`

### `GET /api/proyecto/session/:sessionId`
- **Auth:** Requerida
- **Respuesta:** `{ proyectoId: string|null }`

### `POST /api/proyecto/session`
- **Auth:** Requerida
- **Body:** `{ sessionId (req), proyectoId?: string|null }`
- **Respuesta:** `{ success: true }`

---

## Servicio Playwright (servidor separado, puerto `4098`)

### `GET /api/health`
- **Respuesta:** `{ status: "ok" }`

### `POST /api/command`
- **Body:** `{ comando: string, parametros?: object }`
- **Comandos:**
  | comando | parametros | Respuesta |
  |---|---|---|
  | `start` | `{ navegador: "chromium"|"firefox", headless?, url? }` | `{ id_session, headless, url }` |
  | `go_to_url` | `{ id_session?, url }` | `{ success: true, id_session }` |
  | `set_headless` | `{ headless: boolean\|"0"\|"1" }` | `{ success: true, reiniciado, id_session?, headless }` |
  | `close` | `{ id_session }` | `{ success: true }` |

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

---

## Notas

- Todas las rutas protegidas devuelven `401 { error: "Sesión no válida" }` si no hay sesión
- Los endpoints con `sessionId` opcional solo persisten en `chat_messages` cuando se provee
- El streaming SSE se usa para respuestas de DeepSeek (chat) y OpenCode
