# Plan de Migración — Pestañas del Panel Inferior a Módulos

## Objetivo

Migrar las 7 pestañas built-in de `DevInstancePanel.vue` al sistema de módulos auto-registrables (`frontend/src/modules/<name>/`), siguiendo el mismo patrón aplicado a `SidebarRight.vue`.

Estado actual: las 7 pestañas están hardcodeadas con templates inline y lógica directamente en `DevInstancePanel.vue` (~531 líneas). Estado deseado: `DevInstancePanel.vue` debe ser un shell fino que solo renderiza el tab activo desde el registry `devPanelTabs`.

## Tabs a migrar

| # | Tab ID | Etiqueta | Dificultad | Dependencias |
|---|--------|----------|-----------|-------------|
| 1 | `instancias` | Instancias de Desarrollo | ⭐⭐⭐ Alta | `DevInstanceStore`, `ChatStore`, `CommandRegistry`, `ProjectStore`, `ProjectVariablesStore`, estado local, lifecycle polling |
| 2 | `repositorio` | Repositorio | ⭐ Baja | Renderiza `<RepoView>` existente |
| 3 | `tickets` | Tickets | ⭐ Baja | Renderiza `<TicketPanel>` existente |
| 4 | `proyectos` | Proyectos | ⭐⭐ Media | `ProjectStore`, filtro inline |
| 5 | `console_logs` | Console Log Navegador | ⭐ Baja | Renderiza `<ConsoleLogPanel>` existente |
| 6 | `events` | Eventos del Navegador | ⭐ Baja | Renderiza `<BrowserEventPanel>` existente |
| 7 | `network_logs` | Actividad de Red | ⭐ Baja | Renderiza `<NetworkLogPanel>` existente |

## Prioridades

| Tab | Prioridad |
|-----|-----------|
| instancias | 10 |
| repositorio | 20 |
| tickets | 30 |
| proyectos | 40 |
| console_logs | 50 |
| events | 60 |
| network_logs | 70 |

## Archivos a crear

### Módulos simples (dificultad baja — x5)

```
frontend/src/modules/repositorio/
├── index.js
└── components/
    └── RepositorioTab.vue

frontend/src/modules/tickets/
├── index.js
└── components/
    └── TicketsTab.vue

frontend/src/modules/console_logs/
├── index.js
└── components/
    └── ConsoleLogsTab.vue

frontend/src/modules/events/
├── index.js
└── components/
    └── EventsTab.vue

frontend/src/modules/network_logs/
├── index.js
└── components/
    └── NetworkLogsTab.vue
```

Cada uno sigue este patrón:

**`index.js`:**
```js
import { defineAsyncComponent } from 'vue'

export default {
  id: '<tab_id>',
  name: '<Display Name>',
  tabs: {
    devPanel: [
      { id: '<tab_id>', label: '<Label>', component: defineAsyncComponent(() => import('./components/<Name>Tab.vue')), priority: <N> },
    ],
  },
}
```

**`components/<Name>Tab.vue`:**
```vue
<template>
  <ExistingComponent class="flex-grow-1" />
</template>

<script>
import ExistingComponent from '../../path/to/ExistingComponent.vue'
export default {
  components: { ExistingComponent },
}
</script>
```

### Módulo `proyectos` (dificultad media)

```
frontend/src/modules/proyectos/
├── index.js
└── components/
    └── ProyectosTab.vue
```

Extraer de `DevInstancePanel.vue` líneas 109-141 (template) + lógica `projectFilter`, `filteredProjects`, `selectProject`.

```js
// ProyectosTab.vue
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '../../../../stores/project.js'
```

### Módulo `instancias` (dificultad alta)

```
frontend/src/modules/instancias/
├── index.js
└── components/
    └── InstanciasTab.vue
```

Extraer de `DevInstancePanel.vue`:

**Template:**
- Líneas 28-99: proceso principal (procesos + log + port killer)
- Las cabeceras extra del tab-bar (filtro, refresh, stop) pasan a una cabecera interna del componente

**Script — stores:**
- `useDevInstanceStore` (procesos, logs, resolución, polling)
- `useChatStore` (activeSessionId)
- `useCommandRegistry` (find para `/despliegue_iniciar_instancia`)
- `useCommandStore`
- `useProjectStore` (pinnedProjectId)
- `useProjectVariablesStore` (puertos guardados)

