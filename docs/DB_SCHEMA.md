# ESQUEMA DE BASE DE DATOS

Motor: **MariaDB** vía **Knex** (query builder).

---

## 1. `users`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `username` | VARCHAR(100) | NOT NULL, UNIQUE |
| `password_hash` | VARCHAR(255) | NOT NULL |
| `role` | ENUM(`'admin'`, `'user'`) | DEFAULT `'user'` |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## 2. `chat_sessions`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `user_id` | INTEGER UNSIGNED | NOT NULL, FK → `users(id)` ON DELETE CASCADE |
| `workspace_id` | INTEGER UNSIGNED | NOT NULL, DEFAULT `1` — FK lógica → `workspaces(id)` |
| `title` | VARCHAR(255) | nullable |
| `cwd` | VARCHAR(500) | nullable — directorio de trabajo de la sesión |
| `proyecto_id` | VARCHAR(255) | nullable — FK lógica → `proyectos(id)` |
| `id_ticket_redmine` | INTEGER | nullable — ID del issue en Redmine (FK lógica → `tickets(redmine_id)`) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## 3. `chat_messages`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `session_id` | INTEGER UNSIGNED | NOT NULL, FK → `chat_sessions(id)` ON DELETE CASCADE |
| `role` | ENUM(`'user'`, `'assistant'`, `'command'`, `'result'`, `'opencode_info'`, `'opencode_result'`, `'opencode_control'`, `'opencode_confirmed'`) | NOT NULL |
| `content` | LONGTEXT | NOT NULL |
| `thinking` | LONGTEXT | nullable — contenido del thinking de DeepSeek |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## 4. `workspaces`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `name` | VARCHAR(255) | NOT NULL |
| `color` | VARCHAR(7) | DEFAULT `'#75AADB'` — color identificatorio para badges |
| `is_default` | BOOLEAN | DEFAULT `false` (sin uso actual) |

**Seed:** `id=1, name='Por Defecto'`

---

## 5. `settings`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `workspace_id` | INTEGER UNSIGNED | NOT NULL, DEFAULT `1` — FK lógica → `workspaces(id)` |
| `setting_key` | VARCHAR(100) | NOT NULL |
| `setting_value` | TEXT | NOT NULL |
| `encrypted` | BOOLEAN | DEFAULT `false` |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**UNIQUE compuesto:** `(workspace_id, setting_key)` — cada workspace tiene su propio juego de settings.

**Keys del sistema:**
| Key | Default | Descripción |
|---|---|---|
| `deepseek_key` | `''` | API Key de DeepSeek (encriptada) |
| `redmine_token` | `''` | Token de Redmine (encriptado) |
| `redmine_url` | `''` | URL de Redmine |
| `system_prompt` | `'Eres un agente experto...'` | Prompt del agente de chat |
| `locale` | `'es_ES.UTF-8'` | Locale para el agente OpenCode (controla el idioma de las respuestas) |
| `omnifilter_debounce_ms` | `'2000'` | Tiempo de debounce del omnifiltro |
| `repo_acronimo` | `'TKT'` | Acrónimo para ramas Git |
| `ticket_descripcion_prompt` | *(default interno)* | Prompt para redactar descripción de tickets |
| `ticket_refinar_prompt` | *(default interno)* | Prompt para refinar descripción de tickets |
| `deteccion_funcionalidades_prompt` | *(default interno)* | Prompt para detección de funcionalidades con OpenCode |
| `code_file_extensions` | `.js,.jsx,.ts,.tsx,.vue,.py,.php,...` | Extensiones de archivos considerados código (separadas por coma) |
| `code_file_max_size_kb` | `100` | Tamaño máximo en KB para incluir archivos en el árbol de código |
| `documentacion_prompt_*` | *(default interno)* | Prompts de documentación por tipo |
| `screen_resolutions` | `[{ id, width, height }, ...]` | Array JSON de resoluciones de pantalla para Playwright. Configurable desde Settings. Default: 14 resoluciones comunes (desktop + mobile) |
| `request_response_max_size_kb` | `'100'` | Límite en KB del body de respuesta del comando `/peticion`. Si se excede, la respuesta se trunca (nunca se rechaza). Configurable desde Settings → Límite de respuesta — Peticiones HTTP |

