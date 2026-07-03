import { ref } from 'vue'

const WS_URL = `ws://localhost:4000/ws`

let ws = null
let msgIdCounter = 0
const pending = new Map()
let connectPromise = null

export const connected = ref(false)

function getNextId() {
  msgIdCounter += 1
  return `ws_${msgIdCounter}`
}

function cleanupPending(errorMsg) {
  for (const [id, { reject }] of pending) {
    reject(new Error(errorMsg))
    pending.delete(id)
  }
}

const CONNECT_TIMEOUT = 5000

function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return Promise.resolve()
  }

  if (ws && (ws.readyState === WebSocket.CONNECTING)) {
    if (connectPromise) return connectPromise
  }

  if (ws) {
    try { ws.close() } catch {}
    ws = null
  }

  if (connectPromise) {
    return connectPromise
  }

  let rejectConnect = null
  connectPromise = new Promise((resolve, reject) => {
    rejectConnect = reject
    const timeout = setTimeout(() => {
      if (ws) {
        try { ws.close() } catch {}
        ws = null
      }
      connectPromise = null
      reject(new Error('Timeout al conectar WebSocket'))
    }, CONNECT_TIMEOUT)

    try {
      ws = new WebSocket(WS_URL)
    } catch (err) {
      clearTimeout(timeout)
      connected.value = false
      connectPromise = null
      reject(err)
      return
    }

    ws.onopen = () => {
      clearTimeout(timeout)
      rejectConnect = null
      connected.value = true
      connectPromise = null
      resolve()
    }

    ws.onmessage = (event) => {
      let msg
      try {
        msg = JSON.parse(event.data)
      } catch {
        return
      }

      const id = msg.id
      if (id && pending.has(id)) {
        const entry = pending.get(id)
        pending.delete(id)
        if (msg.type === 'error' && msg.error) {
          entry.reject(new Error(msg.error))
        } else {
          entry.resolve(msg)
        }
      }
    }

    ws.onclose = () => {
      clearTimeout(timeout)
      connected.value = false
      ws = null
      connectPromise = null
      cleanupPending('Conexión WebSocket cerrada')
    }

    ws.onerror = () => {
      clearTimeout(timeout)
      connected.value = false
      ws = null
      if (rejectConnect) {
        const r = rejectConnect
        rejectConnect = null
        connectPromise = null
        r(new Error('Error en conexión WebSocket'))
      }
    }
  })

  return connectPromise
}

function disconnect() {
  if (ws) {
    ws.close()
    ws = null
  }
  connected.value = false
  cleanupPending('Conexión WebSocket cerrada manualmente')
}

async function send(type, payload = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await connect()
      if (ws && ws.readyState === WebSocket.OPEN) break
    } catch {
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket no conectado')
  }

  const id = getNextId()
  const msg = JSON.stringify({ id, ...payload, type })

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })

    try {
      ws.send(msg)
    } catch (err) {
      pending.delete(id)
      reject(err)
    }
  })
}

export default { connect, disconnect, send, connected }
