import { defineAsyncComponent } from 'vue'

export default {
  id: 'network_logs',
  name: 'Network Logs',
  tabs: {
    devPanel: [
      { id: 'network_logs', label: 'Actividad de Red', component: defineAsyncComponent(() => import('./components/NetworkLogsTab.vue')), priority: 70 },
    ],
  },
}
