import { defineAsyncTab } from '../../utils/asyncTab.js'

export default {
  id: 'events',
  name: 'Events',
  tabs: {
    devPanel: [
      { id: 'events', label: 'Eventos del Navegador', component: defineAsyncTab(() => import('./components/EventsTab.vue')), priority: 60 },
    ],
  },
}
