import { defineAsyncTab } from '../../utils/asyncTab.js'
import skillEditarCommand from './commands/skillEditar.js'

export default {
  id: 'skills',
  name: 'Skills',
  tabs: {
    sidebarRight: [
      { id: 'skills', label: 'Skills', component: defineAsyncTab(() => import('./components/SkillsTab.vue')), priority: 100 },
    ],
  },
  commands: [
    skillEditarCommand,
  ],
}
