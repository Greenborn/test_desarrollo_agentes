import { defineAsyncTab } from '../../utils/asyncTab.js'

export default {
  id: 'repositorio',
  name: 'Repositorio',
  tabs: {
    devPanel: [
      { id: 'repositorio', label: 'Repositorio', component: defineAsyncTab(() => import('./components/RepositorioTab.vue')), priority: 20 },
    ],
  },
}
