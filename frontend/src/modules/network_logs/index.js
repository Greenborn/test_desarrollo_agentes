import { defineAsyncTab } from '../../utils/asyncTab.js'

export default {
  id: 'network_logs',
  name: 'Network Logs',
  tabs: {
    devPanel: [
      { id: 'network_logs', label: 'Actividad de Red', component: defineAsyncTab(() => import('./components/NetworkLogsTab.vue')), priority: 70 },
    ],
  },
}