---

## 5. `user_settings`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `user_id` | INTEGER UNSIGNED | NOT NULL, FK → `users(id)` ON DELETE CASCADE |
| `key` | VARCHAR(255) | NOT NULL |
| `value` | LONGTEXT | nullable |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**UNIQUE compuesto:** `(user_id, key)`

**Keys de layout (preferencias de UI por usuario):**
| Key | Ejemplo | Descripción |
|-----|---------|-------------|
| `sidebar_collapsed` | `'true'` / `'false'` | Sidebar izquierdo colapsado |
| `sidebar_width` | `'220'` | Ancho del sidebar izquierdo (px o %) |
| `panel_collapsed` | `'true'` / `'false'` | Panel inferior colapsado |
| `panel_height` | `'250'` | Alto del panel inferior (px o %) |
| `right_panel_collapsed` | `'true'` / `'false'` | Panel lateral derecho colapsado |
| `right_panel_width` | `'220'` | Ancho del panel derecho (px o %) |
| `sidebar_chat_tab` | `'chats'` / `'servicios'` | Pestaña activa del sidebar izquierdo |
| `sidebar_right_tab` | `'comentarios'` / `'archivos'` / `'variables'` / `'comandos'` / `'capturas'` | Pestaña activa del panel derecho |
| `dev_panel_tab` | `'instancias'` / `'repositorio'` / `'tickets'` / `'proyectos'` / `'console_logs'` / `'events'` / `'network_logs'` | Pestaña activa del panel inferior de desarrollo |

---

## 6. `command_history`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `user_id` | INTEGER UNSIGNED | NOT NULL, FK → `users(id)` ON DELETE CASCADE |
| `session_id` | INTEGER UNSIGNED | nullable, FK → `chat_sessions(id)` ON DELETE SET NULL |
| `command` | VARCHAR(500) | NOT NULL |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## 7. `funcionalidades`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `session_id` | INTEGER UNSIGNED | NOT NULL, FK → `chat_sessions(id)` ON DELETE CASCADE |
| `fecha_hora` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `etapa` | ENUM(`'RELEVAMIENTO'`, `'DISENIO'`, `'IMPLEMENTACION'`, `'TESTING'`) | DEFAULT `'RELEVAMIENTO'` |
| `parametros` | TEXT | nullable — JSON con contenido de las pestañas del wizard |
| `proyecto_id` | VARCHAR(255) | nullable — FK lógica → `proyectos(id)` |
| `nombre` | VARCHAR(255) | NOT NULL, DEFAULT `'Sin nombre'` — agregado en migración 015 |
| `url_redmine` | VARCHAR(255) | nullable — agregado en migración 015 |

---

## 8. `proyectos`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | VARCHAR(255) | PK (string, no auto-increment) — slug del nombre Redmine |
| `workspace_id` | INTEGER UNSIGNED | NOT NULL, DEFAULT `1` — FK lógica → `workspaces(id)` |
| `descripcion` | TEXT | NOT NULL — descripción completa desde Redmine |
| `redmine_id` | INTEGER | NOT NULL — ID numérico del proyecto en Redmine |
| `redmine_status` | INTEGER | nullable — 1=activo, 5=archivado, 9=cerrado |
| `redmine_created_on` | DATETIME | nullable — fecha creación en Redmine |
| `redmine_updated_on` | DATETIME | nullable — fecha actualización en Redmine |
| `redmine_parent_id` | VARCHAR(255) | nullable — ID del proyecto padre en Redmine |
| `redmine_parent_name` | VARCHAR(255) | nullable — nombre del proyecto padre |
| `url_github` | VARCHAR(500) | nullable — URL del repositorio GitHub |
| `despliegue_config` | TEXT | nullable — JSON con configuración de despliegue cargada desde `deploy.json` vía `/despliegue_actualizar_config` |

