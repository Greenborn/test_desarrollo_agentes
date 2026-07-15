import { defineAsyncComponent } from 'vue'

export default {
  id: 'tickets',
  name: 'Tickets',
  tabs: {
    devPanel: [
      { id: 'tickets', label: 'Tickets', component: defineAsyncComponent(() => import('./components/TicketsTab.vue')), priority: 30 },
    ],
  },
}
