<template>
  <div class="xterm-wrapper" ref="wrapperRef">
    <div class="xterm-toolbar">
      <span class="toolbar-title">{{ label }}</span>
      <div class="toolbar-actions">
        <button class="toolbar-btn" @click="toggleFullscreen" :title="fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'">
          {{ fullscreen ? '⛶' : '⛶' }}
        </button>
        <button class="toolbar-btn" @click="newTerminal" title="Nueva terminal">+</button>
        <button class="toolbar-btn" @click="disconnect" title="Cerrar terminal">✕</button>
      </div>
    </div>
    <div ref="containerRef" class="xterm-container"></div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

const PROCESOS_API = '/api/procesos'
const WS_PORT = import.meta.env.VITE_PROCESOS_CONSOLA_PORT || '3575'
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const TERMINAL_WS_HOST = `${WS_PROTOCOL}//${window.location.hostname}:${WS_PORT}`

export default {
  props: {
    label: { type: String, default: 'terminal' },
    cwd: { type: String, default: '' },
    initCommand: { type: String, default: '' },
    sessionId: { type: [String, Number], default: null },
    terminalId: { type: String, default: null },
  },
  emits: ['close', 'terminal-ready'],
  setup(props, { emit }) {
    const containerRef = ref(null)
    const wrapperRef = ref(null)
    const fullscreen = ref(false)
    let terminal = null
    let fitAddon = null
    let ws = null
    let resizeObserver = null
    let currentTerminalId = props.terminalId
    let closingIntentionally = false

    function fitTerminal() {
      if (!fitAddon || !terminal) return
      try {
        fitAddon.fit()
        if (ws && ws.readyState === WebSocket.OPEN) {
          const dims = { cols: terminal.cols, rows: terminal.rows }
          ws.send(JSON.stringify({ type: 'resize', ...dims }))
        }
      } catch (err) {
        console.log('[xterm] fit error:', err.message)
      }
    }

    async function createTerminalViaApi() {
      try {
        const res = await fetch(`${PROCESOS_API}/terminal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            chatSessionId: props.sessionId,
            cwd: props.cwd || undefined,
            cmd: props.initCommand || undefined,
          }),
        })
        if (!res.ok) {
          console.log('[xterm] Error al crear terminal:', res.status, await res.text())
          return null
        }
        const data = await res.json()
        currentTerminalId = data.terminalId
        return data.terminalId
      } catch (err) {
        console.log('[xterm] Error en petición REST:', err.message)
        return null
      }
    }

    async function closeTerminalViaApi(terminalId) {
      if (!terminalId) return
      try {
        await fetch(`${PROCESOS_API}/terminal/${terminalId}`, {
          method: 'DELETE',
          credentials: 'include',
        })
      } catch (err) {
        console.log('[xterm] Error al cerrar terminal vía API:', err.message)
      }
    }

    function connectWebSocket(terminalId) {
      if (!terminalId) return
      if (ws) {
        try { ws.close() } catch {}
        ws = null
      }

      currentTerminalId = terminalId
      const wsUrl = `${TERMINAL_WS_HOST}?terminalId=${terminalId}`
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('[xterm] terminal WebSocket conectado')
        terminal.focus()
        fitTerminal()
      }

      ws.onmessage = (event) => {
        let msg
        try {
          msg = JSON.parse(event.data)
        } catch {
          return
        }
        if (msg.type === 'data' && terminal) {
          terminal.write(msg.data)
        } else if (msg.type === 'exit' && terminal) {
          terminal.write(`\r\n\x1b[38;5;245m[proceso terminado: código ${msg.code}]\x1b[0m\r\n`)
        }
      }

      ws.onclose = () => {
        console.log('[xterm] terminal WebSocket desconectado')
        ws = null
        if (terminal) {
          terminal.write(`\r\n\x1b[38;5;245m[conexión terminada]\x1b[0m\r\n`)
        }
        if (!closingIntentionally) {
          emit('close')
        }
      }

      ws.onerror = (err) => {
        console.log('[xterm] terminal WebSocket error:', err.message || 'desconocido')
      }
    }

    function toggleFullscreen() {
      fullscreen.value = !fullscreen.value
      nextTick(() => fitTerminal())
    }

    async function newTerminal() {
      await closeTerminalViaApi(currentTerminalId)
      const tid = await createTerminalViaApi()
      if (tid) {
        currentTerminalId = tid
        connectWebSocket(tid)
        terminal.clear()
        emit('terminal-ready', { terminalId: tid })
      }
    }

    async function disconnect() {
      closingIntentionally = true
      await closeTerminalViaApi(currentTerminalId)
      if (ws) {
        try { ws.close() } catch {}
        ws = null
      }
      emit('close')
    }

    async function findOrCreateTerminal() {
      if (currentTerminalId && ws) return currentTerminalId

      if (currentTerminalId) {
        return currentTerminalId
      }

      try {
        const listRes = await fetch(`${PROCESOS_API}/terminal?chatSessionId=${props.sessionId}`, {
          credentials: 'include',
        })
        if (listRes.ok) {
          const list = await listRes.json()
          if (list.length > 0) {
            const existing = list.find((t) => t.status === 'active') || list[0]
            currentTerminalId = existing.terminalId
            return currentTerminalId
          }
        }
      } catch (err) {
        console.log('[xterm] Error al buscar terminales:', err.message)
      }

      const tid = await createTerminalViaApi()
      if (tid) currentTerminalId = tid
      return tid
    }

    onMounted(async () => {
      terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        fontSize: 13,
        fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
        lineHeight: 1.4,
        allowTransparency: true,
        convertEol: true,
        scrollback: 10000,
        theme: {
          background: '#0d1117',
          foreground: '#e6edf3',
          cursor: '#3fb950',
          cursorAccent: '#0d1117',
          selectionBackground: '#264f78',
          black: '#484f58',
          red: '#ff7b72',
          green: '#3fb950',
          yellow: '#d29922',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#39c5cf',
          white: '#e6edf3',
          brightBlack: '#6e7681',
          brightRed: '#ffa198',
          brightGreen: '#56d364',
          brightYellow: '#e3b341',
          brightBlue: '#79c0ff',
          brightMagenta: '#d2a8ff',
          brightCyan: '#56d4dd',
          brightWhite: '#ffffff',
        },
      })

      fitAddon = new FitAddon()
      terminal.loadAddon(fitAddon)
      terminal.open(containerRef.value)

      terminal.onData((data) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }))
        }
      })

      terminal.onResize(({ cols, rows }) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }))
        }
      })

      await nextTick()
      fitTerminal()

      resizeObserver = new ResizeObserver(() => fitTerminal())
      if (wrapperRef.value) {
        resizeObserver.observe(wrapperRef.value)
      }

      const sessionIdAtMount = props.sessionId
      const tid = await findOrCreateTerminal()
      if (tid) {
        connectWebSocket(tid)
        emit('terminal-ready', { terminalId: tid, sessionId: sessionIdAtMount })
      }
    })

    onUnmounted(() => {
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      if (ws) {
        try { ws.close() } catch {}
        ws = null
      }
      if (terminal) {
        terminal.dispose()
        terminal = null
      }
    })

    return { containerRef, wrapperRef, fullscreen, toggleFullscreen, newTerminal, disconnect }
  },
}
</script>

<style scoped>
.xterm-wrapper {
  border: 1px solid #30363d;
  border-radius: 8px;
  overflow: hidden;
  margin: 8px 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
}

.xterm-toolbar {
  background: #161b22;
  border-bottom: 1px solid #30363d;
  display: flex;
  align-items: center;
  padding: 4px 10px;
  gap: 8px;
}

.toolbar-title {
  color: #8b949e;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 0.75rem;
  flex: 1;
}

.toolbar-actions {
  display: flex;
  gap: 4px;
}

.toolbar-btn {
  background: none;
  border: 1px solid #30363d;
  border-radius: 4px;
  color: #8b949e;
  cursor: pointer;
  font-size: 0.8rem;
  line-height: 1;
  padding: 2px 6px;
}

.toolbar-btn:hover {
  background: #21262d;
  border-color: #58a6ff;
  color: #e6edf3;
}

.xterm-container {
  height: 400px;
  padding: 0;
  background: #0d1117;
}

.xterm-wrapper:fullscreen .xterm-container {
  height: 100vh;
}

.xterm-container :deep(.xterm) {
  height: 100%;
  padding: 0 8px;
}
</style>
