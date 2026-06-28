import { ref } from 'vue'

const WS_URL = `ws://localhost:4000/ws`

let ws = null
let msgIdCounter = 0
const pending = new Map()
let reconnectTimer = null
let connectPromise = null
let shouldReconnect = true

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

function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return Promise.resolve()
  }

  if (ws && (ws.readyState === WebSocket.CONNECTING)) {
    if (connectPromise) return connectPromise
  }

  if (ws) {
    try { ws.close() } catch (e) {}
    ws = null
  }

  if (connectPromise) {
    return connectPromise
  }

  connectPromise = new Promise((resolve, reject) => {
    try {
      ws = new WebSocket(WS_URL)
    } catch (err) {
      connected.value = false
      connectPromise = null
      reject(err)
      return
    }

    ws.onopen = () => {
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
      connected.value = false
      ws = null
      connectPromise = null
      cleanupPending('Conexión WebSocket cerrada')

      if (shouldReconnect) {
        if (reconnectTimer) clearTimeout(reconnectTimer)
        reconnectTimer = setTimeout(() => connect(), 1000)
      }
    }

    ws.onerror = (err) => {
      connected.value = false
      connectPromise = null
      reject(err)
      ws = null

      if (shouldReconnect) {
        if (reconnectTimer) clearTimeout(reconnectTimer)
        reconnectTimer = setTimeout(() => connect(), 1000)
      }
    }
  })

  return connectPromise
}

function disconnect() {
  shouldReconnect = false
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (ws) {
    ws.close()
    ws = null
  }
  connected.value = false
  cleanupPending('Conexión WebSocket cerrada manualmente')
}

async function send(type, payload = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await connect()
    if (ws && ws.readyState === WebSocket.OPEN) break
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 200))
  }

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket no conectado')
  }

  const id = getNextId()
  const msg = JSON.stringify({ id, type, ...payload })

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

connect().catch(() => {})

export default { connect, disconnect, send, connected }
