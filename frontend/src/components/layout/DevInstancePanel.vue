<template>
  <div class="dev-instance-panel h-100 d-flex flex-column">
    <div class="tab-bar d-flex align-items-center px-3 pt-2 pb-0 flex-shrink-0">
      <button v-for="(t, i) in localTabs" :key="t.id" class="tab-btn"
        :class="{ active: tab === t.id, dragging: dragIndex === i, 'drag-over': dragOverIndex === i }"
        draggable="true"
        @click="selectDevTab(t.id)"
        @dragstart="onDragStart(i, $event)"
        @dragover.prevent="onDragOver(i)"
        @drop.prevent="onDrop(i)"
        @dragend="onDragEnd">{{ t.label }}</button>
    </div>
    <component :is="activeTabComponent" v-if="activeTabComponent" class="flex-grow-1" />
  </div>
</template>

<script>
import { ref, computed, watch, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '../../stores/ui.js'
import { useChatStore } from '../../stores/chat.js'
import { useActiveComponentsStore } from '../../stores/activeComponents.js'
import { useModuleRegistry } from '../../composables/useModuleRegistry.js'
import { sortTabs } from '../../utils/sortTabs.js'

export default {
  setup() {
    const ui = useUiStore()
    const chat = useChatStore()
    const ac = useActiveComponentsStore()
    const { devPanelTabOrder } = storeToRefs(ui)
    const tab = ref('instancias')

    function restoreTab() {
      const prefs = chat.getSessionPrefs(chat.activeSessionId)
      tab.value = prefs?.devPanelTab || 'instancias'
    }
    watch(() => chat.activeSessionId, restoreTab)
    const { devPanelTabs } = useModuleRegistry()

    const localTabs = shallowRef([])
    const dragIndex = ref(null)
    const dragOverIndex = ref(null)

    function buildTabs() {
      if (!devPanelTabs) { localTabs.value = []; return }
      const all = sortTabs([...devPanelTabs], devPanelTabOrder.value)
      localTabs.value = all.filter(t => ac.isActive('devPanel', t.id))
      if (localTabs.value.length && !localTabs.value.find(t => t.id === tab.value)) {
        tab.value = localTabs.value[0].id
        if (chat.activeSessionId) chat.saveSessionPref(chat.activeSessionId, 'devPanelTab', tab.value)
      }
    }

    const activeTabComponent = computed(() => {
      if (!devPanelTabs) return null
      const found = devPanelTabs.find(t => t.id === tab.value)
      return found ? found.component : null
    })

    function selectDevTab(val) {
      tab.value = val
      if (chat.activeSessionId) chat.saveSessionPref(chat.activeSessionId, 'devPanelTab', val)
    }

    function saveTabOrder(ids) {
      devPanelTabOrder.value = ids
      ui.saveLayoutPrefs()
    }

    function onDragStart(index, e) {
      dragIndex.value = index
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(index))
    }

    function onDragOver(index) {
      dragOverIndex.value = index
    }

    function onDrop(index) {
      if (dragIndex.value === null || dragIndex.value === index) {
        dragIndex.value = null
        dragOverIndex.value = null
        return
      }
      const items = [...localTabs.value]
      const [moved] = items.splice(dragIndex.value, 1)
      items.splice(index, 0, moved)
      localTabs.value = items
      saveTabOrder(items.map(t => t.id))
      dragIndex.value = null
      dragOverIndex.value = null
    }

    function onDragEnd() {
      dragIndex.value = null
      dragOverIndex.value = null
    }

    watch(devPanelTabs, () => buildTabs(), { immediate: true })
    watch(devPanelTabOrder, () => buildTabs())
    watch(() => ac.activeConfig, () => buildTabs(), { deep: true })

    return {
      tab,
      localTabs,
      activeTabComponent,
      selectDevTab,
      dragIndex,
      dragOverIndex,
      onDragStart,
      onDragOver,
      onDrop,
      onDragEnd,
    }
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
.tab-btn:hover {
  color: #cbd5e1;
}
.tab-btn.active {
  color: #75AADB;
  border-bottom-color: #75AADB;
}
.tab-btn.dragging {
  opacity: 0.4;
}
.tab-btn.drag-over {
  border-bottom-color: #75AADB;
}
</style>
