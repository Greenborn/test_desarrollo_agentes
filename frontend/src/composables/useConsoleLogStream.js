import { ref, watch, onUnmounted } from 'vue'
import { useChatStore } from '../stores/chat.js'

const DEBOUNCE_MS = 2000
const RECONNECT_DELAY = 3000
const MAX_ERRORS_PER_BATCH = 50

export function useConsoleLogStream(sessionIdRef, enabledRef) {
  const chat = useChatStore()
  let abortController = null
  let buffer = []
  let debounceTimer = null
  let reconnectTimer = null
  let reader = null
  let activeStream = false

  function flushBuffer() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (buffer.length === 0) return

    const batch = buffer.splice(0, MAX_ERRORS_PER_BATCH)
    const errors = batch.filter(l => l.type === 'error')
    const warnings = batch.filter(l => l.type === 'warn')

    chat.pushMessage({
      role: 'opencode_info',
      content: JSON.stringify({
        type: 'console_errors',
        errors: batch,
        summary: `Se detectaron ${errors.length} error(es) y ${warnings.length} advertencia(s) en la consola del navegador`,
      }),
      _key: 'console-err-' + Date.now(),
    })
  }

  function pushToBuffer(event) {
    buffer.push(event)
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(flushBuffer, DEBOUNCE_MS)
  }

  async function connect() {
    const sid = typeof sessionIdRef === 'function' ? sessionIdRef() : sessionIdRef.value
    if (!sid || activeStream) return

    activeStream = true
    abortController = new AbortController()

    try {
      const res = await fetch(`/api/playwright-logs/console/stream?chat_session_id=${sid}`, {
        credentials: 'include',
        signal: abortController.signal,
      })

      if (!res.ok) {
        console.error('[consoleLogStream] Error al conectar SSE:', res.status, res.statusText)
        activeStream = false
        scheduleReconnect()
        return
      }

      const streamReader = res.body.getReader()
      reader = streamReader
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await streamReader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === ':ping' || !trimmed.startsWith('data: ')) continue
          try {
            const json = JSON.parse(trimmed.slice(6))
            if (json.type === 'console') {
              pushToBuffer({
                type: json.console_type,
                text: json.text,
                location: json.location || null,
              })
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // intentional abort, no reconectar
      } else {
        console.error('[consoleLogStream] Error en SSE:', err.message)
        scheduleReconnect()
      }
    } finally {
      reader = null
      abortController = null
      activeStream = false
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return
    const sid = typeof sessionIdRef === 'function' ? sessionIdRef() : sessionIdRef.value
    if (!sid) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, RECONNECT_DELAY)
  }

  function disconnect() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (buffer.length > 0) {
      flushBuffer()
    }
    activeStream = false
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    if (reader) {
      reader = null
    }
  }

  watch(
    () => {
      const enabled = typeof enabledRef === 'function' ? enabledRef() : enabledRef.value
      const sid = typeof sessionIdRef === 'function' ? sessionIdRef() : sessionIdRef.value
      return { enabled: !!enabled, sid }
    },
    ({ enabled, sid }) => {
      if (enabled && sid) {
        connect()
      } else {
        disconnect()
      }
    },
    { immediate: true }
  )

  onUnmounted(() => {
    disconnect()
  })

  return { disconnect, flushBuffer }
}
