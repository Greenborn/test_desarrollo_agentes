<template>
  <nav class="navbar navbar-dark bg-dark px-3">
    <span class="navbar-brand mb-0 h1">Agent Orchestrator</span>
    <CommandInput v-if="user" />
    <div class="dropdown" v-if="user">
      <button class="btn btn-dark dropdown-toggle" data-bs-toggle="dropdown">
        {{ user.username }}
      </button>
      <ul class="dropdown-menu dropdown-menu-end dropdown-menu-dark">
        <li><router-link class="dropdown-item" to="/settings">Configuración</router-link></li>
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
import { useOpencodeStore } from '../stores/opencode.js'
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
    const ocStore = useOpencodeStore()
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
          const body = { comando: 'start', parametros: { navegador } }
          if (url) body.parametros.url = url
          const res = await fetch('/api/navegador/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
          })
          const data = await res.json()
          if (data.error) {
            console.error('Error en /iniciar_navegador:', data.error)
            if (sessionId) {
              chatStore.messages.push({ role: 'opencode_info', content: JSON.stringify({ type: 'error', message: data.error }), _key: 'err-' + Date.now() })
            }
          } else {
            navegadorSessionId.value = data.id_session
            if (sessionId) {
              const msg = `Navegador "${navegador}" iniciado. Sesión: ${data.id_session}\nHeadless: ${data.headless ? 'Sí' : 'No'}`
              chatStore.messages.push({ role: 'opencode_result', content: msg + (data.url ? `\nURL: ${data.url}` : ''), _key: 'nav-' + Date.now() })
            }
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
          const res = await fetch('/api/navegador/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ comando: 'go_to_url', parametros: { id_session: navegadorSessionId.value, url } }),
          })
          const data = await res.json()
          if (data.error) {
            console.error('Error en /navegador_go_to:', data.error)
            if (sessionId) {
              chatStore.messages.push({ role: 'opencode_info', content: JSON.stringify({ type: 'error', message: data.error }), _key: 'err-' + Date.now() })
            }
          } else {
            if (data.id_session) navegadorSessionId.value = data.id_session
            if (sessionId) {
              chatStore.messages.push({ role: 'opencode_result', content: `Navegó a: ${url}`, _key: 'nav-' + Date.now() })
            }
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
        const headless = val === '1'
        const sessionId = chatStore.activeSessionId
        try {
          const res = await fetch('/api/navegador/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ comando: 'set_headless', parametros: { headless: val } }),
          })
          const data = await res.json()
          if (data.error) {
            console.error('Error en /navegador_set_headless:', data.error)
          } else {
            if (data.id_session) navegadorSessionId.value = data.id_session
            if (sessionId) {
              const msg = data.reiniciado
                ? `Modo headless cambiado a ${headless ? '1' : '0'}. Navegador reiniciado. Nueva sesión: ${data.id_session}`
                : `Modo headless por defecto: ${headless ? '1 (headless)' : '0 (visible)'}`
              chatStore.messages.push({ role: 'opencode_result', content: msg, _key: 'nav-' + Date.now() })
            }
          }
        } catch (err) {
          console.error('Error en /navegador_set_headless:', err)
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
