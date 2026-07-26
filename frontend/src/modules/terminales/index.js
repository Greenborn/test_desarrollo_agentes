import { defineAsyncComponent } from 'vue'

export default {
  id: 'terminales',
  name: 'Terminales',
  tabs: {
    sidebarRight: [
      { id: 'terminales', label: 'Terminales', component: defineAsyncComponent(() => import('./components/TerminalesTab.vue')), priority: 25 },
    ],
  },
}
