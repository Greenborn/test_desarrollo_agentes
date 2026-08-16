import { defineAsyncTab } from '../../utils/asyncTab.js'

export default {
  id: 'archivos',
  name: 'Archivos',
  tabs: {
    sidebarRight: [
      { id: 'archivos', label: 'Archivos', component: defineAsyncTab(() => import('./components/ArchivosTab.vue')), priority: 5 },
    ],
  },
}
