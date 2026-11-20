<template>
  <router-view />
  <ModalContainer />
  <!-- Reporte contextual (Alt + clic derecho o "d" + clic): registra notas de desarrollo en el SGI. -->
  <ReporteContextual
    v-if="sgiApiUrl && sgiProyectoSlug"
    :api-base-url="sgiApiUrl"
    :version="reporteVersion"
    :slug-proyecto="sgiProyectoSlug"
  />
</template>

<script>
import { onMounted, watch } from 'vue'
import { ModalContainer } from '@greenborn/vue-greenborn-modal-manager'
import '@greenborn/vue-greenborn-modal-manager/style.css'
import { ReporteContextual } from '@greenborn/vue-greenborn-reporte-contextual'
import '@greenborn/vue-greenborn-reporte-contextual/style.css'
import { useAuthStore } from './stores/auth.js'
import { useSettingsStore } from './stores/settings.js'
import { useComponentContextMenu } from './composables/useComponentContextMenu.js'

export default {
  components: { ModalContainer, ReporteContextual },
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

    // Base de la API del SGI donde se registran los reportes. Sin valor (o sin slug de proyecto)
    // el reporte contextual no se monta.
    return {
      sgiApiUrl: import.meta.env.VITE_SGI_API_URL,
      sgiProyectoSlug: import.meta.env.VITE_SGI_PROYECTO_SLUG,
      reporteVersion: import.meta.env.VITE_REPORTE_VERSION,
    }
  },
}
</script>
