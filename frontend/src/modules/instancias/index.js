import { defineAsyncTab } from '../../utils/asyncTab.js'

export default {
  id: 'instancias',
  name: 'Instancias de Desarrollo',
  tabs: {
    devPanel: [
      { id: 'instancias', label: 'Instancias de Desarrollo', component: defineAsyncTab(() => import('./components/InstanciasTab.vue')), priority: 10 },
    ],
  },
}
