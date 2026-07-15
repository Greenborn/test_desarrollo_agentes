import { defineAsyncComponent } from 'vue'

export default {
  id: 'comentarios',
  name: 'Comentarios',
  tabs: {
    sidebarRight: [
      { id: 'comentarios', label: 'Comentarios', component: defineAsyncComponent(() => import('./components/ComentariosTab.vue')), priority: 10 },
    ],
  },
}