---

## 9. `gastos_tokens_usados`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `id_chat_session` | INTEGER UNSIGNED | NOT NULL, FK → `chat_sessions(id)` ON DELETE CASCADE |
| `id_proyecto` | VARCHAR(255) | NOT NULL, FK → `proyectos(id)` ON DELETE CASCADE |
| `precio` | DECIMAL(10,4) | NOT NULL |
| `tokens` | INTEGER | NOT NULL |
| `fecha_hora` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## 10. `templates`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `slug` | VARCHAR(100) | NOT NULL, UNIQUE |
| `content` | TEXT | NOT NULL |
| `is_protected` | BOOLEAN | NOT NULL, DEFAULT `false` |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**Seed `004_default_templates.js`:**
- `slug='commit-prompt', content=(prompt de commit), is_protected=true`

---

## 11. `redmine_comentarios`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `session_id` | INTEGER UNSIGNED | NOT NULL, FK → `chat_sessions(id)` ON DELETE CASCADE |
| `ticket_redmine_id` | INTEGER | NOT NULL — FK lógica → `tickets(redmine_id)` |
| `comentario` | TEXT | NOT NULL |
| `workspace_id` | INTEGER UNSIGNED | NOT NULL, DEFAULT `1` — FK lógica → `workspaces(id)` |
| `estado` | ENUM(`'pendiente'`, `'enviado'`, `'error'`) | DEFAULT `'pendiente'` |
| `tipo` | ENUM(`'comentario_commit'`, `'ticket_edit'`, `'ticket_comment'`) | NOT NULL, DEFAULT `'comentario_commit'` |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## 12. `project_variables`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `proyecto_id` | VARCHAR(255) | NOT NULL, FK → `proyectos(id)` ON DELETE CASCADE |
| `key` | VARCHAR(255) | NOT NULL — nombre de la variable |
| `value` | TEXT | NOT NULL, DEFAULT `''` |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**UNIQUE compuesto:** `(proyecto_id, key)` — cada variable se identifica por proyecto + nombre.

---

## 13. `tickets`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `workspace_id` | INTEGER UNSIGNED | NOT NULL, DEFAULT `1` — FK lógica → `workspaces(id)` |
| `proyecto_id` | VARCHAR(255) | NOT NULL, FK → `proyectos(id)` ON DELETE CASCADE |
| `redmine_id` | INTEGER | NOT NULL, UNIQUE — ID del issue en Redmine |
| `subject` | VARCHAR(500) | NOT NULL |
| `description` | LONGTEXT | nullable |
| `status_name` | VARCHAR(100) | nullable |
| `tracker_name` | VARCHAR(100) | nullable |
| `priority_id` | INTEGER | nullable — ID de prioridad de Redmine (1=baja, 2=normal, 3=alta, 4=urgente, 5=inmediata) |
| `priority_name` | VARCHAR(100) | nullable |
| `assigned_to_name` | VARCHAR(255) | nullable |
| `author_name` | VARCHAR(255) | nullable |
| `start_date` | DATE | nullable |
| `due_date` | DATE | nullable |
| `estimated_hours` | DECIMAL(10,2) | nullable |
| `done_ratio` | INTEGER | nullable |
| `fixed_version_name` | VARCHAR(255) | nullable |
| `redmine_created_on` | DATETIME | nullable — fecha creación en Redmine |
| `redmine_updated_on` | DATETIME | nullable — fecha actualización en Redmine |
| `redmine_closed_on` | DATETIME | nullable — fecha cierre en Redmine |

---

