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
        settings.load()
      }
    })

    watch(() => auth.user, (user) => {
      if (user) {
        settings.load()
      }
    })
  },
}
</script>
