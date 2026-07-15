# Plan de Migración — Pestañas del Panel Derecho a Módulos ✅ COMPLETADO

## Objetivo

Migrar las 6 pestañas built-in de `SidebarRight.vue` al sistema de módulos auto-registrables, siguiendo el patrón establecido por `documentacion` y `skills`.

**Estado: COMPLETADO** — Las 6 pestañas ya son módulos independientes en `frontend/src/modules/`.

## Tabs migrados

| # | Tab ID | Módulo | Prioridad |
|---|--------|--------|-----------|
| 1 | `comentarios` | `frontend/src/modules/comentarios/` | 10 |
| 2 | `archivos` | `frontend/src/modules/archivos/` | 5 |
| 3 | `casos_prueba` | `frontend/src/modules/casos_prueba/` | 8 |
| 4 | `variables` | `frontend/src/modules/variables/` | 30 |
| 5 | `comandos` | `frontend/src/modules/comandos/` | 40 |
| 6 | `documentacion` | `frontend/src/modules/documentacion/` | 50 |
| 7 | `capturas` | `frontend/src/modules/capturas/` | 60 |
| 8 | `skills` | `frontend/src/modules/skills/` | 100 |

## Paneles que consumen el registry

Actualmente 3 paneles consumen tabs desde el registry:

| Panel | Slot del registry | Prioridades built-in |
|-------|------------------|---------------------|
| `SidebarRight.vue` | `sidebarRightTabs` | — (todos son módulos) |
| `SidebarChat.vue` | `sidebarChatTabs` | chats=10, servicios=20, archived=30 |
| `DevInstancePanel.vue` | `devPanelTabs` | instancias=10, repositorio=20, tickets=30, proyectos=40, console_logs=50, events=60, network_logs=70 |

Los tabs built-in se fusionan con los registrados por módulos y se ordenan por `priority` ascendente.

## Estructura de cada módulo

```
frontend/src/modules/<name>/
├── index.js                    → Manifest con tabs, commands, init()
└── components/
    └── <Name>Tab.vue           → Componente del tab
```

### Manifest template

```js
import { defineAsyncComponent } from 'vue'

export default {
  id: '<tab_id>',
  name: '<Display Name>',
  tabs: {
    sidebarRight: [
      { id: '<tab_id>', label: '<Label>', component: defineAsyncComponent(() => import('./components/<Name>Tab.vue')), priority: <N> },
    ],
    sidebarChat: [
      // mismo formato para tabs en SidebarChat
    ],
    devPanel: [
      // mismo formato para tabs en DevInstancePanel
    ],
  },
  commands: [
    // objetos de comando (NO auto-registrados)
  ],
  init() {
    // opcional: código de inicialización
  },
}
```

### Reglas

- `component` debe ser **dynamic import** (`() => import(...)`) para code-splitting
- `priority` es **obligatorio** (número). Define el orden izquierda→derecha (menor = primero)
- Los comandos deben exportarse como **objetos planos**, no auto-registrarse vía side-effect
- Los módulos NO necesitan backend module a menos que tengan rutas propias

## Notas

- `FileTreePanel.vue` y `FilePreviewPanel.vue` se quedan en `components/files/` (son reutilizables)
- `FileEditorModal.vue`, `CsvViewerModal.vue` igual se quedan donde están
- Las prioridades dejan espacio para futuros módulos entre los existentes
