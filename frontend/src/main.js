import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

import { useAuthStore } from './stores/auth.js'

import './composables/commands/iniciarNavegador.js'
import './composables/commands/nuevaFuncionalidad.js'
import './composables/commands/documentacionAll.js'
import './composables/commands/documentacionUpdate.js'
import './composables/commands/gastosAll.js'
import './composables/commands/gastosProyecto.js'
import './composables/commands/arbolDirectorios.js'
import './composables/commands/funcionalidadesListar.js'
import './composables/commands/redmineTest.js'
import './composables/commands/redmineProyectos.js'
import './composables/commands/redmineTickets.js'
import './composables/commands/redmineImportarTickets.js'
import './composables/commands/git.js'
import './composables/commands/chatSetTicket.js'
import './composables/commands/chatGetTicket.js'
import './composables/commands/chatTicketEdit.js'
import './composables/commands/repoCrearRama.js'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const originalFetch = window.fetch.bind(window)
window.fetch = async function (url, options = {}) {
  const res = await originalFetch(url, options)
  if (res.status === 401) {
    const urlStr = (typeof url === 'string' ? url : url.url) || ''
    if (!urlStr.includes('/api/auth/')) {
      const auth = useAuthStore()
      if (auth.user) {
        auth.user = null
        router.push('/')
      }
    }
  }
  return res
}

app.mount('#app')
