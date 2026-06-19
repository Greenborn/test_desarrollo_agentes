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
- **Workspace:** Filtra por `workspace_id` de la sesión
- **Respuesta:** `{ sessions: [{ id, title, updated_at, cwd, proyecto_id, proyecto_descripcion }] }`

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

### `DELETE /api/chat/sessions/:id`
- **Auth:** Requerida
- **Respuesta:** `{ success: true, sessionId }`

---

## Configuración (`/api/settings`)

### `GET /api/settings`
- **Auth:** Requerida
- **Workspace:** Filtra por `workspace_id` de la sesión
- **Respuesta:** `{ deepseek_key: string (mascarado), system_prompt: string|null, omnifilter_debounce_ms: string|null, screen_resolutions: [{ id: string, width: number, height: number }] }`

### `POST /api/settings`
- **Auth:** Requerida
- **Workspace:** Guarda con `workspace_id` de la sesión
- **Body:** `{ key: string, value: string }`
- Si `key === "deepseek_key"` se encripta con AES-256-CBC antes de almacenar
- Keys soportadas: `deepseek_key`, `redmine_token`, `redmine_url`, `system_prompt`, `documentacion_prompt_*`, `ticket_descripcion_prompt`, `omnifilter_debounce_ms`, `screen_resolutions`
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
- **Descripción:** Lista proyectos. El proyecto pineado (si existe) aparece primero.
- **Respuesta:** `{ proyectos: [{ id, descripcion }], pinnedProjectId: string|null }`

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

---

## Servicio Playwright (servidor separado, puerto `4098`)

### `GET /api/health`
- **Respuesta:** `{ status: "ok" }`

### `POST /api/command`
- **Body:** `{ comando: string, parametros?: object }`
- **Comandos:**
  | comando | parametros | Respuesta |
  |---|---|---|
  | `start` | `{ navegador: "chromium"|"firefox", headless?, url?, resolution?: { width, height } }` | `{ id_session, headless, url, resolution }` |
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
- **Respuesta:** `{ workspaces: [{ id, name, is_default, created_at }] }`

### `POST /api/workspaces`
- **Auth:** Requerida
- **Body:** `{ name: string }`
- **Descripción:** Crea un workspace y copia las settings del workspace por defecto (id=1)
- **Respuesta 201:** `{ success: true, workspace: { id, name, is_default, created_at } }`
- **Respuesta 400:** `{ error: "El nombre es requerido" }`

### `PUT /api/workspaces/:id`
- **Auth:** Requerida
- **Body:** `{ name: string }`
- **Respuesta:** `{ success: true }`
- **Respuesta 404:** `{ error: "Workspace no encontrado" }`

### `DELETE /api/workspaces/:id`
- **Auth:** Requerida
- **Descripción:** Elimina el workspace y sus datos asociados en cascada (chat_sessions, proyectos, tickets, settings). Rechaza si es el workspace por defecto.
- **Respuesta:** `{ success: true }`
- **Respuesta 400:** `{ error: "No se puede eliminar el workspace por defecto" }`

### `POST /api/workspaces/stop-all`
- **Auth:** Requerida
- **Descripción:** Detiene servidores OpenCode y sesiones de navegador activas (sin cambiar de workspace)
- **Respuesta:** `{ success: true }`

### `POST /api/workspaces/switch`
- **Auth:** Requerida
- **Body:** `{ workspaceId: number }`
- **Descripción:** Detiene procesos activos, cambia `workspaceId` en la sesión HTTP
- **Respuesta:** `{ success: true, workspaceId }`
- **Respuesta 400:** `{ error: "workspaceId es requerido" }` o `{ error: "Workspace no encontrado" }`

---

## Despliegue (`/api/despliegue`)

### `POST /api/despliegue/upd-config`
- **Auth:** Requerida
- **Body:** `{ sessionId: number }`
- **Descripción:** Lee el archivo `deploy.json` del directorio de trabajo de la sesión (campo `cwd` de `chat_sessions`) y guarda su contenido como JSON en la columna `despliegue_config` de la tabla `proyectos` para el proyecto vinculado a la sesión.
- **Respuesta 200:** `{ success: true, message: "Configuración de despliegue guardada correctamente." }`
- **Respuesta 400:** `{ success: false, error: "La sesión de chat no está vinculada a un proyecto. Use /chat_set_proyecto para seleccionar un proyecto." }`
- **Respuesta 404:** `{ success: false, error: "No se pudo obtener configuración de despliegue: falta el archivo \"deploy.json\". Se esperaba en: <ruta>" }`

### `GET /api/despliegue/config`
- **Auth:** Requerida
- **Query:** `sessionId` (number, requerido)
- **Descripción:** Obtiene la configuración de despliegue guardada para el proyecto vinculado a la sesión de chat.
- **Respuesta 200:** `{ success: true, config: <objeto JSON> }`
- **Respuesta 400:** `{ success: false, error: "La sesión de chat no está vinculada a un proyecto. Use /chat_set_proyecto para seleccionar un proyecto." }`
- **Respuesta 404:** `{ success: false, error: "No hay configuración de despliegue guardada. Use /despliegue_upd_config para cargarla." }`

### `POST /api/despliegue/iniciar-instancia-dev`
- **Auth:** Requerida
- **Body:** `{ sessionId: number }`
- **Descripción:** Lee la configuración de despliegue del proyecto vinculado a la sesión, identifica subproyectos desde `install[]` (backends por `pm2[]`, fronts por `build[]`), ejecuta `npm ci` en paralelo en cada uno y luego inicia los procesos de desarrollo: `npx nodemon` para backends, `npm run dev` para fronts. Los procesos quedan bajo gestión del servidor (órbita de control).
- **Respuesta 200:** `{ success: true, results: [{ name: string, type: "backend"|"frontend", status: "running"|"error", error?: string }] }`
- **Respuesta 400:** `{ success: false, error: "..." }` (sin proyecto, sin config de despliegue, etc.)

### `POST /api/despliegue/detener-instancia-dev`
- **Auth:** Requerida
- **Body:** ninguno
- **Descripción:** Detiene todos los procesos de desarrollo activos iniciados con `/iniciar_instancia_dev`.
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

## Notas

- Todas las rutas protegidas devuelven `401 { error: "Sesión no válida" }` si no hay sesión
- Los endpoints con `sessionId` opcional solo persisten en `chat_messages` cuando se provee
- El streaming SSE se usa para respuestas de DeepSeek (chat) y OpenCode
- Los espacios de trabajo (workspaces) agrupan configuraciones, sesiones de chat, proyectos y tickets. El workspace_id se almacena en la sesión del usuario y se usa para filtrar datos en todos los endpoints relevantes.
