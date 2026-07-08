<template>
  <nav class="navbar navbar-dark px-2 gap-1" style="background: #1a2744; border-bottom: 2px solid #75AADB;">
    <a class="navbar-brand mb-0 h1 text-decoration-none flex-shrink-0" href="#" @click.prevent="openWorkspaceSwitcher">
      <span v-for="(ws, i) in selectedWorkspaces" :key="ws.id" class="d-inline-flex align-items-center">
        <span v-if="i > 0" class="mx-1 text-secondary" style="font-size: 0.6rem;">▸</span>
        <span class="badge" :style="{ ...workspaceBadgeStyle(ws), fontSize: '0.7rem' }">{{ ws.name }}</span>
      </span>
      <span v-if="selectedWorkspaces.length === 0" class="text-muted small">Agent Orchestrator</span>
    </a>
    <LayoutControls />
    <TicketInfoBar v-if="user" class="flex-grow-1" />
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
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '../../stores/auth.js'
import { useRouter } from 'vue-router'
import { useCommandStore } from '../../stores/command.js'
import { useModalStore } from '../../stores/modal.js'
import { useOpencodeStore } from '../../stores/opencode.js'
import { useBrowserStore } from '../../stores/browser.js'
import { useCommandRegistry } from '../../composables/useCommandRegistry.js'
import { parseCommandArgs, getUsedFlags } from '../../composables/parseCommandArgs.js'
import { useChatStore } from '../../stores/chat.js'
import { useWorkspaceStore } from '../../stores/workspace.js'
import { contrastTextColor } from '../../utils/color.js'
import wsClient from '../../services/wsClient.js'
import TicketInfoBar from '../chat/TicketInfoBar.vue'
import LayoutControls from './LayoutControls.vue'
import HelpContent from '../help/HelpModal.vue'
import CrearProyectoModal from '../projects/CrearProyectoModal.vue'
import WorkspaceSwitcherModal from '../modals/WorkspaceSwitcherModal.vue'
import SettingsView from '../../views/SettingsView.vue'

