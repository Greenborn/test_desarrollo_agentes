import { defineAsyncComponent } from 'vue'
import skillEditarCommand from './commands/skillEditar.js'

export default {
  id: 'skills',
  name: 'Skills',
  tabs: {
    sidebarRight: [
      { id: 'skills', label: 'Skills', component: defineAsyncComponent(() => import('./components/SkillsTab.vue')), priority: 100 },
    ],
  },
  commands: [
    skillEditarCommand,
  ],
}
