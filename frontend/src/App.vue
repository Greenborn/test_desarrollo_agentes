<template>
  <router-view />
  <AppModal />
</template>

<script>
import { onMounted, watch } from 'vue'
import AppModal from './components/layout/AppModal.vue'
import { useAuthStore } from './stores/auth.js'
import { useSettingsStore } from './stores/settings.js'
import { useComponentContextMenu } from './composables/useComponentContextMenu.js'

export default {
  components: { AppModal },
  setup() {
    const auth = useAuthStore()
    const settings = useSettingsStore()
    useComponentContextMenu().initGlobalHandler()

    onMounted(() => {
      if (auth.user) {
        const wsId = auth.getPrimaryWorkspaceId()
        settings.load(wsId)
      }
    })

    watch(() => auth.user, (user) => {
      if (user) {
        const wsId = auth.getPrimaryWorkspaceId()
        settings.load(wsId)
      }
    })
  },
}
</script>
