<template>
  <nav class="navbar navbar-dark px-3" style="background: #1a2744; border-bottom: 2px solid #75AADB;">
    <router-link class="navbar-brand mb-0 h1 text-decoration-none" to="/">{{ workspaceName }}</router-link>
    <LayoutControls />
    <CommandInput v-if="user" />
    <div class="dropdown" v-if="user">
      <button class="btn btn-dark dropdown-toggle" data-bs-toggle="dropdown">
        {{ user.username }}
      </button>
      <ul class="dropdown-menu dropdown-menu-end dropdown-menu-dark">
        <li><a class="dropdown-item" href="#" @click.prevent="openSettings">Configuración</a></li>
        <li><hr class="dropdown-divider" /></li>
        <li><a class="dropdown-item" href="#" @click.prevent="logout">Cerrar sesión</a></li>
      </ul>
    </div>
  </nav>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '../stores/auth.js'
import { useRouter } from 'vue-router'
import { useCommandStore } from '../stores/command.js'
import { useModalStore } from '../stores/modal.js'
import { useOpencodeStore } from '../stores/opencode.js'
import { useCommandRegistry } from '../composables/useCommandRegistry.js'
import { useChatStore } from '../stores/chat.js'
import { useWorkspaceStore } from '../stores/workspace.js'
import CommandInput from './CommandInput.vue'
import LayoutControls from './LayoutControls.vue'
import HelpContent from './HelpModal.vue'
import CrearProyectoModal from './CrearProyectoModal.vue'
import SettingsView from '../views/SettingsView.vue'

