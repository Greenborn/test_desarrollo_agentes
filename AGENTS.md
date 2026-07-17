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
- **Comunicación:** HTTP REST + SSE streaming + WebSocket (api_memoria vía ws)
- **Autenticación:** Sesiones con cookies (api_memoria — sesiones almacenadas en servicio de memoria centralizado)
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
- **Módulos auto-registrables:** seguir el sistema descrito en `frontend/src/modules/` y `backend/src/modules/`. Ver sección "Sistema de Módulos" más abajo.
- **Espacios de trabajo (workspaces):** tabla `workspaces` con id y name. La selección activa se guarda como array en la sesión (`req.session.workspaceIds`). Settings, chat_sessions, proyectos y tickets se filtran por los workspaces seleccionados (IN). Al cambiar/seleccionar workspaces se detienen procesos OpenCode y navegador si se deseleccionó alguno.
- **Prohibido `alert()` en el frontend:** toda notificación al usuario debe mostrarse mediante el sistema de modales personalizado (`AppModal.vue` + `stores/modal.js`). Usar `AlertModal.vue` para notificaciones simples de una línea. Cualquier `alert()` existente debe reemplazarse por un modal apropiado.

## Estructura

```
/
├── backend/               # Express + Knex (iniciado por api_gestor_servicios)
│   ├── migrations/        # Migraciones Knex
│   ├── seeds/             # Seeds Knex (admin/admin)
│   ├── scripts/           # setup-db.js
│   └── src/
│       ├── index.js       # Express (puerto 4000)
│       ├── config/db.js   # Conexión Knex
│       ├── routes/        # 25 rutas (auth, chat, settings, workspaces, command, opencode, navegador,
│       │                  #   funcionalidad, proyecto, documentacion, gastos, redmine, tickets, despliegue,
│       │                  #   templates, environments, playwrightLogs, state, gestor, comandosPersonalizados,
│       │                  #   proxy, archivos, db, procesos, playwright)
│       ├── services/      # crypto, deepseek, devInstanceManager, frontendWsServer, gestorClient,
│       │                  #   memoriaClient, opencode, playwrightManager, portDetector, redmine
│       └── middlewares/   # memoriaSession.js
├── frontend/              # Vue 3 + Vite + Bootstrap
│   └── src/
│       ├── main.js
│       ├── router/         # Vue Router con guard de sesión
│       ├── stores/         # Pinia (auth, chat, settings, workspace)
│       ├── views/          # Login, Dashboard, Settings
│       └── components/     # Topbar, SidebarChat, ChatWindow, ChatMessage
├── api_gestor_servicios/  # Punto de entrada — orquestador de servicios (spawn + keepalive)
│   └── src/
│       ├── index.js       # Entrypoint (Express, puerto 4250)
│       └── routes/        # gestor.routes.js
├── api_gastos/            # Servicio de registro de gastos de tokens
│   └── src/
│       ├── index.js       # Entrypoint (Express)
│       └── routes/        # gastos.routes.js
├── api_memoria/           # Servicio de memoria en caché centralizada (HTTP + WebSocket)
│   └── src/
│       ├── index.js       # Entrypoint (Express + WebSocket server)
│       ├── authMiddleware.js  # API key auth
│       ├── wsHandler.js   # Manejador de conexiones WebSocket
│       ├── services/
│       │   └── memoriaStore.js  # Lógica compartida del store in-memory
│       └── routes/        # memoria.routes.js (set/get/del/keys/clear/expire)
├── api_procesos_consola/   # Servicio de gestión de terminales/procesos (Express + WS)
│   └── src/
│       ├── index.js        # Entrypoint (Express + WebSocket, puerto 3575)
│       ├── routes/         # procesos.routes.js
│       └── services/       # terminalManager.js, wsHandler.js, memoriaClient.js
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

### API Gestor Servicios (`api_gestor_servicios/`) — Punto de entrada

```bash
npm run dev               # Iniciar servidor con --watch (puerto 4250)
npm start                 # Iniciar servidor en producción
```

### Backend (`backend/`)

```bash
sudo npm run setup-db     # Crear DB y usuario (requiere sudo para mysql root)
npm run migrate           # Ejecutar migraciones
npm run seed              # Ejecutar seeds (admin/admin)
npm run dev               # Iniciar servidor con --watch (puerto 4000)
npm start                 # Iniciar servidor en producción
```

Orden inicial obligatorio: `sudo setup-db → migrate → seed → dev` (luego iniciar con `npm run dev` desde `api_gestor_servicios/`)

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

### API Documental (`api_documental/`)

```bash
npm run dev               # Iniciar servidor con --watch (puerto 4099)
npm start                 # Iniciar servidor en producción
```

### Playwright (`playwright/`)

```bash
npm run setup             # npm install + instalar navegadores chromium y firefox
npm run dev               # Iniciar servidor con --watch (puerto 4098)
npm start                 # Iniciar servidor en producción
```

### API Procesos Consola (`api_procesos_consola/`)

```bash
npm run dev               # Iniciar servidor con --watch (puerto 3575)
npm start                 # Iniciar servidor en producción
```

### API Memoria (`api_memoria/`)

```bash
npm run dev               # Iniciar servidor con --watch (puerto 4101)
npm start                 # Iniciar servidor en producción
```

## Sistema de Módulos

### Frontend — `frontend/src/modules/<name>/index.js`

Cada módulo se auto-descubre vía `import.meta.glob`. El manifest debe exportar por defecto:

```js
export default {
  id: 'mi_modulo',                    // único, snake_case
  name: 'Mi Módulo',                  // nombre legible
  tabs: {
    sidebarRight: [ ... ],            // tabs en SidebarRight.vue
    sidebarChat: [ ... ],             // tabs en SidebarChat.vue
    devPanel: [ ... ],                // tabs en DevInstancePanel.vue
  },
  commands: [ ... ],                  // objetos de comando (NO auto-registrados)
  init() { /* opcional */ },
}
```

**Reglas:**
- Cada tab requiere `id`, `label`, `component` (dynamic import) y `priority` numérico (menor = primero)
- `priority` es obligatorio — define el orden izquierda→derecha
- Los comandos deben exportarse como objetos planos con `name`, `category`, `description`, `usage`, `execute`
- No definir stores dentro del módulo; usar Pinia stores existentes

### Backend — `backend/src/modules/<name>/index.js`

Solo crear backend module si el módulo necesita rutas API propias. Se descubre automáticamente vía `fs.readdirSync`:

```js
export default {
  id: 'mi_modulo',
  name: 'Mi Módulo',
  routes: [
    { path: '/api/mi-ruta', router: miRouter },
  ],
}
```

**Reglas:**
- `id` debe coincidir con el frontend module si están vinculados
- Usar Express Router estándar con `authGuard`
- No crear backend module si el módulo solo agrega tabs o comandos sin API propia

### Paneles consumidores

| Panel | Slot en registry | Built-ins (prioridad) |
|-------|-----------------|----------------------|
| `SidebarRight.vue` | `sidebarRightTabs` | — |
| `SidebarChat.vue` | `sidebarChatTabs` | chats(10), servicios(20), archived(30) |
| `DevInstancePanel.vue` | `devPanelTabs` | instancias(10), repositorio(20), tickets(30), proyectos(40), console_logs(50), events(60), network_logs(70) |

Los tabs built-in se fusionan con los del registry y se ordenan por `priority`.

### Ejemplo completo

- **skills** (`frontend/src/modules/skills/` + `backend/src/modules/skills/`) — referencia canónica de módulo frontend+backend vinculado

## Testing

(Pendiente de definir — no hay tests en este momento)
