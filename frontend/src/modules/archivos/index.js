import { defineAsyncComponent } from 'vue'

export default {
  id: 'archivos',
  name: 'Archivos',
  tabs: {
    sidebarRight: [
      { id: 'archivos', label: 'Archivos', component: defineAsyncComponent(() => import('./components/ArchivosTab.vue')), priority: 5 },
    ],
  },
}
