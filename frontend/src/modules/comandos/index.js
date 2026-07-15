import { defineAsyncComponent } from 'vue'

export default {
  id: 'comandos',
  name: 'Comandos',
  tabs: {
    sidebarRight: [
      { id: 'comandos', label: 'Comandos', component: defineAsyncComponent(() => import('./components/ComandosTab.vue')), priority: 40 },
    ],
  },
}
