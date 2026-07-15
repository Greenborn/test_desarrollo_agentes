import { defineAsyncComponent } from 'vue'

export default {
  id: 'variables',
  name: 'Variables',
  tabs: {
    sidebarRight: [
      { id: 'variables', label: 'Variables', component: defineAsyncComponent(() => import('./components/VariablesTab.vue')), priority: 30 },
    ],
  },
}
