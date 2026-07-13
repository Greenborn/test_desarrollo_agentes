# Plan de Migración — Pestañas del Panel Derecho a Módulos

## Objetivo

Migrar las 6 pestañas built-in de `SidebarRight.vue` al sistema de módulos auto-registrables, siguiendo el patrón establecido por `documentacion` y `skills`.

## Tabs a migrar

| # | Tab ID | Estado actual | Tipo de extracción |
|---|--------|--------------|-------------------|
| 1 | `comentarios` | `SidebarRightComentarios.vue` (componente separado) | Mover componente + manifest |
| 2 | `archivos` | Template inline en `SidebarRight.vue` + `FileTreePanel`/`FilePreviewPanel` | Crear nuevo componente + manifest |
| 3 | `variables` | `SidebarRightVariables.vue` (componente separado) | Mover componente + manifest |
| 4 | `comandos` | `SidebarRightComandos.vue` (componente separado) | Mover componente + manifest |
| 5 | `capturas` | `SidebarRightCapturas.vue` (componente separado) | Mover componente + manifest |
| 6 | `casos_prueba` | Template inline en `SidebarRight.vue` | Crear nuevo componente + manifest |

## Prioridades

| Tab | Prioridad |
|-----|-----------|
| comentarios | 10 |
| archivos | 20 |
| variables | 30 |
| comandos | 40 |
| *(documentacion)* | *(50 — ya existe)* |
| capturas | 60 |
| casos_prueba | 70 |
| *(skills)* | *(100 — ya existe)* |

## Estructura de cada módulo

```
frontend/src/modules/<name>/
├── index.js                    → Manifest con tab en sidebarRight
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
  },
}
```

## Pasos por cada módulo

1. Crear `frontend/src/modules/<name>/index.js`
2. Crear `frontend/src/modules/<name>/components/<Name>Tab.vue`
   - Para tabs con componente separado: copiar y ajustar imports (rutas relativas +1 nivel)
   - Para tabs inline: extraer template completo + lógica JS asociada (splitters, settings, refs, watchers)
3. Eliminar de `SidebarRight.vue`:
   - Botón en tab-bar
   - Template condicional `v-if="tab === '<id>'"`
   - Import del componente
   - Registro en `components: {}`
   - Variables/funciones que ya no se usan (splitters, settings, etc.)

## Notas

- `FileTreePanel.vue` y `FilePreviewPanel.vue` se quedan en `components/files/` (son reutilizables)
- `FileEditorModal.vue`, `CsvViewerModal.vue` igual se quedan donde están
- Los módulos NO necesitan backend module a menos que tengan rutas propias
- Las prioridades dejan espacio para futuros módulos entre los existentes
