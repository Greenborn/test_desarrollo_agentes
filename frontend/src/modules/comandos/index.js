import { defineAsyncTab } from '../../utils/asyncTab.js'

export default {
  id: 'comandos',
  name: 'Comandos',
  tabs: {
    sidebarRight: [
      { id: 'comandos', label: 'Comandos', component: defineAsyncTab(() => import('./components/ComandosTab.vue')), priority: 40 },
    ],
  },
}
