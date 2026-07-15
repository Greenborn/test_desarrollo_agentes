import { defineAsyncComponent } from 'vue'

export default {
  id: 'capturas',
  name: 'Capturas',
  tabs: {
    sidebarRight: [
      { id: 'capturas', label: 'Capturas', component: defineAsyncComponent(() => import('./components/CapturasTab.vue')), priority: 60 },
    ],
  },
}
