import { defineAsyncTab } from '../../utils/asyncTab.js'

export default {
  id: 'casos_prueba',
  name: 'Casos de Prueba',
  tabs: {
    sidebarRight: [
      { id: 'casos_prueba', label: 'Casos de Prueba', component: defineAsyncTab(() => import('./components/CasosPruebaTab.vue')), priority: 8 },
    ],
  },
}
