import { useCommandRegistry } from '../useCommandRegistry.js'
import { useOpencodeStore } from '../../stores/opencode.js'

const { register } = useCommandRegistry()

register({
  name: '/dev_opencode_generar_commit',
  category: 'Desarrollo',
  description: 'Genera un mensaje de commit de los cambios realizados usando OpenCode. Seleccioná proveedor, modelo y modo para obtener una propuesta de commit.',
  usage: '/dev_opencode_generar_commit',
  async execute(args, { cmdStore, chatStore }) {
    const ocStore = useOpencodeStore()
    const sessionId = chatStore.activeSessionId
    if (!sessionId) {
      console.error('Error en /dev_opencode_generar_commit: no hay sesión de chat activa')
      return
    }

    if (ocStore.ocSessionId) {
      chatStore.messages.push({
        role: 'opencode_info',
        content: JSON.stringify({ type: 'info', message: 'OpenCode ya está activo en esta sesión. Finalizalo con /dev_opencode_finalizar antes de generar un commit.' }),
        _key: 'info-' + Date.now(),
      })
      return
    }

    const data = await ocStore.start()
    if (!data) return

    const providerList = ocStore.getAvailableProviders()
    if (providerList.length === 0) {
      console.error('Error en /dev_opencode_generar_commit: no se encontraron proveedores')
      return
    }

    const preselectProvider = ocStore.savedProvider || providerList[0].value

    chatStore.messages.push({
      role: 'opencode_control',
      controlData: {
        controlId: 'gc-provider-' + Date.now(),
        controlType: 'select',
        stepType: 'generar_commit_setup',
        subStepType: 'provider',
        options: providerList,
        placeholder: 'Selecciona proveedor...',
        preselect: preselectProvider,
      },
      _key: 'control-' + Date.now(),
    })
  },
})
