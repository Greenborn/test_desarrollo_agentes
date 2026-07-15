import { defineAsyncComponent } from 'vue'

export default {
  id: 'repositorio',
  name: 'Repositorio',
  tabs: {
    devPanel: [
      { id: 'repositorio', label: 'Repositorio', component: defineAsyncComponent(() => import('./components/RepositorioTab.vue')), priority: 20 },
    ],
  },
}
