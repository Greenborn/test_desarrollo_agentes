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
| `title` | VARCHAR(255) | nullable |
| `cwd` | VARCHAR(500) | nullable — directorio de trabajo de la sesión |
| `proyecto_id` | VARCHAR(255) | nullable — FK lógica → `proyectos(id)` |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## 3. `chat_messages`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `session_id` | INTEGER UNSIGNED | NOT NULL, FK → `chat_sessions(id)` ON DELETE CASCADE |
| `role` | ENUM(`'user'`, `'assistant'`, `'command'`, `'result'`, `'opencode_info'`, `'opencode_result'`) | NOT NULL |
| `content` | TEXT | NOT NULL |
| `thinking` | TEXT | nullable — contenido del thinking de DeepSeek |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## 4. `settings`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `setting_key` | VARCHAR(100) | NOT NULL, UNIQUE |
| `setting_value` | TEXT | NOT NULL |
| `encrypted` | BOOLEAN | DEFAULT `false` |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

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
| `command` | VARCHAR(500) | NOT NULL |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## 7. `funcionalidades`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | INTEGER | PK, AUTO_INCREMENT |
| `session_id` | INTEGER UNSIGNED | NOT NULL, FK → `chat_sessions(id)` ON DELETE CASCADE, UNIQUE |
| `fecha_hora` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `etapa` | ENUM(`'RELEVAMIENTO'`, `'DISENIO'`, `'IMPLEMENTACION'`, `'TESTING'`) | DEFAULT `'RELEVAMIENTO'` |
| `parametros` | TEXT | nullable — JSON con contenido de las pestañas del wizard |
| `proyecto_id` | VARCHAR(255) | nullable — FK lógica → `proyectos(id)` |

---

## 8. `proyectos`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | VARCHAR(255) | PK (string, no auto-increment) |
| `descripcion` | VARCHAR(255) | NOT NULL |

---

## Relaciones (Foreign Keys)

| Origen | Columna | Destino | Columna | ON DELETE |
|---|---|---|---|---|
| `chat_sessions` | `user_id` | `users` | `id` | CASCADE |
| `chat_messages` | `session_id` | `chat_sessions` | `id` | CASCADE |
| `user_settings` | `user_id` | `users` | `id` | CASCADE |
| `command_history` | `user_id` | `users` | `id` | CASCADE |
| `funcionalidades` | `session_id` | `chat_sessions` | `id` | CASCADE |

---

## Diagrama de relaciones

```
users
 ├─ chat_sessions (user_id)
 │   ├─ chat_messages (session_id)
 │   └─ funcionalidades (session_id, 1:1)
 ├─ user_settings (user_id)
 └─ command_history (user_id)

proyectos
 └─ chat_sessions.proyecto_id (FK lógica)
 └─ funcionalidades.proyecto_id (FK lógica)
```
