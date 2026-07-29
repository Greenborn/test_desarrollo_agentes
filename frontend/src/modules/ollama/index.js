import { defineAsyncComponent } from 'vue'

export default {
  id: 'ollama',
  name: 'Ollama',
  tabs: {
    devPanel: [
      { id: 'ollama', label: 'Ollama', component: defineAsyncComponent(() => import('./components/OllamaTab.vue')), priority: 35 },
    ],
  },
}
