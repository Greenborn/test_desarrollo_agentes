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
import './composables/commands/documentacionNotas.js'
import './composables/commands/gastosAll.js'
import './composables/commands/gastosProyecto.js'
import './composables/commands/cd.js'
import './composables/commands/arbolDirectorios.js'
import './composables/commands/funcionalidadesListar.js'
import './composables/commands/redmineTest.js'
import './composables/commands/redmineProyectos.js'
import './composables/commands/redmineTickets.js'
import './composables/commands/redmineImportarTickets.js'
import './composables/commands/redmineImportarProyectos.js'
import './composables/commands/git.js'
import './composables/commands/chatSetTicket.js'
import './composables/commands/chatSetWorkspace.js'
import './composables/commands/chatGetTicket.js'
import './composables/commands/chatTicketEdit.js'
import './composables/commands/redmineCrearTicket.js'
import './composables/commands/repoCrearRama.js'
import './composables/commands/generarCommit.js'
import './composables/commands/despliegue.js'
import './composables/commands/extraerFormularios.js'
import './composables/commands/navegadorEventosIniciar.js'
import './composables/commands/navegadorEventosDetener.js'
import './composables/commands/resolucionesGetAll.js'
import './composables/commands/resolucionGetDefault.js'
import './composables/commands/resolucionSetDefault.js'
import './composables/commands/templates.js'
import './composables/commands/redmineComentariosListar.js'
import './composables/commands/redmineComentariosEnviar.js'
import './composables/commands/chatTicketComentar.js'
import './composables/commands/proyectoVarListar.js'
import './composables/commands/proyectoVarCrear.js'
import './composables/commands/proyectoVarActualizar.js'
import './composables/commands/proyectoVarEliminar.js'
import './composables/commands/ambientesListar.js'
import './composables/commands/ambientesMerge.js'
import './composables/commands/ambientesDiff.js'
import './composables/commands/ambientesDiffComentar.js'
import './composables/commands/navegadorGrabacionObtener.js'
import './composables/commands/navegadorGrabacionAcciones.js'
import './composables/commands/navegadorGrabacionListar.js'
import './composables/commands/navegadorGrabacionReproducir.js'
import './composables/commands/deteccionFuncionalidades.js'
import './composables/commands/comandosPersonalizados.js'
import './composables/commands/peticion.js'
import './composables/commands/archivosListar.js'
import './composables/commands/archivosEliminar.js'
import './composables/commands/navegadorCapturarPantalla.js'
import './composables/commands/capturasListar.js'
import './composables/commands/navegadorEvaluarSelector.js'
import './composables/commands/navegadorSimularEvento.js'
import './composables/commands/terminalToggle.js'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const originalFetch = window.fetch.bind(window)
window.fetch = async function (url, options = {}) {
  const auth = useAuthStore()
  const token = auth.getSessionToken()
  if (token) {
    options = { ...options }
    options.headers = options.headers ? { ...options.headers } : {}
    options.headers['X-Session-Token'] = token
  }
  const res = await originalFetch(url, options)
  if (res.status === 401) {
    const urlStr = (typeof url === 'string' ? url : url.url) || ''
    if (!urlStr.includes('/api/auth/')) {
      if (auth.user) {
        auth.forceLogout()
        router.push('/')
      }
    }
  }
  return res
}

app.mount('#app')
