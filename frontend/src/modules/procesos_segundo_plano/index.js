import { defineAsyncComponent } from 'vue'

export default {
  id: 'procesos_segundo_plano',
  name: 'Procesos en Segundo Plano',
  tabs: {
    sidebarRight: [
      {
        id: 'procesos_segundo_plano',
        label: 'Segundo Plano',
        component: defineAsyncComponent(() => import('./components/SegundoPlanoTab.vue')),
        priority: 70,
      },
    ],
  },
}
