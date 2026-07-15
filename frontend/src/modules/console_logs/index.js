import { defineAsyncComponent } from 'vue'

export default {
  id: 'console_logs',
  name: 'Console Logs',
  tabs: {
    devPanel: [
      { id: 'console_logs', label: 'Console Log Navegador', component: defineAsyncComponent(() => import('./components/ConsoleLogsTab.vue')), priority: 50 },
    ],
  },
}
