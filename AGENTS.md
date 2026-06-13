# AGENTS.md — test_desarrollo_agentes

## Fuente de verdad del proyecto

Ver `docs/ESPECIFICACION_TECNICA.md` — debe mantenerse actualizada con cada cambio significativo.

## Stack

- **Backend:** Node.js + Express + Knex + mysql2 + MariaDB — JavaScript puro (NO TypeScript)
- **Frontend:** Vue 3 + Vite + Bootstrap 5 — JavaScript puro (NO TypeScript)
- **Comunicación:** Socket.IO (100%, sin HTTP REST entre front/back)
- **Autenticación:** Sesiones con cookies (express-session)
- **Agente chat:** DeepSeek API con streaming (thinking + respuesta en vivo)
- **Encriptación:** AES-256-CBC con clave desde `.env`

## Convenciones

- **Prohibido TypeScript** en cualquier parte del proyecto
- Migraciones y seeds con Knex (no raw SQL ni otros ORM)
- Variables de entorno desde `backend/.env`
- Script `backend/scripts/setup-db.js` para crear DB y usuario en MariaDB
- API keys encriptadas antes de guardar en tabla `settings`
- Todas las comunicaciones frontend ↔ backend vía Socket.IO

## Estructura

```
/
├── backend/               # Express + Socket.IO + Knex
│   ├── migrations/        # Migraciones Knex
│   ├── seeds/             # Seeds Knex (admin/admin)
│   ├── scripts/           # setup-db.js
│   └── src/
│       ├── index.js       # Entrypoint (Express + Socket.IO)
│       ├── config/db.js   # Conexión Knex
│       ├── socketHandlers/ # auth, chat, settings
│       ├── services/       # crypto.js, deepseek.js
│       └── middlewares/    # sessionAuth.js
├── frontend/              # Vue 3 + Vite + Bootstrap
│   └── src/
│       ├── main.js
│       ├── router/         # Vue Router con guard de sesión
│       ├── stores/         # Pinia (auth, chat, settings)
│       ├── views/          # Login, Dashboard, Settings
│       ├── components/     # Topbar, SidebarChat, ChatWindow, ChatMessage
│       └── composables/    # useSocket.js
├── docs/
│   └── ESPECIFICACION_TECNICA.md
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

## Testing

(Pendiente de definir — no hay tests en este momento)
