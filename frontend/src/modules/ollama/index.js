import { defineAsyncTab } from '../../utils/asyncTab.js'

export default {
  id: 'ollama',
  name: 'Ollama',
  tabs: {
    devPanel: [
      { id: 'ollama', label: 'Ollama', component: defineAsyncTab(() => import('./components/OllamaTab.vue')), priority: 35 },
    ],
  },
}
