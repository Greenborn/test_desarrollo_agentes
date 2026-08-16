import { defineAsyncTab } from '../../utils/asyncTab.js'

export default {
  id: 'tickets',
  name: 'Tickets',
  tabs: {
    devPanel: [
      { id: 'tickets', label: 'Tickets', component: defineAsyncTab(() => import('./components/TicketsTab.vue')), priority: 30 },
    ],
  },
}
