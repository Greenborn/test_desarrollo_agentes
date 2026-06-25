import { defineStore } from 'pinia'
import { ref } from 'vue'

const API = '/api'

export const useBrowserStore = defineStore('browser', () => {
  const navegadorSessionId = ref(null)
  const hasBrowserSession = ref(false)
  const isRecording = ref(false)
  const currentRecordingId = ref(null)
  const selectedRecordingId = ref(null)
  const starting = ref(false)
  const stopping = ref(false)

  async function navegadorCommand(comando, parametros, sessionId) {
    const res = await fetch(`${API}/navegador/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ comando, parametros, sessionId }),
    })
    return res.json()
  }

  async function fetchStatus() {
    try {
      const res = await fetch(`${API}/navegador/status`, { credentials: 'include' })
      const data = await res.json()
      hasBrowserSession.value = !!data.hasActiveSession
    } catch (err) {
      console.error('Error al obtener estado del navegador:', err.message)
    }
  }

  async function navigate(url, sessionId) {
    const data = await navegadorCommand('navegar', { url }, sessionId)
    if (data.id_session) navegadorSessionId.value = data.id_session
    return data
  }

  async function configureHeadless(sessionId) {
    const data = await navegadorCommand('configurar_headless', {}, sessionId)
    if (data.id_session) navegadorSessionId.value = data.id_session
    return data
  }

  async function finish(sessionId) {
    try {
      await fetch(`${API}/navegador/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id_session: navegadorSessionId.value, sessionId }),
      })
    } catch (err) {
      console.error('Error al finalizar sesión navegador:', err)
    }
    navegadorSessionId.value = null
    hasBrowserSession.value = false
  }

  async function startRecording(recordingId, sessionId) {
    starting.value = true
    try {
      const data = await navegadorCommand('start_event_recording', { recording_id: recordingId }, sessionId)
      if (data.error) {
        return { error: data.error }
      }
      isRecording.value = true
      currentRecordingId.value = recordingId
      return { success: true }
    } finally {
      starting.value = false
    }
  }

  async function stopRecording(sessionId) {
    stopping.value = true
    try {
      const data = await navegadorCommand('stop_event_recording', {}, sessionId)
      if (data.error) {
        return { error: data.error }
      }
      isRecording.value = false
      currentRecordingId.value = null
      return { success: true }
    } finally {
      stopping.value = false
    }
  }

  async function executeAction(action, sessionId) {
    return navegadorCommand('execute_action', { action }, sessionId)
  }

  function clear() {
    navegadorSessionId.value = null
    hasBrowserSession.value = false
    isRecording.value = false
    currentRecordingId.value = null
    selectedRecordingId.value = null
  }

  return {
    navegadorSessionId, hasBrowserSession, isRecording, currentRecordingId,
    selectedRecordingId, starting, stopping,
    navegadorCommand, fetchStatus, navigate, configureHeadless, finish,
    startRecording, stopRecording, executeAction, clear,
  }
})
