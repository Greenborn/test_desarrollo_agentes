import { io } from 'socket.io-client'

let socket = null

export function useSocket() {
  if (!socket) {
    const token = localStorage.getItem('session_token')
    socket = io({
      auth: token ? { token } : {},
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })

    socket.on('connect_error', () => {
      if (localStorage.getItem('session_token')) {
        localStorage.removeItem('session_token')
        socket.close()
        socket = null
        window.location.reload()
      }
    })
  }
  return socket
}
