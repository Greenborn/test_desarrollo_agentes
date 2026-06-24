import { useCommandRegistry } from '../useCommandRegistry.js'
import { useOpencodeStore } from '../../stores/opencode.js'

const { register } = useCommandRegistry()

register({
  name: '/deteccion_funcionalidades',
  category: 'Detección',
  description: 'Inicia un agente OpenCode en el directorio del proyecto para detectar y listar todas las funcionalidades implementadas.',
  usage: '/deteccion_funcionalidades',
  async execute(args, { cmdStore, chatStore }) {
    const ocStore = useOpencodeStore()
    const sessionId = chatStore.activeSessionId
    if (!sessionId) {
      console.error('Error en /deteccion_funcionalidades: no hay sesión de chat activa')
      return
    }

    try {
      const res = await fetch(`/api/proyecto/session/${sessionId}`, { credentials: 'include' })
      const data = await res.json()
      if (!data.proyectoId) {
        console.warn('/deteccion_funcionalidades: No hay proyecto vinculado a la sesión. Se recomienda usar /chat_set_proyecto --id=<id> para vincular un proyecto.')
      }
    } catch (err) {
      console.error('Error al verificar proyecto en /deteccion_funcionalidades:', err)
    }

    if (ocStore.ocSessionId) {
      try {
        await fetch('/api/opencode/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ocSessionId: ocStore.ocSessionId,
            directory: cmdStore.currentDir || undefined,
          }),
        })
      } catch (err) {
        console.error('Error al cerrar sesión OpenCode previa en /deteccion_funcionalidades:', err)
      }
      ocStore.finish()
    }

    const data = await ocStore.start()
    if (!data) return

    const providerList = ocStore.getAvailableProviders()
    if (providerList.length === 0) {
      console.error('Error en /deteccion_funcionalidades: no se encontraron proveedores')
      return
    }

    const preselectProvider = ocStore.savedProvider || providerList[0].value

    chatStore.messages.push({
      role: 'opencode_control',
      controlData: {
        controlId: 'df-provider-' + Date.now(),
        controlType: 'select',
        stepType: 'deteccion_funcionalidades_setup',
        subStepType: 'provider',
        options: providerList,
        placeholder: 'Selecciona proveedor...',
        preselect: preselectProvider,
      },
      _key: 'control-' + Date.now(),
    })
  },
})
