import { defineAsyncComponent } from 'vue'

export default {
  id: 'proyectos',
  name: 'Proyectos',
  tabs: {
    devPanel: [
      { id: 'proyectos', label: 'Proyectos', component: defineAsyncComponent(() => import('./components/ProyectosTab.vue')), priority: 40 },
    ],
  },
}