## 14. `workspace_environments`

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `workspace_id` | INTEGER UNSIGNED | NOT NULL, DEFAULT `1` — FK lógica → `workspaces(id)` |
| `name` | VARCHAR(100) | NOT NULL — nombre del ambiente (ej: DEV, TST, PRD) |
| `branch` | VARCHAR(255) | NOT NULL — rama Git asociada al ambiente |
| `description` | TEXT | nullable — descripción del ambiente |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**UNIQUE compuesto:** `(workspace_id, name)` — cada workspace tiene sus propios ambientes.

**Seed (`005_default_environments.js`):**
| name | branch | description |
|------|--------|-------------|
| DEV | DEV | Desarrollo |
| TST | TST | Testing |
| PRD | PRD | Producción |

---

## 15. `playwright_network_logs`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `chat_session_id` | INTEGER UNSIGNED | NOT NULL, FK → `chat_sessions(id)` ON DELETE CASCADE |
| `playwright_session_id` | VARCHAR(36) | NOT NULL — UUID de la sesión del navegador en Playwright |
| `method` | VARCHAR(10) | NOT NULL — GET, POST, etc. |
| `url` | TEXT | NOT NULL |
| `status_code` | INTEGER | nullable — código HTTP de respuesta |
| `request_headers` | TEXT | nullable — JSON con headers de la petición |
| `response_headers` | TEXT | nullable — JSON con headers de la respuesta |
| `resource_type` | VARCHAR(50) | nullable — `document`, `xhr`, `fetch` |
| `response_body` | TEXT | nullable — cuerpo de respuesta truncado a 10K chars |
| `request_body` | TEXT | nullable — cuerpo de la petición truncado a 8KB |
| `request_size` | INTEGER | nullable — tamaño en bytes del cuerpo de la petición |
| `response_size` | INTEGER | nullable — tamaño en bytes del cuerpo de la respuesta |
| `error` | TEXT | nullable — texto de error para peticiones fallidas |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## 16. `playwright_events`

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `chat_session_id` | INTEGER UNSIGNED | NOT NULL, FK → `chat_sessions(id)` ON DELETE CASCADE |
| `playwright_session_id` | VARCHAR(36) | NOT NULL — UUID de la sesión del navegador en Playwright |
| `event_type` | VARCHAR(50) | NOT NULL — `click`, `dblclick`, `input`, `change`, `submit`, `keydown`, `scroll`, `focus`, `blur` |
| `selector` | TEXT | nullable — selector CSS del elemento donde ocurrió el evento |
| `tag_name` | VARCHAR(50) | nullable — tag del elemento (`input`, `button`, `select`, etc.) |
| `text_content` | TEXT | nullable — texto del elemento (truncado a 1000 chars) |
| `value` | TEXT | nullable — valor del input/select/textarea (truncado a 1000 chars) |
| `url` | TEXT | nullable — URL de la página donde ocurrió el evento |
| `x` | INTEGER | nullable — coordenada X del click (pageX) |
| `y` | INTEGER | nullable — coordenada Y del click (pageY) |
| `key` | VARCHAR(50) | nullable — tecla presionada (event.key) |
| `key_code` | TEXT | nullable — código de tecla (event.code) |
| `alt_key` | BOOLEAN | nullable — tecla Alt presionada |
| `ctrl_key` | BOOLEAN | nullable — tecla Ctrl presionada |
| `shift_key` | BOOLEAN | nullable — tecla Shift presionada |
| `meta_key` | BOOLEAN | nullable — tecla Meta presionada |
| `scroll_x` | INTEGER | nullable — posición horizontal del scroll |
| `scroll_y` | INTEGER | nullable — posición vertical del scroll |
| `target_rect` | TEXT | nullable — JSON con `{ x, y, width, height }` del bounding rect del elemento |
| `metadata` | TEXT | nullable — JSON con datos extra del evento |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**Índices:** `chat_session_id`, `playwright_session_id`

