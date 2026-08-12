<template>
  <div class="componentes-activos-panel d-flex flex-column h-100">
    <div class="px-2 pt-2 pb-1 flex-shrink-0">
      <span class="text-white-50" style="font-size: 0.7rem;">Componentes activos por sesión</span>
    </div>
    <div class="overflow-y-auto flex-grow-1 px-2" style="min-height: 0;">
      <div class="d-flex justify-content-center pb-2">
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary w-100"
          :disabled="!activeSessionId"
          @click="applyToAll"
        >
          Aplicar a todas las sesiones
        </button>
      </div>
      <div v-if="!activeSessionId" class="text-center text-white-50 py-3" style="font-size: 0.7rem;">
        Seleccione una sesión de chat
      </div>
      <div v-else-if="items.length === 0" class="text-center text-white-50 py-3" style="font-size: 0.7rem;">
        Sin componentes disponibles
      </div>
      <div v-else class="component-list">
        <div v-for="item in items" :key="item.id" class="component-item d-flex align-items-center py-1 px-1 mb-1">
          <div class="d-flex flex-column flex-grow-1 min-width-0 ms-1">
            <span class="component-name text-truncate">{{ item.label }}</span>
            <span class="component-panel text-muted" style="font-size: 0.6rem;">{{ item.panelLabel }}</span>
          </div>
          <div class="form-check form-switch m-0">
            <input
              class="form-check-input"
              type="checkbox"
              role="switch"
              :checked="item.active"
              @change="onToggle(item, $event)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../../../stores/chat.js'
import { useActiveComponentsStore } from '../../../stores/activeComponents.js'

// La lista de componentes es dinámica: se construye a partir de `store.allTabs`,
// que agrega todos los tabs registrados en `sidebarRightTabs` y `devPanelTabs`
// del module registry (ver stores/activeComponents.js). Cualquier tab nuevo que
// un módulo registre en `sidebarRight` o `devPanel` aparece aquí automáticamente
// y es activable/desactivable por sesión, sin configuración manual adicional.
const PANEL_LABELS = {
  devPanel: 'Panel Inferior',
  sidebarRight: 'Panel Lateral Derecho',
}

export default {
  setup() {
    const chat = useChatStore()
    const store = useActiveComponentsStore()
    const { activeSessionId } = storeToRefs(chat)

    const items = computed(() => {
      return store.allTabs.map(({ panel, tab }) => ({
        id: `${panel}:${tab.id}`,
        tabId: tab.id,
        label: tab.label,
        panel,
        panelLabel: PANEL_LABELS[panel] || panel,
        active: store.isActive(panel, tab.id),
      }))
    })

    function onToggle(item, event) {
      store.toggle(item.panel, item.tabId, event.target.checked)
    }

    function applyToAll() {
      store.applyToAll()
    }

    return { activeSessionId, items, onToggle, applyToAll }
  },
}
</script>

<style scoped>
.component-list {
  display: flex;
  flex-direction: column;
}
.component-item {
  border-radius: 4px;
  transition: background-color 0.15s;
}
.component-item:hover {
  background-color: #1a2744;
}
.component-name {
  color: #e0e0e0;
  font-size: 0.75rem;
  line-height: 1.2;
}
.component-panel {
  font-size: 0.6rem;
  line-height: 1.2;
}
.form-check-input {
  cursor: pointer;
}
</style>
