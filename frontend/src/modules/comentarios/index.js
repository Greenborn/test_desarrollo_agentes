import { defineAsyncTab } from '../../utils/asyncTab.js'

export default {
  id: 'comentarios',
  name: 'Comentarios',
  tabs: {
    sidebarRight: [
      { id: 'comentarios', label: 'Comentarios', component: defineAsyncTab(() => import('./components/ComentariosTab.vue')), priority: 10 },
    ],
  },
}
