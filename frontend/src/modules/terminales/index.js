import { defineAsyncTab } from '../../utils/asyncTab.js'

export default {
  id: 'terminales',
  name: 'Terminales',
  tabs: {
    sidebarRight: [
      { id: 'terminales', label: 'Terminales', component: defineAsyncTab(() => import('./components/TerminalesTab.vue')), priority: 25 },
    ],
  },
}
