<template>
  <nav class="navbar navbar-dark px-3" style="background: #0f0f1e; border-bottom: 2px solid #75AADB;">
    <router-link class="navbar-brand mb-0 h1 text-decoration-none" to="/">Agent Orchestrator</router-link>
    <button class="btn btn-sm btn-outline-secondary border-0 me-1" style="color: #75AADB;" @click="toggleSidebar" title="Toggle sidebar">
      <svg v-if="sidebarCollapsed" width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M9.5 3.5a.5.5 0 0 0-.832-.374l-4.5 4.5a.5.5 0 0 0 0 .748l4.5 4.5A.5.5 0 0 0 9.5 12.5v-9z"/></svg>
      <svg v-else width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M6.5 12.5a.5.5 0 0 0 .832.374l4.5-4.5a.5.5 0 0 0 0-.748l-4.5-4.5A.5.5 0 0 0 6.5 3.5v9z"/></svg>
    </button>
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
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '../stores/auth.js'
import { useRouter } from 'vue-router'
import { useCommandStore } from '../stores/command.js'
import { useModalStore } from '../stores/modal.js'
import { useUiStore } from '../stores/ui.js'
import { useOpencodeStore } from '../stores/opencode.js'
import { useCommandRegistry } from '../composables/useCommandRegistry.js'
import { useChatStore } from '../stores/chat.js'
import CommandInput from './CommandInput.vue'
import HelpContent from './HelpModal.vue'
import CrearProyectoModal from './CrearProyectoModal.vue'
import SettingsView from '../views/SettingsView.vue'

export default {
  components: { CommandInput },
  setup() {
    const auth = useAuthStore()
    const cmdStore = useCommandStore()
    const chatStore = useChatStore()
    const modal = useModalStore()
    const ocStore = useOpencodeStore()
    const ui = useUiStore()
    const { user } = storeToRefs(auth)
    const { register } = useCommandRegistry()
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

    register({
      name: '/oc',
      category: 'OpenCode',
      description: 'Envía un prompt a la sesión OpenCode activa. Si no hay sesión, inicia una nueva.',
      usage: '/oc &lt;prompt&gt;',
      async execute(args, { cmdStore, chatStore }) {
        const prompt = args.join(' ')
        if (!prompt) {
          console.error('Error en /oc: debe especificar un prompt')
          return
        }
        const sessionId = chatStore.activeSessionId
        if (!sessionId) {
          console.error('Error en /oc: no hay sesión de chat activa')
          return
        }
        if (!ocStore.ocSessionId) {
          // No existing opencode session, start setup flow
          chatStore.messages.push({
            role: 'opencode_info',
            content: JSON.stringify({ type: 'info', message: 'No hay sesión OpenCode activa. Ejecutá /opencode primero.' }),
            _key: 'info-' + Date.now(),
          })
          return
        }
        // Send prompt to existing OpenCode session
        const streamMsg = {
          role: 'opencode_stream',
          content: '',
          streaming: true,
          _key: 'ocstream-' + Date.now(),
        }
        chatStore.messages.push(streamMsg)

        await ocStore.streamPrompt(sessionId, prompt, ocStore.selectedProvider, ocStore.selectedModel, ocStore.selectedThinking, ocStore.selectedMode, {
          onChunk(content, total) {
            streamMsg.content = total
          },
          onDone(json, fullText) {
            streamMsg.streaming = false
            streamMsg.role = 'opencode_result'
            streamMsg.content = json.fullResponse || fullText || '(sin respuesta)'
          },
          onError(msg) {
            streamMsg.content = `[Error: ${msg}]`
            streamMsg.streaming = false
          },
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
      name: '/iniciar_navegador',
      category: 'Navegador',
      description: 'Inicia una sesión de navegador web (chrome o firefox). Opcional: URL a navegar.',
      usage: '/iniciar_navegador [chrome|firefox] [url]',
      async execute(args, { cmdStore, chatStore }) {
        const navegador = args[0] || 'chrome'
        const url = args[1] || ''
        const sessionId = chatStore.activeSessionId
        try {
          const params = { navegador }
          if (url) params.url = url
          const res = await navegadorFetch('start', params, sessionId)
          const data = await res.json()
          if (data.error) {
            console.error('Error en /iniciar_navegador:', data.error)
          } else {
            navegadorSessionId.value = data.id_session
            if (sessionId) chatStore.loadMessages(sessionId)
          }
        } catch (err) {
          console.error('Error en /iniciar_navegador:', err)
        }
      },
    })

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

    function openSettings() {
      modal.open(SettingsView, {}, { title: 'Configuración' })
    }

    onMounted(() => {
      cmdStore.loadLastDirectory()
    })

    function logout() {
      auth.logout()
      router.push('/')
    }

    return { user, logout, openSettings, sidebarCollapsed: ui.sidebarCollapsed, toggleSidebar: ui.toggleSidebar }
  },
}
</script>