export default {
  components: { CommandInput, LayoutControls },
  setup() {
    const auth = useAuthStore()
    const cmdStore = useCommandStore()
    const chatStore = useChatStore()
    const modal = useModalStore()
    const ocStore = useOpencodeStore()
    const wsStore = useWorkspaceStore()
    const { user } = storeToRefs(auth)
    const { workspaces } = storeToRefs(wsStore)
    const { register } = useCommandRegistry()

    const workspaceName = computed(() => {
      if (!auth.user) return 'Agent Orchestrator'
      const ws = workspaces.value.find(w => w.id === auth.user.workspaceId)
      return ws ? ws.name : 'Por Defecto'
    })
    const router = useRouter()
    const navegadorSessionId = ref(null)

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
        const prefix = last ? last : '/'
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
        if (last) {
          cmdStore.fetchAutocomplete(last, cmdStore.currentDir)
        } else if (cmdStore.currentDir) {
          cmdStore.fetchAutocomplete(cmdStore.currentDir, cmdStore.currentDir)
        }
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

    register({
      name: '/opencode',
      category: 'OpenCode',
      description: 'Inicia una sesión con OpenCode: seleccionar proveedor, modelo, modo y enviar prompt.',
      usage: '/opencode',
      async execute(args, { cmdStore, chatStore }) {
        const sessionId = chatStore.activeSessionId
        if (!sessionId) {
          console.error('Error en /opencode: no hay sesión de chat activa')
          return
        }

        if (ocStore.ocSessionId) {
          chatStore.messages.push({
            role: 'opencode_info',
            content: JSON.stringify({ type: 'info', message: 'OpenCode ya está activo en esta sesión. Escribí tu mensaje directamente o usá /opencode_fin para terminar la sesión.' }),
            _key: 'info-' + Date.now(),
          })
          return
        }

        const data = await ocStore.start()
        if (!data) return

        const providerList = ocStore.getAvailableProviders()
        if (providerList.length === 0) {
          console.error('Error en /opencode: no se encontraron proveedores')
          return
        }

        const preselectProvider = ocStore.savedProvider || providerList[0].value

        chatStore.messages.push({
          role: 'opencode_control',
          controlData: {
            controlId: 'provider-' + Date.now(),
            controlType: 'select',
            stepType: 'opencode_setup',
            subStepType: 'provider',
            options: providerList,
            placeholder: 'Selecciona proveedor...',
            preselect: preselectProvider,
          },
          _key: 'control-' + Date.now(),
        })
      },
    })

    function navegadorFetch(comando, parametros, sessionId) {
      return fetch('/api/navegador/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ comando, parametros, sessionId }),
      })
    }

    register({
      name: '/navegador_go_to',
      category: 'Navegador',
      description: 'Navega a una URL en la sesión de navegador activa.',
      usage: '/navegador_go_to &lt;url&gt;',
      async execute(args, { cmdStore, chatStore }) {
        const url = args.join('')
        if (!url) {
          console.error('Error en /navegador_go_to: debe especificar una URL')
          return
        }
        const sessionId = chatStore.activeSessionId
        try {
          const res = await navegadorFetch('go_to_url', { id_session: navegadorSessionId.value, url }, sessionId)
          const data = await res.json()
          if (data.error) {
            console.error('Error en /navegador_go_to:', data.error)
          } else {
            if (data.id_session) navegadorSessionId.value = data.id_session
            if (sessionId) chatStore.loadMessages(sessionId)
          }
        } catch (err) {
          console.error('Error en /navegador_go_to:', err)
        }
      },
    })

    register({
      name: '/navegador_set_headless',
      category: 'Navegador',
      description: 'Cambia el modo headless del navegador (0 = visible, 1 = headless). Si hay sesión activa, la reinicia.',
      usage: '/navegador_set_headless &lt;0|1&gt;',
      async execute(args, { cmdStore, chatStore }) {
        const val = args[0]
        if (val !== '0' && val !== '1') {
          console.error('Error en /navegador_set_headless: use 0 (visible) o 1 (headless)')
          return
        }
        const sessionId = chatStore.activeSessionId
        try {
          const res = await navegadorFetch('set_headless', { headless: val }, sessionId)
          const data = await res.json()
          if (data.error) {
            console.error('Error en /navegador_set_headless:', data.error)
          } else {
            if (data.id_session) navegadorSessionId.value = data.id_session
            if (sessionId) chatStore.loadMessages(sessionId)
          }
        } catch (err) {
          console.error('Error en /navegador_set_headless:', err)
        }
      },
    })

    register({
      name: '/navegador_fin',
      category: 'Navegador',
      description: 'Finaliza la sesión de navegador activa. Si no hay sesión iniciada, muestra error.',
      usage: '/navegador_fin',
      async execute(args, { cmdStore, chatStore }) {
        const sessionId = chatStore.activeSessionId
        if (!navegadorSessionId.value) {
          console.error('Error en /navegador_fin: no hay sesión de navegador activa')
          if (sessionId) {
            chatStore.messages.push({ role: 'result', content: 'Error: No hay sesión de navegador activa. Usá /iniciar_navegador primero.', _key: 'err-' + Date.now() })
          }
          return
        }
        try {
          const res = await fetch('/api/navegador/finish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id_session: navegadorSessionId.value, sessionId }),
          })
          const data = await res.json()
          if (data.error) {
            console.error('Error en /navegador_fin:', data.error)
          }
          navegadorSessionId.value = null
          if (sessionId) chatStore.loadMessages(sessionId)
        } catch (err) {
          console.error('Error en /navegador_fin:', err)
        }
      },
    })

    register({
      name: '/opencode_fin',
      category: 'OpenCode',
      description: 'Finaliza la sesión OpenCode activa.',
      usage: '/opencode_fin',
      async execute(args, { cmdStore, chatStore }) {
        try {
          await fetch('/api/opencode/finish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ ocSessionId: ocStore.ocSessionId, directory: cmdStore.currentDir || undefined }),
          })
        } catch (err) {
          console.error('Error en /opencode_fin:', err)
        }
        ocStore.finish()
        if (chatStore.activeSessionId) {
          chatStore.loadMessages(chatStore.activeSessionId)
        }
      },
    })

    register({
      name: '/proyecto_set',
      category: 'Proyecto',
      description: 'Asigna un proyecto a la sesión actual, o crea uno nuevo si se invoca sin parámetros.',
      usage: '/proyecto_set [id_proyecto]',
      async autocomplete(args, cmdStore) {
        try {
          const res = await fetch('/api/proyecto', { credentials: 'include' })
          const data = await res.json()
          if (data.proyectos) {
            cmdStore.showAutocomplete(data.proyectos.map((p) => p.id))
          }
        } catch (err) {
          console.error('Error en autocomplete de /proyecto_set:', err)
        }
      },
      async execute(args, { cmdStore, chatStore }) {
        const sessionId = chatStore.activeSessionId
        if (!sessionId) {
          console.error('Error en /proyecto_set: no hay sesión de chat activa')
          return
        }
        const proyectoId = args[0]
        if (!proyectoId) {
          modal.open(CrearProyectoModal, {}, { title: 'Nuevo Proyecto' })
          return
        }
        try {
          const res = await fetch('/api/proyecto/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ sessionId, proyectoId, cwd: cmdStore.currentDir || undefined }),
          })
          const data = await res.json()
          chatStore.messages.push({
            role: 'command',
            content: `/proyecto_set ${proyectoId}`,
            _key: 'cmd-' + Date.now(),
          })
          if (data.success) {
            chatStore.messages.push({
              role: 'result',
              content: `Proyecto "${proyectoId}" seleccionado.`,
              _key: 'res-' + Date.now(),
            })
          } else {
            chatStore.messages.push({
              role: 'result',
              content: `Error: ${data.error}`,
              _key: 'err-' + Date.now(),
            })
          }
        } catch (err) {
          console.error('Error en /proyecto_set:', err)
        }
      },
    })

    register({
      name: '/proyecto_info',
      category: 'Proyecto',
      description: 'Muestra el ID del proyecto asignado a la sesión actual.',
      usage: '/proyecto_info',
      async execute(args, { cmdStore, chatStore }) {
        const sessionId = chatStore.activeSessionId
        if (!sessionId) {
          console.error('Error en /proyecto_info: no hay sesión de chat activa')
          return
        }
        try {
          const res = await fetch(`/api/proyecto/session/${sessionId}`, { credentials: 'include' })
          const data = await res.json()
          chatStore.messages.push({
            role: 'command',
            content: '/proyecto_info',
            _key: 'cmd-' + Date.now(),
          })
          chatStore.messages.push({
            role: 'result',
            content: data.proyectoId ? `Proyecto actual: ${data.proyectoId}` : 'No hay proyecto asignado a esta sesión.',
            _key: 'res-' + Date.now(),
          })
        } catch (err) {
          console.error('Error en /proyecto_info:', err)
        }
      },
    })

    register({
      name: '/proyecto_set_repositorio',
      category: 'Proyecto',
      description: 'Asigna una URL de repositorio GitHub al proyecto actual de la sesión.',
      usage: '/proyecto_set_repositorio --url=<url>',
      async autocomplete(args, cmdStore) {
        if (!args.join(' ').includes('--url=')) {
          cmdStore.showAutocomplete(['--url='])
        }
      },
      async execute(args, { cmdStore, chatStore }) {
        const sessionId = chatStore.activeSessionId
        if (!sessionId) {
          console.error('Error en /proyecto_set_repositorio: no hay sesión de chat activa')
          return
        }
        const session = chatStore.sessions.find(s => s.id === sessionId)
        const proyectoId = session?.proyecto_id
        if (!proyectoId) {
          chatStore.messages.push({
            role: 'command',
            content: '/proyecto_set_repositorio',
            _key: 'cmd-' + Date.now(),
          })
          chatStore.messages.push({
            role: 'result',
            content: 'No hay proyecto asignado a esta sesión. Use /proyecto_set primero.',
            _key: 'res-' + Date.now(),
          })
          return
        }
        const urlArg = args.find(a => a.startsWith('--url='))
        if (!urlArg) {
          chatStore.messages.push({
            role: 'command',
            content: '/proyecto_set_repositorio',
            _key: 'cmd-' + Date.now(),
          })
          chatStore.messages.push({
            role: 'result',
            content: 'Uso: /proyecto_set_repositorio --url=<url>',
            _key: 'res-' + Date.now(),
          })
          return
        }
        const url_github = urlArg.slice('--url='.length)
        if (!url_github) {
          chatStore.messages.push({
            role: 'command',
            content: '/proyecto_set_repositorio ' + args.join(' '),
            _key: 'cmd-' + Date.now(),
          })
          chatStore.messages.push({
            role: 'result',
            content: 'La URL no puede estar vacía.',
            _key: 'res-' + Date.now(),
          })
          return
        }
        try {
          const res = await fetch('/api/proyecto/repositorio', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ proyectoId, url_github }),
          })
          const data = await res.json()
          chatStore.messages.push({
            role: 'command',
            content: `/proyecto_set_repositorio --url=${url_github}`,
            _key: 'cmd-' + Date.now(),
          })
          if (data.success) {
            chatStore.messages.push({
              role: 'result',
              content: `URL de repositorio configurada para "${proyectoId}": ${url_github}`,
              _key: 'res-' + Date.now(),
            })
          } else {
            chatStore.messages.push({
              role: 'result',
              content: `Error: ${data.error}`,
              _key: 'err-' + Date.now(),
            })
          }
        } catch (err) {
          console.error('Error en /proyecto_set_repositorio:', err)
        }
      },
    })

    register({
      name: '/proyecto_get_url_repo',
      category: 'Proyecto',
      description: 'Muestra la URL del repositorio configurada para el proyecto actual.',
      usage: '/proyecto_get_url_repo',
      async execute(args, { cmdStore, chatStore }) {
        const sessionId = chatStore.activeSessionId
        if (!sessionId) {
          console.error('Error en /proyecto_get_url_repo: no hay sesión de chat activa')
          return
        }
        const session = chatStore.sessions.find(s => s.id === sessionId)
        const proyectoId = session?.proyecto_id
        if (!proyectoId) {
          chatStore.messages.push({
            role: 'command',
            content: '/proyecto_get_url_repo',
            _key: 'cmd-' + Date.now(),
          })
          chatStore.messages.push({
            role: 'result',
            content: 'No hay proyecto asignado a esta sesión. Use /proyecto_set primero.',
            _key: 'res-' + Date.now(),
          })
          return
        }
        try {
          const res = await fetch(`/api/proyecto/repositorio/${encodeURIComponent(proyectoId)}`, { credentials: 'include' })
          const data = await res.json()
          chatStore.messages.push({
            role: 'command',
            content: '/proyecto_get_url_repo',
            _key: 'cmd-' + Date.now(),
          })
          if (data.url_github) {
            chatStore.messages.push({
              role: 'result',
              content: `URL del repositorio de "${proyectoId}": ${data.url_github}`,
              _key: 'res-' + Date.now(),
            })
          } else {
            chatStore.messages.push({
              role: 'result',
              content: `No hay URL de repositorio configurada para "${proyectoId}".`,
              _key: 'res-' + Date.now(),
            })
          }
        } catch (err) {
          console.error('Error en /proyecto_get_url_repo:', err)
        }
      },
    })

    function openSettings() {
      modal.open(SettingsView, {}, { title: 'Configuración', wide: true })
    }

    onMounted(() => {
      cmdStore.loadLastDirectory()
      wsStore.loadWorkspaces()
    })

    function logout() {
      auth.logout()
      router.push('/')
    }

    return { user, logout, openSettings, workspaceName }
  },
}
</script>
