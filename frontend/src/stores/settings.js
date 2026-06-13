import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useSocket } from '../composables/useSocket.js'

export const useSettingsStore = defineStore('settings', () => {
  const deepseekKey = ref('')
  const systemPrompt = ref('')
  const saveError = ref('')
  const saveSuccess = ref('')
  const socket = useSocket()

  socket.on('settings:get_res', (keys) => {
    deepseekKey.value = keys.deepseek_key || ''
    systemPrompt.value = keys.system_prompt || ''
  })

  socket.on('settings:set_res', (data) => {
    if (data.success) {
      saveSuccess.value = 'Guardado correctamente'
      saveError.value = ''
    } else {
      saveError.value = data.error || 'Error al guardar'
      saveSuccess.value = ''
    }
    socket.emit('settings:get')
  })

  function clearFeedback() {
    saveSuccess.value = ''
    saveError.value = ''
  }

  function load() {
    socket.emit('settings:get')
  }

  function save(key, value) {
    socket.emit('settings:set', { key, value })
  }

  return { deepseekKey, systemPrompt, saveError, saveSuccess, clearFeedback, load, save }
})
