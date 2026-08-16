import { defineAsyncTab } from '../../utils/asyncTab.js'

export default {
  id: 'procesos_segundo_plano',
  name: 'Procesos en Segundo Plano',
  tabs: {
    sidebarRight: [
      {
        id: 'procesos_segundo_plano',
        label: 'Segundo Plano',
        component: defineAsyncTab(() => import('./components/SegundoPlanoTab.vue')),
        priority: 70,
      },
    ],
  },
}
