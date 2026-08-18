<template>
  <router-view />
  <ModalContainer />
</template>

<script>
import { onMounted, watch } from 'vue'
import { ModalContainer } from 'vue-greenborn-modal-manager'
import 'vue-greenborn-modal-manager/style.css'
import { useAuthStore } from './stores/auth.js'
import { useSettingsStore } from './stores/settings.js'
import { useComponentContextMenu } from './composables/useComponentContextMenu.js'

export default {
  components: { ModalContainer },
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
