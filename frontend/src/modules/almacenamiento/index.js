import { defineAsyncTab } from '../../utils/asyncTab.js'

export default {
  id: 'almacenamiento',
  name: 'Almacenamiento',
  tabs: {
    sidebarChat: [
      {
        id: 'almacenamiento',
        label: 'Almacenamiento',
        component: defineAsyncTab(() => import('./components/AlmacenamientoTab.vue')),
        priority: 40,
      },
    ],
  },
}
