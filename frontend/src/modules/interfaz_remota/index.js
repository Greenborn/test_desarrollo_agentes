import { defineAsyncTab } from '../../utils/asyncTab.js'

export default {
  id: 'interfaz_remota',
  name: 'Interfaz Remota',
  tabs: {
    sidebarRight: [
      {
        id: 'interfaz_remota',
        label: 'Interfaz Remota',
        component: defineAsyncTab(() => import('./components/InterfazRemotaTab.vue')),
        priority: 70,
      },
    ],
  },
}
