import { defineAsyncComponent } from 'vue'

export default {
  id: 'componentes_activos',
  name: 'Componentes Activos',
  tabs: {
    sidebarChat: [
      {
        id: 'componentes_activos',
        label: 'Componentes Activos',
        component: defineAsyncComponent(() => import('./components/ComponentesActivosTab.vue')),
        priority: 40,
      },
    ],
  },
}
