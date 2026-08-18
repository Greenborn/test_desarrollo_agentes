<template>
  <div class="dev-instance-panel h-100 d-flex flex-column">
    <TabPanel
      class="flex-grow-1"
      style="min-height: 0;"
      :tabs="ctl.localTabs.value"
      :active="ctl.activeTab.value"
      @select="onSelect"
      @reorder="ctl.reorder"
    />
  </div>
</template>

<script>
import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { TabPanel, useTabController } from 'vue-greenborn-panels'
import { useUiStore } from '../../stores/ui.js'
import { useChatStore } from '../../stores/chat.js'
import { useActiveComponentsStore } from '../../stores/activeComponents.js'
import { useModuleRegistry } from '../../composables/useModuleRegistry.js'

export default {
  components: { TabPanel },
  setup() {
    const ui = useUiStore()
    const chat = useChatStore()
    const ac = useActiveComponentsStore()
    const { devPanelTabOrder } = storeToRefs(ui)
    const { devPanelTabs } = useModuleRegistry()

    function restoreTab() {
      const prefs = chat.getSessionPrefs(chat.activeSessionId)
      return prefs?.devPanelTab || 'instancias'
    }

    function saveTabOrder(ids) {
      devPanelTabOrder.value = ids
      ui.saveLayoutPrefs()
    }

    const ctl = useTabController({
      slotTabs: devPanelTabs,
      builtinTabs: [],
      savedOrder: devPanelTabOrder,
      filterTab: (t) => ac.isActive('devPanel', t.id),
      watchFilter: [() => ac.activeConfig],
      persistOrder: saveTabOrder,
      initialTab: 'instancias',
      restoreTab,
    })

    function onSelect(id) {
      ctl.select(id)
      if (chat.activeSessionId) chat.saveSessionPref(chat.activeSessionId, 'devPanelTab', id)
    }

    watch(() => chat.activeSessionId, () => {
      ctl.activeTab.value = restoreTab()
    })

    return {
      ctl,
      onSelect,
    }
  },
}
</script>

<style scoped>
.dev-instance-panel {
  background: #1a1a2e;
}
</style>