---

## 17. `playwright_event_recordings`

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `chat_session_id` | INTEGER UNSIGNED | NOT NULL, FK → `chat_sessions(id)` ON DELETE CASCADE |
| `name` | VARCHAR(255) | NOT NULL, **UNIQUE** — nombre único global de la grabación |
| `playwright_session_id` | VARCHAR(36) | nullable — UUID de la sesión del navegador en Playwright |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## 18. `documentacion_escaneo`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `session_id` | INTEGER UNSIGNED | NOT NULL, FK → `chat_sessions(id)` ON DELETE CASCADE |
| `fecha_hora_inicio` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `fecha_hora_fin` | TIMESTAMP | nullable |
| `total_archivos` | INTEGER | nullable |
| `archivos_procesados` | INTEGER | nullable |

## 19. `documentacion_archivo`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `escaneo_id` | INTEGER UNSIGNED | NOT NULL, FK → `documentacion_escaneo(id)` ON DELETE CASCADE |
| `nombre` | VARCHAR(500) | NOT NULL |
| `ruta` | TEXT | NOT NULL |
| `tipo` | VARCHAR(50) | NOT NULL — `file` o `directory` |
| `extension` | VARCHAR(50) | nullable |
| `tamano` | INTEGER | nullable — tamaño en bytes |
| `descripcion` | TEXT | nullable — descripción generada por DeepSeek |

---

## 20. `comandos_personalizados_proyectos`

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `label` | VARCHAR(255) | NOT NULL — nombre visible del comando |
| `descripcion` | TEXT | nullable — descripción opcional |
| `id_proyecto` | VARCHAR(255) | NOT NULL — FK lógica → `proyectos(id)` |
| `comando` | VARCHAR(512) | NOT NULL — comando shell a ejecutar |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## 21. `archivos`

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `proyecto_id` | VARCHAR(255) | NOT NULL — FK lógica → `proyectos(id)` |
| `chat_session_id` | INTEGER UNSIGNED | NOT NULL, FK → `chat_sessions(id)` ON DELETE CASCADE |
| `nombre_original` | VARCHAR(500) | NOT NULL — nombre original del archivo subido/capturado |
| `nombre_storage` | VARCHAR(500) | NOT NULL — nombre único UUID en disco (`uploads/archivos/`) |
| `tipo` | VARCHAR(100) | NOT NULL — MIME type (`image/png`, etc.) |
| `tamano` | INTEGER | NOT NULL — tamaño en bytes |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## 22. `capturas_metadata`

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `archivo_id` | INTEGER UNSIGNED | NOT NULL, FK → `archivos(id)` ON DELETE CASCADE |
| `key` | VARCHAR(255) | NOT NULL |
| `value` | LONGTEXT | NOT NULL — texto o JSON |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

El `ON DELETE CASCADE` asegura que al eliminar una captura de la tabla `archivos`, se eliminen automáticamente todos sus registros de metadata.

**Keys conocidas:**

