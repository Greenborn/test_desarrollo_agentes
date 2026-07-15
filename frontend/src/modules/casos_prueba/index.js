import { defineAsyncComponent } from 'vue'

export default {
  id: 'casos_prueba',
  name: 'Casos de Prueba',
  tabs: {
    sidebarRight: [
      { id: 'casos_prueba', label: 'Casos de Prueba', component: defineAsyncComponent(() => import('./components/CasosPruebaTab.vue')), priority: 8 },
    ],
  },
}