**Script — estado local:**
- `selectedProcess`, `logContainerRef`, `portsInput`, `cerrandoPuertosRef`, `filterBySession`

**Script — funciones:**
- `iniciarInstancia`, `refrescar`, `cerrarPuertosAction`, `toggleProcess`, `typeLabel`

**Script — computed:**
- `filteredProcesses`, `displayText`, `displayedLines`, `activeSessionId`

**Script — watchers:**
- `displayText` → scroll automático
- `pinnedProjectId` → carga de puertos guardados

**Script — lifecycle:**
- `onMounted` → `devStore.startPolling()`
- `onBeforeUnmount` → `devStore.stopPolling()`

## Archivo a reescribir

`frontend/src/components/layout/DevInstancePanel.vue` → **reducir a shell:**

```vue
<template>
  <div class="dev-instance-panel h-100 d-flex flex-column">
    <div class="tab-bar d-flex align-items-center px-3 pt-2 pb-0 flex-shrink-0">
      <button v-for="t in allDevTabs" :key="t.id" class="tab-btn"
        :class="{ active: tab === t.id }"
        @click="selectDevTab(t.id)">{{ t.label }}</button>
    </div>
    <component :is="activeTabComponent" v-if="activeTabComponent" class="flex-grow-1" />
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '../../stores/ui.js'
import { useModuleRegistry } from '../../composables/useModuleRegistry.js'
export default {
  setup() {
    const ui = useUiStore()
    const { devPanelTab } = storeToRefs(ui)
    const tab = ref('instancias')
    const stopTabSync = watch(devPanelTab, (v) => { tab.value = v; stopTabSync() })
    const { devPanelTabs } = useModuleRegistry()
    const allDevTabs = computed(() =>
      (devPanelTabs || []).slice().sort((a, b) => (a.priority || 50) - (b.priority || 50)))
    const activeTabComponent = computed(() => {
      if (!devPanelTabs) return null
      const found = devPanelTabs.find(t => t.id === tab.value)
      return found ? found.component : null
    })
    function selectDevTab(val) {
      tab.value = val
      devPanelTab.value = val
      ui.saveLayoutPrefs()
    }
    return { tab, allDevTabs, activeTabComponent, selectDevTab }
  },
}
</script>

<style scoped>
.dev-instance-panel {
  background: #1a1a2e;
}
.tab-bar {
  border-bottom: 1px solid #374151;
}
.tab-btn {
  background: none;
  border: none;
  color: #6b7280;
  font-size: 0.75rem;
  padding: 4px 10px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}
.tab-btn:hover { color: #cbd5e1; }
.tab-btn.active {
  color: #75AADB;
  border-bottom-color: #75AADB;
}
</style>
```

**Lo que se elimina del DevInstancePanel original:**
- Imports de: `RepoView`, `TicketPanel`, `ConsoleLogPanel`, `NetworkLogPanel`, `BrowserEventPanel`, `useProjectStore`, `useChatStore`, `useDevInstanceStore`, `useCommandRegistry`, `useCommandStore`, `useProjectVariablesStore`
- Todos los templates inline de los 7 tabs
- Todo el estado local (selectedProcess, portsInput, etc.)
- Todas las funciones auxiliares
- Todos los watchers y lifecycle hooks
- Todo el CSS de los componentes internos

## Orden de implementación recomendado

| Paso | Qué | Riesgo |
|------|-----|--------|
| 1 | Tickets | Mínimo — validar mecanismo |
| 2 | Repositorio, ConsoleLogs, Events, NetworkLogs | Mínimo — en paralelo |
| 3 | Proyectos | Bajo |
| 4 | Instancias | Alto — requiere verificación |
| 5 | Limpiar DevInstancePanel.vue | Medio — requiere que todos los módulos funcionen |
| 6 | Verificar eliminación de `builtInDevTabs` y registros hardcodeados | Bajo |

## Notas

- Los módulos NO necesitan backend module — solo agregan tabs
- Las prioridades dejan espacio para futuros módulos entre los existentes
- Los componentes compartidos (`RepoView`, `TicketPanel`, etc.) se quedan donde están
- `DevInstancePanel.vue` no debe importar ni depender de ningún store específico de tab — esa es responsabilidad de cada módulo
