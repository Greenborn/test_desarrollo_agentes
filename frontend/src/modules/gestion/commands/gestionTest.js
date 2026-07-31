export default {
  name: '/gestion_test',
  category: 'Gestión',
  description: 'Prueba la conexión con el sistema de gestión interno configurado en Settings.',
  usage: '/gestion_test',
  async execute(args, { chatStore, loadingIdx }) {
    if (chatStore.messages[loadingIdx]) {
      chatStore.messages[loadingIdx] = { ...chatStore.messages[loadingIdx], content: 'Probando conexión con sistema de gestión interna...' }
    }

    const res = await fetch('/api/gestion/test', { credentials: 'include' })
    const data = await res.json()

    if (data.success) {
      const logInfo = data.requestLog ? `\n\nEstado HTTP: ${data.requestLog.statusCode}` : ''
      return `✅ Conexión exitosa al sistema de gestión interna.${logInfo}`
    }

    return `❌ Error: ${data.message || 'No se pudo conectar al sistema de gestión interna.'}`
  },
}