export default {
  components: { TicketInfoBar, LayoutControls },
  setup() {
    const auth = useAuthStore()
    const cmdStore = useCommandStore()
    const chatStore = useChatStore()
    const modal = useModalStore()
    const ocStore = useOpencodeStore()
    const wsStore = useWorkspaceStore()
    const browserStore = useBrowserStore()
    const { user } = storeToRefs(auth)
    const { workspaces } = storeToRefs(wsStore)
    const { register } = useCommandRegistry()

    const selectedWorkspaces = computed(() => {
      if (!auth.user || !workspaces.value.length) return []
      const ids = auth.getWorkspaceIds()
      return workspaces.value.filter(w => ids.includes(w.id))
    })

    function workspaceBadgeStyle(ws) {
      const bg = ws.color || '#75AADB'
      return { backgroundColor: bg, color: contrastTextColor(bg) }
    }

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
      name: '/ls',
      category: 'Navegación',
      description: 'Lista el contenido del directorio actual o del especificado.',
      usage: '/ls [--dir=&lt;ruta&gt;]',
      autocomplete(args, cmdStore) {
        const dirArg = args.find(a => a.startsWith('--dir='))
        if (dirArg) {
          const prefix = dirArg.slice('--dir='.length) || '/'
          cmdStore.fetchAutocomplete(prefix, cmdStore.currentDir)
        } else {
          cmdStore.showAutocomplete(['--dir='])
        }
      },
      async execute(args, { cmdStore, chatStore, sessionId }) {
        const { params } = parseCommandArgs(args, { dir: { required: false } })
        const dir = params.dir || ''
        try {
          const res = await fetch('/api/command/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ command: `/ls ${dir}`.trimEnd(), sessionId }),
          })
          const data = await res.json()
          if (!data.success) {
            console.error('Error en /ls:', data.result)
            return data.result
          }
          return data.result
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
      async execute(args, { cmdStore, chatStore, sessionId }) {
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
            return data.result
          }
          return data.result
        } catch (err) {
          console.error('Error en /history:', err)
        }
      },
    })

    register({
      name: '/dev_opencode_iniciar',
      category: 'Desarrollo',
      description: 'Abre opencode (CLI interactivo) en una terminal dentro del directorio del proyecto asociado a la sesión.',
      usage: '/dev_opencode_iniciar',
      autocomplete: null,
      async execute(args, { chatStore, sessionId }) {
        if (!sessionId) {
          console.error('Error en /dev_opencode_iniciar: no hay sesión de chat activa')
          return
        }

        const session = chatStore.sessions.find(s => Number(s.id) === Number(sessionId))
        const cwd = session?.cwd || ''
        if (!cwd) {
          return {
            role: 'opencode_control',
            controlData: {
              controlType: 'cd_selector',
              controlId: 'cd-' + Date.now(),
              currentDir: '/',
            },
          }
        }

        chatStore.openTerminal({ cwd, initCommand: 'opencode', label: 'OpenCode', sessionId })

        return `✅ OpenCode iniciado en: ${cwd}`
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
      name: '/navegador_ir_url',
      category: 'Navegador',
      description: 'Navega a una URL en la sesión de navegador activa.',
      usage: '/navegador_ir_url --url=&lt;url&gt;',
      async autocomplete(args, cmdStore) {
        const usedFlags = getUsedFlags(args)
        const suggestions = ['--url='].filter(f => !usedFlags.includes(f))
        if (suggestions.length > 0) {
          cmdStore.showAutocomplete(suggestions)
        } else {
          cmdStore.hideAutocomplete()
        }
      },
      async execute(args, { cmdStore, chatStore, sessionId }) {
        const { params, errors } = parseCommandArgs(args, { url: { required: true } })
        if (errors.length > 0) {
          console.error('Error en /navegador_ir_url:', errors.join('. '))
          return
        }
        const url = params.url
        try {
          const res = await navegadorFetch('go_to_url', { id_session: browserStore.navegadorSessionId, url }, sessionId)
          const data = await res.json()
          if (data.error) {
            console.error('Error en /navegador_ir_url:', data.error)
            return `Error: ${data.error}`
          }
          if (data.id_session) browserStore.navegadorSessionId = data.id_session
          return `Navegando a: ${url}`
        } catch (err) {
          console.error('Error en /navegador_ir_url:', err)
        }
      },
    })

    register({
      name: '/navegador_configurar_headless',
      category: 'Navegador',
      description: 'Cambia el modo headless del navegador (0 = visible, 1 = headless). Si hay sesión activa, la reinicia.',
      usage: '/navegador_configurar_headless --mode=&lt;0|1&gt;',
      autocomplete(args, cmdStore) {
        const usedFlags = getUsedFlags(args)
        const modeInUse = usedFlags.includes('--mode=') || usedFlags.includes('--mode')
        if (modeInUse) {
          const modeArg = args.find(a => a.startsWith('--mode='))
          const val = modeArg ? modeArg.slice('--mode='.length) : ''
          if (val === '0' || val === '1') {
            cmdStore.hideAutocomplete()
          } else {
            const filtered = ['0', '1'].filter(v => v.startsWith(val))
            if (filtered.length > 0) {
              cmdStore.showAutocomplete(filtered.map(v => ({ display: v === '0' ? '0 (visible)' : '1 (headless)', value: `--mode=${v}` })))
            } else {
              cmdStore.hideAutocomplete()
            }
          }
        } else {
          cmdStore.showAutocomplete(['--mode='])
        }
      },
      async execute(args, { cmdStore, chatStore, sessionId }) {
        const { params, errors } = parseCommandArgs(args, { mode: { required: true } })
        if (errors.length > 0) {
          console.error('Error en /navegador_configurar_headless:', errors.join('. '))
          return
        }
        const val = params.mode
        if (val !== '0' && val !== '1') {
          console.error('Error en /navegador_configurar_headless: use --mode=0 (visible) o --mode=1 (headless)')
          return
        }
        try {
          const res = await navegadorFetch('set_headless', { headless: val }, sessionId)
          const data = await res.json()
          if (data.error) {
            console.error('Error en /navegador_configurar_headless:', data.error)
            return `Error: ${data.error}`
          }
          if (data.id_session) browserStore.navegadorSessionId = data.id_session
          return `Headless ${val === '1' ? 'activado' : 'desactivado'}`
        } catch (err) {
          console.error('Error en /navegador_configurar_headless:', err)
        }
      },
    })

    register({
      name: '/navegador_finalizar',
      category: 'Navegador',
      description: 'Finaliza la sesión de navegador activa. Si no hay sesión iniciada, muestra error.',
      usage: '/navegador_finalizar',
      async execute(args, { cmdStore, chatStore, sessionId }) {
        if (!browserStore.navegadorSessionId) {
          console.error('Error en /navegador_finalizar: no hay sesión de navegador activa')
          return 'Error: No hay sesión de navegador activa. Usá /navegador_iniciar primero.'
        }
        try {
          const res = await fetch('/api/navegador/finish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id_session: browserStore.navegadorSessionId, sessionId }),
          })
          const data = await res.json()
          if (data.error) {
            console.error('Error en /navegador_finalizar:', data.error)
            return `Error: ${data.error}`
          }
          browserStore.navegadorSessionId = null
          return 'Sesión de navegador finalizada.'
        } catch (err) {
          console.error('Error en /navegador_finalizar:', err)
        }
      },
    })

    register({
      name: '/dev_opencode_finalizar',
      category: 'Desarrollo',
      description: 'Finaliza la sesión OpenCode activa.',
      usage: '/dev_opencode_finalizar',
      async execute(args, { cmdStore, chatStore, sessionId }) {
        try {
          await fetch('/api/opencode/finish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ ocSessionId: ocStore.ocSessionId, sessionId }),
          })
        } catch (err) {
          console.error('Error en /dev_opencode_finalizar:', err)
        }
        ocStore.finish()

        try {
          const sessionRes = await fetch(`/api/proyecto/session/${chatStore.activeSessionId}`, { credentials: 'include' })
          const sessionData = await sessionRes.json()
          if (sessionData.proyectoId) {
            const auth = useAuthStore()
            const consoleVars = ['NAVEGADOR_CONSOLE_ERRORS', 'NAVEGADOR_CONSOLE_WARNS', 'NAVEGADOR_CONSOLE_LOGS', 'NAVEGADOR_NETWORK_ERRORS']
            for (const varKey of consoleVars) {
              try {
                await wsClient.send('proyectoVarActualizar', {
                  sessionToken: auth.getSessionToken(),
                  proyectoId: sessionData.proyectoId,
                  key: varKey,
                  value: '{}',
                })
              } catch (err) {
                console.error(`Error al limpiar ${varKey}:`, err.message)
              }
            }
          }
        } catch (err) {
          console.error('Error al limpiar variables de consola:', err.message)
        }

        return 'Sesión OpenCode finalizada.'
      },
    })

    register({
      name: '/chat_set_proyecto',
      category: 'Proyecto',
      description: 'Asigna un proyecto a la sesión actual, o crea uno nuevo si se invoca sin parámetros.',
      usage: '/chat_set_proyecto [--id=&lt;id_proyecto&gt;]',
      async autocomplete(args, cmdStore) {
        const usedFlags = getUsedFlags(args)
        const idInUse = usedFlags.includes('--id=') || usedFlags.includes('--id')
        if (idInUse) {
          const idArg = args.find(a => a.startsWith('--id='))
          const val = idArg ? idArg.slice('--id='.length) : ''
          try {
            const res = await fetch('/api/proyecto', { credentials: 'include' })
            const data = await res.json()
            if (data.proyectos) {
              const prefix = val.toLowerCase()
              const filtered = data.proyectos.filter(p => p.id.toLowerCase().includes(prefix))
              if (val && filtered.length === 1 && filtered[0].id === val) {
                cmdStore.hideAutocomplete()
              } else {
                cmdStore.showAutocomplete(filtered.map(p => ({ display: p.id, value: `--id=${p.id}` })))
              }
            }
          } catch (err) {
            console.error('Error en autocomplete de /chat_set_proyecto:', err)
          }
        } else {
          cmdStore.showAutocomplete(['--id='])
        }
      },
      async execute(args, { cmdStore, chatStore, sessionId }) {
        if (!sessionId) {
          console.error('Error en /chat_set_proyecto: no hay sesión de chat activa')
          return
        }
        const { params } = parseCommandArgs(args, { id: { required: false } })
        const proyectoId = params.id
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
          if (data.success) {
            if (data.workspaceIds) {
              wsStore.selectedIds = data.workspaceIds
              auth.setWorkspaceIds(data.workspaceIds)
            }
            await chatStore.loadSessions()
            return `Proyecto "${proyectoId}" seleccionado.`
          }
          return `Error: ${data.error}`
        } catch (err) {
          console.error('Error en /chat_set_proyecto:', err)
        }
      },
    })

    register({
      name: '/chat_get_proyecto',
      category: 'Proyecto',
      description: 'Muestra el ID del proyecto asignado a la sesión actual.',
      usage: '/chat_get_proyecto',
      async execute(args, { cmdStore, chatStore, sessionId }) {
        if (!sessionId) {
          console.error('Error en /chat_get_proyecto: no hay sesión de chat activa')
          return
        }
        try {
          const res = await fetch(`/api/proyecto/session/${sessionId}`, { credentials: 'include' })
          const data = await res.json()
          return data.proyectoId ? `Proyecto actual: ${data.proyectoId}` : 'No hay proyecto asignado a esta sesión.'
        } catch (err) {
          console.error('Error en /chat_get_proyecto:', err)
        }
      },
    })

    register({
      name: '/chat_set_repositorio',
      category: 'Proyecto',
      description: 'Asigna una URL de repositorio GitHub al proyecto actual de la sesión.',
      usage: '/chat_set_repositorio --url=<url>',
      async autocomplete(args, cmdStore) {
        const usedFlags = getUsedFlags(args)
        const suggestions = ['--url='].filter(f => !usedFlags.includes(f))
        if (suggestions.length > 0) {
          cmdStore.showAutocomplete(suggestions)
        } else {
          cmdStore.hideAutocomplete()
        }
      },
      async execute(args, { cmdStore, chatStore, sessionId }) {
        if (!sessionId) {
          console.error('Error en /chat_set_repositorio: no hay sesión de chat activa')
          return
        }
        const session = chatStore.sessions.find(s => s.id === sessionId)
        const proyectoId = session?.proyecto_id
        if (!proyectoId) {
          return 'No hay proyecto asignado a esta sesión. Use /chat_set_proyecto primero.'
        }
        const urlArg = args.find(a => a.startsWith('--url='))
        if (!urlArg) {
          return 'Uso: /chat_set_repositorio --url=<url>'
        }
        const url_github = urlArg.slice('--url='.length)
        if (!url_github) {
          return 'La URL no puede estar vacía.'
        }
        try {
          const res = await fetch('/api/proyecto/repositorio', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ proyectoId, url_github }),
          })
          const data = await res.json()
          if (data.success) {
            return `URL de repositorio configurada para "${proyectoId}": ${url_github}`
          }
          return `Error: ${data.error}`
        } catch (err) {
          console.error('Error en /chat_set_repositorio:', err)
        }
      },
    })

    register({
      name: '/chat_get_repositorio_url',
      category: 'Proyecto',
      description: 'Muestra la URL del repositorio configurada para el proyecto actual.',
      usage: '/chat_get_repositorio_url',
      async execute(args, { cmdStore, chatStore, sessionId }) {
        if (!sessionId) {
          console.error('Error en /chat_get_repositorio_url: no hay sesión de chat activa')
          return
        }
        const session = chatStore.sessions.find(s => s.id === sessionId)
        const proyectoId = session?.proyecto_id
        if (!proyectoId) {
          return 'No hay proyecto asignado a esta sesión. Use /chat_set_proyecto primero.'
        }
        try {
          const res = await fetch(`/api/proyecto/repositorio/${encodeURIComponent(proyectoId)}`, { credentials: 'include' })
          const data = await res.json()
          if (data.url_github) {
            return `URL del repositorio de "${proyectoId}": ${data.url_github}`
          }
          return `No hay URL de repositorio configurada para "${proyectoId}".`
        } catch (err) {
          console.error('Error en /chat_get_repositorio_url:', err)
        }
      },
    })

    function openSettings() {
      modal.open(SettingsView, {}, { title: 'Configuración', wide: true })
    }

    function openWorkspaceSwitcher() {
      modal.open(WorkspaceSwitcherModal, {}, { title: 'Espacios de Trabajo' })
    }

    onMounted(() => {
      cmdStore.loadLastDirectory()
      wsStore.loadWorkspaces()
    })

    function logout() {
      auth.logout()
      router.push('/')
    }

    return { user, logout, openSettings, openWorkspaceSwitcher, selectedWorkspaces, workspaceBadgeStyle }
  },
}
</script>
