import { defineAsyncTab } from '../../utils/asyncTab.js'

export default {
  id: 'capturas',
  name: 'Capturas',
  tabs: {
    sidebarRight: [
      { id: 'capturas', label: 'Capturas', component: defineAsyncTab(() => import('./components/CapturasTab.vue')), priority: 60 },
    ],
  },
}
