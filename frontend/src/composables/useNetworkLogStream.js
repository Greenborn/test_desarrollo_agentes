import { ref, watch, onUnmounted } from 'vue'
import { useChatStore } from '../stores/chat.js'

const DEBOUNCE_MS = 2000
const RECONNECT_DELAY = 3000
const MAX_ERRORS_PER_BATCH = 50

export function useNetworkLogStream(sessionIdRef, enabledRef, onBatch) {
  const chat = useChatStore()
  let abortController = null
  let buffer = []
  let bufferSessionId = null
  let debounceTimer = null
  let reconnectTimer = null
  let reader = null

  function flushBuffer() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (buffer.length === 0) return

    const sid = bufferSessionId
    bufferSessionId = null
    const batch = buffer.splice(0, MAX_ERRORS_PER_BATCH)
    const errors = batch.filter(l => l.status_code === null || l.status_code >= 500)
    const clientErrors = batch.filter(l => l.status_code !== null && l.status_code >= 400 && l.status_code < 500)

    chat.pushMessage({
      role: 'opencode_info',
      content: JSON.stringify({
        type: 'network_errors',
        errors: batch,
        summary: `Se detectaron ${errors.length} error(es) de red y ${clientErrors.length} error(es) de cliente`,
      }),
      _key: 'network-err-' + Date.now(),
    }, sid)

    if (typeof onBatch === 'function') {
      onBatch(batch)
    }
  }

  function pushToBuffer(event) {
    if (!bufferSessionId) {
      bufferSessionId = typeof sessionIdRef === 'function' ? sessionIdRef() : sessionIdRef.value
    }
    buffer.push(event)
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    if (typeof onBatch === 'function') {
      onBatch([event])
    }
    debounceTimer = setTimeout(flushBuffer, DEBOUNCE_MS)
  }

  async function connect() {
    const sid = typeof sessionIdRef === 'function' ? sessionIdRef() : sessionIdRef.value
    if (!sid || abortController) return

    const controller = new AbortController()
    abortController = controller

    try {
      const res = await fetch(`/api/playwright-logs/network/stream?chat_session_id=${sid}`, {
        credentials: 'include',
        signal: controller.signal,
      })

      if (!res.ok) {
        console.error('[networkLogStream] Error al conectar SSE:', res.status, res.statusText)
        if (abortController === controller) {
          abortController = null
        }
        scheduleReconnect()
        return
      }

      bufferSessionId = sid
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
            if (json.type === 'network_error') {
              pushToBuffer({
                type: json.status_code === null ? 'error' : json.status_code >= 500 ? 'error' : 'warn',
                method: json.method,
                url: json.url,
                status_code: json.status_code,
                error: json.error,
                resource_type: json.resource_type,
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
        console.error('[networkLogStream] Error en SSE:', err.message)
        scheduleReconnect()
      }
    } finally {
      if (abortController === controller) {
        reader = null
        abortController = null
      }
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
    bufferSessionId = null
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
    ({ enabled, sid }, oldState) => {
      if (oldState && (sid !== oldState.sid || enabled !== oldState.enabled)) {
        disconnect()
      }
      if (enabled && sid) {
        connect()
      }
    },
    { immediate: true }
  )

  onUnmounted(() => {
    disconnect()
  })

  return { disconnect, flushBuffer }
}
