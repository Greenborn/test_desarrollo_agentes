import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/dev_terminal_test_image',
  category: 'Desarrollo',
  description: 'Prueba de imagen inline en la terminal vía Sixel/IIP. Genera un PNG de 200x100 renderizado directamente en xterm.js.',
  usage: '/dev_terminal_test_image',
  async execute(args, { cmdStore, chatStore, sessionId }) {
    if (!sessionId) {
      console.error('Error en /dev_terminal_test_image: no hay sesión de chat activa')
      return
    }

    try {
      const res = await fetch('/api/opencode/test-image', {
        credentials: 'include',
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error desconocido' }))
        chatStore.pushMessage({
          role: 'opencode_info',
          content: JSON.stringify({ type: 'error', message: err.error || 'Error al obtener imagen de prueba' }),
          _key: 'err-' + Date.now(),
        }, sessionId)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''

        for (const line of lines) {
          const t = line.trim()
          if (!t || !t.startsWith('data: ')) continue
          try {
            const j = JSON.parse(t.slice(6))
            if (j.type === 'terminal') {
              chatStore.pushTerminalLine(sessionId, j.line, j.partType)
            }
          } catch (e) {
            console.error('Error parseando SSE test-image:', e)
          }
        }
      }

      chatStore.pushMessage({
        role: 'opencode_info',
        content: JSON.stringify({ type: 'info', message: '✅ Imagen de prueba enviada a la terminal' }),
        _key: 'done-' + Date.now(),
      }, sessionId)
    } catch (err) {
      console.error('Error en /dev_terminal_test_image:', err.message)
      chatStore.pushMessage({
        role: 'opencode_info',
        content: JSON.stringify({ type: 'error', message: err.message }),
        _key: 'err-' + Date.now(),
      }, sessionId)
    }
  },
})
