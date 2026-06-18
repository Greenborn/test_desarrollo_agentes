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
| `role` | ENUM(`'user'`, `'assistant'`, `'command'`, `'result'`, `'opencode_info'`, `'opencode_result'`, `'opencode_control'`) | NOT NULL |
| `content` | TEXT | NOT NULL |
| `thinking` | TEXT | nullable — contenido del thinking de DeepSeek |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## 4. `workspaces`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `name` | VARCHAR(255) | NOT NULL |
| `is_default` | BOOLEAN | DEFAULT `false` |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**Seed:** `id=1, name='Por Defecto', is_default=true`

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
| `documentacion_prompt_*` | *(default interno)* | Prompts de documentación por tipo |

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

## 10. `tickets`

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

---

## Diagrama de relaciones

```
workspaces
 ├─ settings.workspace_id (FK lógica)
 ├─ chat_sessions.workspace_id (FK lógica)
 ├─ proyectos.workspace_id (FK lógica)
 └─ tickets.workspace_id (FK lógica)

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
 └─ tickets.proyecto_id (FK)

tickets
 └─ chat_sessions.id_ticket_redmine (FK lógica)

chat_sessions
 ├─ gastos_tokens_usados.id_chat_session (FK)
 └─ command_history.session_id (FK)
```
