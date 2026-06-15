<template>
  <nav class="navbar navbar-dark bg-dark px-3">
    <span class="navbar-brand mb-0 h1">Agent Orchestrator</span>
    <CommandInput v-if="user" />
    <div class="dropdown" v-if="user">
      <button class="btn btn-dark dropdown-toggle" data-bs-toggle="dropdown">
        {{ user.username }}
      </button>
      <ul class="dropdown-menu dropdown-menu-end">
        <li><router-link class="dropdown-item" to="/settings">Configuración</router-link></li>
        <li><hr class="dropdown-divider" /></li>
        <li><a class="dropdown-item" href="#" @click.prevent="logout">Cerrar sesión</a></li>
      </ul>
    </div>
  </nav>
</template>

<script>
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '../stores/auth.js'
import { useRouter } from 'vue-router'
import { useCommandStore } from '../stores/command.js'
import { useModalStore } from '../stores/modal.js'
import { useCommandRegistry } from '../composables/useCommandRegistry.js'
import { useChatStore } from '../stores/chat.js'
import CommandInput from './CommandInput.vue'
import HelpContent from './HelpModal.vue'

export default {
  components: { CommandInput },
  setup() {
    const auth = useAuthStore()
    const cmdStore = useCommandStore()
    const chatStore = useChatStore()
    const modal = useModalStore()
    const { user } = storeToRefs(auth)
    const { register } = useCommandRegistry()
    const router = useRouter()

    register({
      name: '/help',
      category: 'Sistema',
      description: 'Muestra esta ayuda general de comandos, organizada por categoría.',
      usage: '/help',
      async execute(args, { cmdStore }) {
        modal.open(HelpContent, {})
      },
    })

    register({
      name: '/cd',
      category: 'Navegación',
      description: 'Cambia el directorio de trabajo. Soporta rutas absolutas, relativas, ".", "..", "~" y autocompletado con Tab.',
      usage: '/cd &lt;ruta&gt;',
      autocomplete(args, cmdStore) {
        const last = args.length > 0 ? args[args.length - 1] : ''
        const prefix = last.startsWith('/') || last.startsWith('~') ? last : '/'
        cmdStore.fetchAutocomplete(prefix, cmdStore.currentDir)
      },
      async execute(args, { cmdStore, chatStore }) {
        const dir = args.join(' ')
        if (!dir) {
          console.error('Error en /cd: debe especificar un directorio')
          return
        }
        const sessionId = chatStore.activeSessionId
        try {
          const res = await fetch('/api/command/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ command: `/cd ${dir}`, sessionId }),
          })
          const data = await res.json()
          if (data.success) {
            cmdStore.currentDir = data.result
          } else {
            console.error('Error en /cd:', data.result)
          }
          if (sessionId) chatStore.loadMessages(sessionId)
        } catch (err) {
          console.error('Error en /cd:', err)
        }
      },
    })

    register({
      name: '/ls',
      category: 'Navegación',
      description: 'Lista el contenido del directorio actual o del especificado.',
      usage: '/ls [ruta]',
      autocomplete(args, cmdStore) {
        const last = args.length > 0 ? args[args.length - 1] : ''
        const prefix = last.startsWith('/') || last.startsWith('~') ? last : ''
        if (!prefix && !cmdStore.currentDir) return
        cmdStore.fetchAutocomplete(prefix || cmdStore.currentDir, cmdStore.currentDir)
      },
      async execute(args, { cmdStore, chatStore }) {
        const dir = args.join(' ')
        const sessionId = chatStore.activeSessionId
        try {
          const res = await fetch('/api/command/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ command: `/ls ${dir}`, sessionId }),
          })
          const data = await res.json()
          if (!data.success) console.error('Error en /ls:', data.result)
          if (sessionId) chatStore.loadMessages(sessionId)
        } catch (err) {
          console.error('Error en /ls:', err)
        }
      },
    })

    register({
      name: '/history',
      category: 'Sistema',
      description: 'Muestra el historial de comandos ejecutados durante la sesión actual.',
      usage: '/history',
      async execute(args, { cmdStore, chatStore }) {
        const sessionId = chatStore.activeSessionId
        if (!sessionId) {
          console.error('Error en /history: no hay sesión de chat activa')
          return
        }
        try {
          const res = await fetch('/api/command/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ command: '/history', sessionId }),
          })
          const data = await res.json()
          if (!data.success) {
            console.error('Error en /history:', data.result)
          }
          chatStore.loadMessages(sessionId)
        } catch (err) {
          console.error('Error en /history:', err)
        }
      },
    })

    onMounted(() => {
      cmdStore.loadLastDirectory()
    })

    function logout() {
      auth.logout()
      router.push('/')
    }

    return { user, logout }
  },
}
</script>
