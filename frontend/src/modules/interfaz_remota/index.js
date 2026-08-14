import { defineAsyncComponent } from 'vue'

export default {
  id: 'interfaz_remota',
  name: 'Interfaz Remota',
  tabs: {
    sidebarRight: [
      {
        id: 'interfaz_remota',
        label: 'Interfaz Remota',
        component: defineAsyncComponent(() => import('./components/InterfazRemotaTab.vue')),
        priority: 70,
      },
    ],
  },
}
