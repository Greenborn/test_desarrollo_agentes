<template>
  <div class="dev-instance-panel h-100 d-flex flex-column">
    <div class="tab-bar d-flex align-items-center px-3 pt-2 pb-0 flex-shrink-0">
      <button v-for="t in allDevTabs" :key="t.id" class="tab-btn" :class="{ active: tab === t.id }" @click="selectDevTab(t.id)">{{ t.label }}</button>
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

    const allDevTabs = computed(() => {
      if (!devPanelTabs) return []
      return [...devPanelTabs].sort((a, b) => (a.priority || 50) - (b.priority || 50))
    })

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

    return {
      tab,
      allDevTabs,
      activeTabComponent,
      selectDevTab,
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
</style>
