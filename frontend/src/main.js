import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

import './composables/commands/iniciarNavegador.js'
import './composables/commands/nuevaFuncionalidad.js'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
