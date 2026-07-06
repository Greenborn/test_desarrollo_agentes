import skillsRoutes from './skills.routes.js'

export default {
  id: 'skills',
  name: 'Skills',
  routes: [
    { path: '/api/skills', router: skillsRoutes },
  ],
}
