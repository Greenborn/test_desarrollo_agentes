# Especificación Técnica — Agent Orchestrator

## 1. Visión del proyecto

Orquestador de agentes IA. En su fase inicial, ofrece un chat con un agente de programación basado en DeepSeek. En fases futuras permitirá orquestar agentes a través de la API de OpenCode.

## 2. Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Backend | Node.js + Express | 21+ / 4.21+ |
| Base de datos | MariaDB | 10+ |
| Query builder | Knex | 3+ |
| Driver BD | mysql2 | 3+ |
| Frontend | Vue 3 + Vite | 3.5+ / 6+ |
| Estilos | Bootstrap | 5.3+ |
| Comunicación | Socket.IO | 4.8+ |
| Autenticación | express-session (cookies) | — |
| Chat IA | DeepSeek API (streaming) | — |
| Encriptación | crypto (AES-256-CBC) | nativo Node |
| **Prohibido** | TypeScript | — |

## 3. Arquitectura

```
[Cliente Vue SPA] ←→ Socket.IO ←→ [Express Server]
                                       │
                                  [Socket Handlers]
                                       │
                            ┌──────────┼──────────┐
                            │          │          │
                       [Auth]     [Chat]    [Settings]
                            │          │
                       [MariaDB]  [DeepSeek API]
```

- Frontend SPA se comunica **exclusivamente** por Socket.IO (sin HTTP REST)
- Express sirve como base HTTP para montar Socket.IO y servir estáticos en producción
- Sesiones manejadas con cookies vía express-session
- Socket.IO middleware verifica sesión en cada conexión

## 4. Estructura del proyecto

```
/
├── AGENTS.md
├── docs/
│   └── ESPECIFICACION_TECNICA.md
├── .gitignore
├── backend/
│   ├── .env                     # Variables de entorno
│   ├── package.json
│   ├── knexfile.js              # Configuración Knex
│   ├── scripts/
│   │   └── setup-db.js          # Crea DB + usuario en MariaDB
│   ├── migrations/              # Migraciones Knex
│   │   ├── 001_create_users.js
│   │   ├── 002_create_chat_sessions.js
│   │   ├── 003_create_chat_messages.js
│   │   └── 004_create_settings.js
│   ├── seeds/
│   │   └── 001_admin_user.js    # Seed admin/admin
│   └── src/
│       ├── index.js             # Entrypoint Express + Socket.IO
│       ├── config/
│       │   └── db.js            # Instancia Knex
│       ├── socketHandlers/
│       │   ├── auth.js          # login, logout, me
│       │   ├── chat.js          # sesiones, mensajes, streaming
│       │   └── settings.js      # get/set API keys y prompt
│       ├── services/
│       │   ├── crypto.js        # Encriptación AES-256-CBC
│       │   └── deepseek.js      # Cliente DeepSeek API (streaming)
│       └── middlewares/
│           └── sessionAuth.js   # express-session + middleware socket
├── frontend/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js           # Proxy /socket.io → backend
│   └── src/
│       ├── main.js              # Entrypoint Vue + Bootstrap
│       ├── App.vue              # Componente raíz
│       ├── router/
│       │   └── index.js         # Rutas con guard de sesión
│       ├── stores/
│       │   ├── auth.js          # Pinia store de autenticación
│       │   ├── chat.js          # Pinia store de chat
│       │   └── settings.js      # Pinia store de configuración
│       ├── views/
│       │   ├── LoginView.vue    # Formulario login
│       │   ├── DashboardView.vue # Layout sidebar + chat
│       │   └── SettingsView.vue # API key + system prompt
│       ├── components/
│       │   ├── Topbar.vue       # Barra superior con dropdown
│       │   ├── SidebarChat.vue  # Lista de sesiones
│       │   ├── ChatWindow.vue   # Ventana de chat + input
│       │   └── ChatMessage.vue  # Burbuja con thinking + response
│       └── composables/
│           └── useSocket.js     # Singleton Socket.IO cliente
```

## 5. Base de datos

### Modelo relacional

