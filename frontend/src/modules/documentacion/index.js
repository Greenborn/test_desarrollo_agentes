import { defineAsyncComponent } from 'vue'
import documentacionAll from './commands/documentacionAll.js'
import documentacionUpdate from './commands/documentacionUpdate.js'
import documentacionNotas from './commands/documentacionNotas.js'

export default {
  id: 'documentacion',
  name: 'Documentación',
  tabs: {
    sidebarRight: [
      { id: 'documentacion', label: 'Documentación', component: defineAsyncComponent(() => import('./components/DocumentacionTab.vue')), priority: 50 },
    ],
  },
  commands: [
    ...documentacionNotas,
    documentacionAll,
    documentacionUpdate,
  ],
}
