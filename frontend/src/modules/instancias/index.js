import { defineAsyncComponent } from 'vue'

export default {
  id: 'instancias',
  name: 'Instancias de Desarrollo',
  tabs: {
    devPanel: [
      { id: 'instancias', label: 'Instancias de Desarrollo', component: defineAsyncComponent(() => import('./components/InstanciasTab.vue')), priority: 10 },
    ],
  },
}
