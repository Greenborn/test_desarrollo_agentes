import { defineAsyncTab } from '../../utils/asyncTab.js'

export default {
  id: 'console_logs',
  name: 'Console Logs',
  tabs: {
    devPanel: [
      { id: 'console_logs', label: 'Console Log Navegador', component: defineAsyncTab(() => import('./components/ConsoleLogsTab.vue')), priority: 50 },
    ],
  },
}
