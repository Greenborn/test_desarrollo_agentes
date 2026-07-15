import { defineAsyncComponent } from 'vue'

export default {
  id: 'events',
  name: 'Events',
  tabs: {
    devPanel: [
      { id: 'events', label: 'Eventos del Navegador', component: defineAsyncComponent(() => import('./components/EventsTab.vue')), priority: 60 },
    ],
  },
}