```sql
-- Usuarios del sistema
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','user') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sesiones de conversación
CREATE TABLE chat_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Mensajes individuales
CREATE TABLE chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  role ENUM('user','assistant') NOT NULL,
  content TEXT NOT NULL,
  thinking TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- Configuración (API keys, prompts)
CREATE TABLE settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  encrypted BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Seed inicial

- Usuario `admin` con contraseña `admin` (hash bcrypt, rol admin)
- La tabla `settings` se llena desde la interfaz (sin valores por defecto)

## 6. Backend — Socket.IO

### Eventos

| Evento | Dirección | Descripción |
|---|---|---|
| `auth:me` | S → C | Estado de sesión actual (user o null) |
| `auth:login` | C → S | Iniciar sesión |
| `auth:login_res` | S → C | Resultado del login |
| `auth:logout` | C → S | Cerrar sesión |
| `chat:sessions` | C → S | Listar sesiones del usuario |
| `chat:sessions_res` | S → C | Lista de sesiones ordenadas por updated_at DESC |
| `chat:create` | C → S | Crear nueva sesión |
| `chat:create_res` | S → C | Sesión creada |
| `chat:load` | C → S | Cargar mensajes de una sesión |
| `chat:load_res` | S → C | Mensajes de la sesión |
| `chat:send` | C → S | Enviar mensaje a DeepSeek |
| `chat:chunk` | S → C | Fragmento de thinking o response (streaming) |
| `chat:done` | S → C | Streaming completado |
| `chat:delete` | C → S | Eliminar sesión |
| `chat:delete_res` | S → C | Confirmación de borrado |
| `settings:get` | C → S | Obtener configuración actual |
| `settings:get_res` | S → C | Keys (enmascaradas) y prompt |
| `settings:set` | C → S | Guardar key o prompt |
| `settings:set_res` | S → C | Confirmación |

### Servicio DeepSeek

- Usa la API de DeepSeek con streaming (`stream: true`)
- Lee `deepseek_key` desde `settings` (desencriptada en runtime)
- Lee `system_prompt` desde `settings`
- Emite chunks de tipo `thinking` (razonamiento interno) y `response` (respuesta visible)
- Guarda mensaje completo (incluyendo thinking) en BD al terminar el stream

### Encriptación

- API keys se encriptan con AES-256-CBC antes de guardar en `settings`
- Clave de encriptación desde `ENCRYPTION_KEY` en `.env` (64 caracteres hex = 32 bytes)
- Formato almacenado: `iv_hex:encrypted_hex`

## 7. Frontend — Vue 3

### Layout

```
+----------------------------------------------------------+
| Topbar: Logo                    [👤 admin ▼]             |
|                                    ┌─────────────┐       |
|                                    │ Configuración│      |
|                                    │ ─────────── │       |
|                                    │ Cerrar sesión│      |
|                                    └─────────────┘       |
+--------------------+--------------------------------------+
| SIDEBAR            |  CHAT WINDOW                        |
| [＋ Nuevo chat]    |                                      |
|                   |  ┌──────────────────────────────────┐ |
| ───────────       |  │ [Thinking colapsable]           │ |
| 📄 Hoy 15:30  ←  |  │ [Response streaming]            │ |
| 📄 Hoy 14:15      |  │                                  │ |
| 📄 12/06 09:00    |  └──────────────────────────────────┘ |
|                   |  ┌────────────────┐ ┌────────┐       |
|                   |  │ Escribe aquí...│ │ Enviar │       |
|                   |  └────────────────┘ └────────┘       |
+--------------------+--------------------------------------+
```

### Vistas

1. **Login** (`/`) — formulario usuario/contraseña, redirige a dashboard si hay sesión
2. **Dashboard** (`/dashboard`) — sidebar con historial de sesiones + ventana de chat
3. **Settings** (`/settings`) — formulario para API Key DeepSeek y system prompt del agente

### Stores (Pinia)

- **auth:** estado del usuario, login/logout, escucha `auth:me`
- **chat:** sesiones, mensajes, streaming (thinking + response), CRUD de sesiones
- **settings:** keys enmascaradas, prompt, guardado

### Router

- Guard de navegación: verifica `auth.user` antes de rutas protegidas
- Redirección automática a login si no hay sesión

## 8. Configuración de entorno

### `backend/.env`

```
PORT=4000
SESSION_SECRET=cambiar_en_produccion

DB_HOST=localhost
DB_PORT=3306
DB_USER=agent_orchestrator
DB_PASSWORD=agent_orchestrator
DB_NAME=agent_orchestrator

ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

### `frontend/.env`

```
VITE_BACKEND_URL=http://localhost:4000
```

## 9. Comandos de desarrollo

### Backend

```bash
cd backend
npm run setup-db        # Crear DB + usuario (requiere MariaDB corriendo, ejecutar con sudo)
npm run migrate         # Ejecutar migraciones
npm run seed            # Seed admin/admin
npm run dev             # Servidor con --watch (puerto 4000)
npm run dev:all         # Inicia backend + frontend juntos (concurrently)
```

### Frontend

```bash
cd frontend
npm run dev             # Servidor Vite (puerto 5173)
npm run build           # Build producción
```

### Orden inicial obligatorio

```
sudo setup-db → migrate → seed → dev (backend) → dev (frontend)
```

O con un solo comando (desde `backend/`):

```
npm run dev:all
```

## 10. Convenciones

- **No TypeScript** — todo el código en JavaScript puro
- **No PrimeVue** — solo Bootstrap 5 como framework de estilos
- **Migraciones Knex** — no raw SQL ni otros ORM
- **Comunicación Socket.IO** — cero llamadas HTTP entre frontend y backend
- **API keys encriptadas** en BD, desencriptadas solo al usar
- **Streaming** — thinking y response se emiten chunk por chunk
- **Historial ordenado** por `updated_at DESC`, sesión activa resaltada

## 11. Fases futuras (no implementadas)

- Gestión de usuarios CRUD (pantalla `/users`)
- Integración con OpenCode API para orquestar agentes externos
- Historial de tareas de agentes
- Sidebar ampliada con secciones adicionales

## 12. Testing

(Pendiente de definir)
