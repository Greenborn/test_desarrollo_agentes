import ollamaRoutes from './ollama.routes.js'

export default {
  id: 'ollama',
  name: 'Ollama',
  routes: [
    { path: '/api/ollama', router: ollamaRoutes },
  ],
}
