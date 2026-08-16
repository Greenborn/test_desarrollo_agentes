import { defineAsyncTab } from '../../utils/asyncTab.js'

export default {
  id: 'variables',
  name: 'Variables',
  tabs: {
    sidebarRight: [
      { id: 'variables', label: 'Variables', component: defineAsyncTab(() => import('./components/VariablesTab.vue')), priority: 30 },
    ],
  },
}
