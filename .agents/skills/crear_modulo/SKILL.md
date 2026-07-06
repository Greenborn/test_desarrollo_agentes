---
name: crear_modulo
description: Crear un nuevo módulo auto-registrable para el sistema de módulos. Un módulo puede agregar tabs en cualquier panel, comandos al chat, rutas al backend, funcionalidades completas auto-integradas sin tocar archivos existentes.
---

# crear_modulo

**Objetivo:** Crear un nuevo módulo siguiendo el patrón de módulos auto-registrables. Un módulo encapsula una funcionalidad completa (tabs, comandos, rutas backend) en un directorio con `index.js` que declara qué aporta. El sistema lo descubre automáticamente sin modificar `main.js`, `SidebarRight.vue`, `SidebarChat.vue`, `DevInstancePanel.vue` ni `backend/src/index.js`.

## Estructura de un módulo

```
frontend/src/modules/<nombre_modulo>/
├── index.js                          → Manifest del módulo (obligatorio)
├── components/                       → Componentes Vue para tabs
│   └── MiComponente.vue
└── commands/                         → Comandos del chat (exportan objeto, NO se auto-registran)
    └── miComando.js

backend/src/modules/<nombre_modulo>/
├── index.js                          → Manifest backend (obligatorio si tiene rutas)
└── <nombre>.routes.js                → Router de Express
```

## Frontend — Manifest (`frontend/src/modules/<name>/index.js`)

```js
import miComando from './commands/miComando.js'

export default {
  id: 'mi_modulo',                    // único, en snake_case
  name: 'Mi Módulo',                  // nombre legible
  tabs: {
    sidebarRight: [                   // panel derecho (SidebarRight)
      { id: 'mi_tab', label: 'Mi Tab', component: () => import('./components/MiTab.vue'), priority: 90 }
    ],
    sidebarChat: [                    // panel izquierdo (SidebarChat) — opcional
      // { id: '...', label: '...', component: ..., priority: 90 }
    ],
    devPanel: [                       // panel inferior (DevInstancePanel) — opcional
      // { id: '...', label: '...', component: ..., priority: 90 }
    ],
  },
  commands: [                         // comandos registrados automáticamente
    miComando,
  ],
}
```

### Comandos

Cada archivo en `commands/` debe exportar un objeto (NO auto-registrarse con side-effect):

```js
export default {
  name: '/mi_comando',
  category: 'MiCategoria',
  description: 'Qué hace este comando.',
  usage: '/mi_comando <arg1>',
  async execute(args, { chatStore, loadingIdx, sessionId }) {
    // Lógica aquí — usar fetch() con credentials: 'include'
  },
}
```

No usar `import { useCommandRegistry } ... register(...)` dentro del archivo. El module registry lo registra automáticamente al cargar el módulo.

### Tabs

- La propiedad `component` debe ser un **dynamic import**: `() => import('./components/MiTab.vue')`
- Esto permite code-splitting (Vite genera chunks separados)
- La priority determina orden en la tab bar (menor = más a la izquierda)
- El componente recibe el contexto del panel padre automáticamente (props no explícitas)

## Backend — Manifest (`backend/src/modules/<name>/index.js`)

```js
import misRoutes from './mis.routes.js'

export default {
  id: 'mi_modulo',
  name: 'Mi Módulo',
  routes: [
    { path: '/api/mi-ruta', router: misRoutes },
  ],
}
```

### Rutas

Las rutas usan Express Router estándar con `authGuard`:

```js
import { Router } from 'express'
const router = Router()

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'No autorizado' })
    return false
  }
  return true
}

router.get('/list', async (req, res) => {
  if (!authGuard(req, res)) return
  // ...
})

export default router
```

## Reglas generales

1. **ID único:** `mod.id` debe ser único. Si otro módulo usa el mismo ID, lo reemplaza.
2. **No tocar archivos existentes:** Al crear un módulo no se debe modificar `main.js`, `SidebarRight.vue`, `SidebarChat.vue`, `DevInstancePanel.vue`, `Topbar.vue` ni `backend/src/index.js`. Todo se integra vía `useModuleRegistry` (frontend) y `loadModuleRoutes` (backend).
3. **Comandos en el manifest:** No importar comandos como side-effect. Exportarlos desde el manifest del módulo en la propiedad `commands`.
4. **Dynamic imports para componentes:** Usar `() => import(...)` siempre, nunca import estático en el manifest.
5. **Sin stores dedicadas en el módulo:** Si el módulo necesita estado, usar stores Pinia existentes o `ref()` locales dentro del componente. Si se necesita una store nueva, crearla en `frontend/src/stores/` e importarla normalmente en el componente.
6. **Session-scoping obligatorio:** Si el tab depende de una sesión de chat activa, validar dentro del componente con `useChatStore().activeSessionId`.
7. **Prohibido `||` como fallback de parámetros:** Validar explícitamente cada argumento requerido y devolver error si falta.
8. **Manejo de errores:** Todo `catch` debe registrar el error con `console.error` (frontend) o `console.log` (backend). Prohibido `catch {}` vacío o silencioso.
9. **Prohibido `alert()`:** Usar `modal.open(AlertModal, ...)` para notificaciones al usuario.

## Paneles disponibles

| Panel | Clave en `tabs.` | Archivo del panel | ¿Tabs built-in? |
|-------|-------------------|-------------------|-----------------|
| Derecho | `sidebarRight` | `SidebarRight.vue` | comentarios, archivos, variables, comandos, capturas, casos_prueba, documentacion |
| Izquierdo | `sidebarChat` | `SidebarChat.vue` | chats, servicios, archived |
| Inferior | `devPanel` | `DevInstancePanel.vue` | instancias, repositorio, tickets, proyectos, console_logs, events, network_logs |

## Ejemplo completo

### Crear un módulo "notas" con un tab en panel derecho y un comando

`frontend/src/modules/notas/index.js`:
```js
import notasCommand from './commands/notas.js'

export default {
  id: 'notas',
  name: 'Notas Rápidas',
  tabs: {
    sidebarRight: [
      { id: 'notas', label: 'Notas', component: () => import('./components/NotasTab.vue'), priority: 85 },
    ],
  },
  commands: [notasCommand],
}
```

`frontend/src/modules/notas/commands/notas.js`:
```js
export default {
  name: '/notas_listar',
  category: 'Notas',
  description: 'Lista las notas rápidas.',
  usage: '/notas_listar',
  async execute(args, { chatStore, sessionId }) {
    const res = await fetch('/api/notas/list', { credentials: 'include' })
    const data = await res.json()
    return (data.notas || []).map(n => `- ${n.texto}`).join('\n') || '(sin notas)'
  },
}
```

`backend/src/modules/notas/index.js`:
```js
import notasRoutes from './notas.routes.js'
export default {
  id: 'notas',
  routes: [{ path: '/api/notas', router: notasRoutes }],
}
```

## Verificación

Después de crear el módulo, verificar:
1. `npm run build` desde `frontend/` — debe compilar sin errores (los chunks de tabs aparecen como archivos separados en `dist/assets/`)
2. El tab aparece en el panel correspondiente
3. Los comandos aparecen en `/help` y en autocompletado
4. Las rutas backend responden correctamente

## Output

Crear los archivos del módulo en:
- `frontend/src/modules/<nombre>/` (manifest + componentes + comandos)
- `backend/src/modules/<nombre>/` (manifest + rutas) — solo si tiene backend

No modificar ningún archivo fuera de `frontend/src/modules/` y `backend/src/modules/`.
