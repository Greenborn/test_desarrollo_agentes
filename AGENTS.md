# AGENTS.md — test_desarrollo_agentes

## Fuente de verdad del proyecto

- `docs/ESPECIFICACION_TECNICA.md` — especificación general del backend/frontend
- `docs/PLAYWRIGHT_API.md` — documentación del servicio Playwright (API, comandos, instalación)
- `docs/COMANDOS.md` — documentación de todos los comandos del chat
- `docs/ENDPOINTS.md` — documentación de todos los endpoints HTTP
- `docs/DB_SCHEMA.md` — esquema completo de la base de datos

Todos deben mantenerse actualizados con cada cambio significativo.

## Stack

- **Backend:** Node.js + Express + Knex + mysql2 + MariaDB — JavaScript puro (NO TypeScript)
- **Frontend:** Vue 3 + Vite + Bootstrap 5 — JavaScript puro (NO TypeScript)
- **Comunicación:** HTTP REST + SSE streaming (no WebSockets)
- **Autenticación:** Sesiones con cookies (express-session)
- **Agente chat:** DeepSeek API con streaming (thinking + respuesta en vivo)
- **Encriptación:** AES-256-CBC con clave desde `.env`

## Convenciones

- **Prohibido TypeScript** en cualquier parte del proyecto
- Migraciones y seeds con Knex (no raw SQL ni otros ORM)
- Variables de entorno desde `backend/.env`
- Script `backend/scripts/setup-db.js` para crear DB y usuario en MariaDB
- API keys encriptadas antes de guardar en tabla `settings`
- Comunicaciones frontend ↔ backend vía HTTP REST con `credentials: 'include'`
- Streaming de chat vía Server-Sent Events sobre HTTP POST
- **Prohibido `||` como fallback de parámetros:** si un argumento es requerido, validarlo explícitamente y devolver error si falta. No usar valores por defecto silenciosos.
- **Prohibido `catch {}` vacío o `catch { /* silencio */ }`:** todo error debe registrarse con `console.error` (frontend) o `console.log` (backend) como mínimo. El silencio absoluto solo se permite en casos excepcionales documentados con comentario.
- **Prohibido ocultar errores en consola:** nunca silenciar un error sin registrarlo. Si un error es esperado y manejado, documentar por qué.
- **Sistema de comandos extensible:** usar `useCommandRegistry.js` para registrar comandos via `register({ name, category, description, usage, execute })`. No agregar nuevos comandos fuera del registry.
- **Espacios de trabajo (workspaces):** tabla `workspaces` con id y name. El workspace por defecto (id=1, "Por Defecto") es inmutable. El `workspace_id` seleccionado se guarda en la sesión (`req.session.workspaceId`). Settings, chat_sessions, proyectos y tickets se filtran por workspace. Al cambiar de workspace se detienen procesos OpenCode y navegador.

## Estructura

```
/
├── backend/               # Express + Knex
│   ├── migrations/        # Migraciones Knex
│   ├── seeds/             # Seeds Knex (admin/admin)
│   ├── scripts/           # setup-db.js
│   └── src/
│       ├── index.js       # Entrypoint (Express)
│       ├── config/db.js   # Conexión Knex
│       ├── routes/        # auth.routes.js, chat.routes.js, settings.routes.js, workspaces.routes.js
│       ├── services/      # crypto.js, deepseek.js, redmine.js
│       └── middlewares/   # sessionAuth.js
├── frontend/              # Vue 3 + Vite + Bootstrap
│   └── src/
│       ├── main.js
│       ├── router/         # Vue Router con guard de sesión
│       ├── stores/         # Pinia (auth, chat, settings, workspace)
│       ├── views/          # Login, Dashboard, Settings
│       └── components/     # Topbar, SidebarChat, ChatWindow, ChatMessage
├── api_gastos/            # Servicio de registro de gastos de tokens
│   └── src/
│       ├── index.js       # Entrypoint (Express)
│       └── routes/        # gastos.routes.js
├── playwright/            # Servicio Playwright (Express wrapper)
│   └── src/
│       ├── index.js       # Entrypoint (Express)
│       ├── routes/        # command.routes.js
│       └── services/      # browserManager.js
├── docs/
│   ├── ESPECIFICACION_TECNICA.md
│   ├── PLAYWRIGHT_API.md
│   ├── COMANDOS.md
│   ├── ENDPOINTS.md
│   └── DB_SCHEMA.md
└── AGENTS.md
```

## Comandos de desarrollo

### Backend (`backend/`)

```bash
sudo npm run setup-db     # Crear DB y usuario (requiere sudo para mysql root)
npm run migrate           # Ejecutar migraciones
npm run seed              # Ejecutar seeds (admin/admin)
npm run dev               # Iniciar servidor con --watch (puerto 4000)
npm start                 # Iniciar servidor en producción
npm run dev:all           # Inicia backend + frontend juntos
```

Orden inicial obligatorio: `sudo setup-db → migrate → seed → dev`

### Frontend (`frontend/`)

```bash
npm run dev               # Servidor de desarrollo Vite (puerto 5173)
npm run build             # Build producción
```

### API Gastos (`api_gastos/`)

```bash
npm run dev               # Iniciar servidor con --watch (puerto 4100)
npm start                 # Iniciar servidor en producción
```

### Playwright (`playwright/`)

```bash
npm run setup             # npm install + instalar navegadores chromium y firefox
npm run dev               # Iniciar servidor con --watch (puerto 4098)
npm start                 # Iniciar servidor en producción
```

## Testing

(Pendiente de definir — no hay tests en este momento)
