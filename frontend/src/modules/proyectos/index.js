import { defineAsyncTab } from '../../utils/asyncTab.js'

export default {
  id: 'proyectos',
  name: 'Proyectos',
  tabs: {
    devPanel: [
      { id: 'proyectos', label: 'Proyectos', component: defineAsyncTab(() => import('./components/ProyectosTab.vue')), priority: 40 },
    ],
  },
}
