import { defineAsyncTab } from '../../utils/asyncTab.js'

export default {
  id: 'componentes_activos',
  name: 'Componentes Activos',
  tabs: {
    sidebarChat: [
      {
        id: 'componentes_activos',
        label: 'Componentes Activos',
        component: defineAsyncTab(() => import('./components/ComponentesActivosTab.vue')),
        priority: 40,
      },
    ],
  },
}