| Key | Value |
|-----|-------|
| `page_html` | `string` — HTML completo de la página al momento de la captura (`document.documentElement.outerHTML`) |
| `detected_inputs` | `JSON` — Arreglo de controles de formulario detectados (`input`, `select`, `textarea`, `button`) con sus propiedades, bounding boxes (viewport y documento), más metadatos del viewport. Ver [`docs/PLAYWRIGHT_API.md`](PLAYWRIGHT_API.md#43-extract_form_controls) para la estructura completa. |
| `quick_notes` | `JSON` — Arreglo de notas rápidas asociadas a la captura. Cada nota tiene `{ id, text, controlIndex (null si es general, o índice en detected_inputs.controls), createdAt }`. Se gestiona desde el modal de detalle de captura. |

---

## 23. `playwright_console_logs`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `chat_session_id` | INTEGER UNSIGNED | NOT NULL, FK → `chat_sessions(id)` ON DELETE CASCADE |
| `playwright_session_id` | VARCHAR(36) | NOT NULL — UUID de la sesión del navegador en Playwright |
| `type` | VARCHAR(20) | NOT NULL — `log`, `warn`, `error`, `info`, `debug` |
| `text` | TEXT | NOT NULL |
| `location` | TEXT | nullable — URL:línea:columna donde se ejecutó el console |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## Relaciones (Foreign Keys)

| Origen | Columna | Destino | Columna | ON DELETE |
|---|---|---|---|---|
| `chat_sessions` | `user_id` | `users` | `id` | CASCADE |
| `chat_messages` | `session_id` | `chat_sessions` | `id` | CASCADE |
| `user_settings` | `user_id` | `users` | `id` | CASCADE |
| `command_history` | `user_id` | `users` | `id` | CASCADE |
| `command_history` | `session_id` | `chat_sessions` | `id` | SET NULL |
| `funcionalidades` | `session_id` | `chat_sessions` | `id` | CASCADE |
| `gastos_tokens_usados` | `id_chat_session` | `chat_sessions` | `id` | CASCADE |
| `gastos_tokens_usados` | `id_proyecto` | `proyectos` | `id` | CASCADE |
| `tickets` | `proyecto_id` | `proyectos` | `id` | CASCADE |
| `project_variables` | `proyecto_id` | `proyectos` | `id` | CASCADE |
| `redmine_comentarios` | `session_id` | `chat_sessions` | `id` | CASCADE |
| `playwright_network_logs` | `chat_session_id` | `chat_sessions` | `id` | CASCADE |
| `playwright_events` | `chat_session_id` | `chat_sessions` | `id` | CASCADE |
| `playwright_console_logs` | `chat_session_id` | `chat_sessions` | `id` | CASCADE |
| `playwright_event_recordings` | `chat_session_id` | `chat_sessions` | `id` | CASCADE |
| `documentacion_escaneo` | `session_id` | `chat_sessions` | `id` | CASCADE |
| `comandos_personalizados_proyectos` | `id_proyecto` | `proyectos` | `id` | — (FK lógica) |
| `documentacion_archivo` | `escaneo_id` | `documentacion_escaneo` | `id` | CASCADE |
| `archivos` | `chat_session_id` | `chat_sessions` | `id` | CASCADE |
| `capturas_metadata` | `archivo_id` | `archivos` | `id` | CASCADE |

---

## Diagrama de relaciones

```
workspaces
 ├─ settings.workspace_id (FK lógica)
 ├─ chat_sessions.workspace_id (FK lógica)
 ├─ proyectos.workspace_id (FK lógica)
 ├─ tickets.workspace_id (FK lógica)
 ├─ redmine_comentarios.workspace_id (FK lógica)
 └─ workspace_environments.workspace_id (FK lógica)

users
 ├─ chat_sessions (user_id)
 │   ├─ chat_messages (session_id)
  │   └─ funcionalidades (session_id)
 ├─ user_settings (user_id)
 └─ command_history (user_id)

proyectos
 ├─ chat_sessions.proyecto_id (FK lógica)
 ├─ funcionalidades.proyecto_id (FK lógica)
 ├─ gastos_tokens_usados.id_proyecto (FK)
 ├─ tickets.proyecto_id (FK)
 └─ project_variables.proyecto_id (FK)

tickets
 └─ chat_sessions.id_ticket_redmine (FK lógica)

templates
 (tabla independiente, sin FK)

redmine_comentarios
 └─ chat_sessions.id (FK)

chat_sessions
 ├─ documentacion_escaneo.session_id (FK)
 ├─ gastos_tokens_usados.id_chat_session (FK)
 ├─ command_history.session_id (FK)
 └─ redmine_comentarios.session_id (FK)

documentacion_escaneo
 └─ documentacion_archivo.escaneo_id (FK)
```
