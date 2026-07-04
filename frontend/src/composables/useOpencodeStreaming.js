import { ref, watch } from 'vue'
import { useChatStore } from '../stores/chat.js'
import { useOpencodeStore } from '../stores/opencode.js'
import { useGitStore } from '../stores/git.js'
import { useProjectVariables } from './useProjectVariables.js'

const DOC_LABELS = {
  base_datos: 'Base de Datos',
  subproyectos: 'Subproyectos',
  endpoints: 'Endpoints',
  web_sockets: 'WebSockets',
  funcionalidades: 'Funcionalidades',
}

export function useOpencodeStreaming() {
  const chat = useChatStore()
  const ocStore = useOpencodeStore()
  const gitStore = useGitStore()
  const { getVariables, interpolate } = useProjectVariables()

  const ocStreaming = ref(false)
  const ocChunk = ref('')
  const ocThinking = ref('')
  const streamSessionId = ref(null)
  const streamingConsole = ref(false)
  const terminalContent = ref('')
  const _ocStreamData = ref({})

  function _syncStreamData(sessionId) {
    const sKey = sessionId ? String(sessionId) : null
    if (sKey && _ocStreamData.value[sKey]) {
      ocChunk.value = _ocStreamData.value[sKey].text || ''
      ocThinking.value = _ocStreamData.value[sKey].thinking || ''
      ocStreaming.value = _ocStreamData.value[sKey].streaming || false
      terminalContent.value = _ocStreamData.value[sKey].terminalContent || ''
      streamSessionId.value = sessionId
    } else {
      ocChunk.value = ''
      ocThinking.value = ''
      ocStreaming.value = false
      terminalContent.value = ''
    }
  }

  function _ensureStreamData(sid) {
    const sKey = String(sid)
    if (!_ocStreamData.value[sKey]) {
      _ocStreamData.value[sKey] = { text: '', thinking: '', streaming: false, terminalContent: '' }
    }
    return _ocStreamData.value[sKey]
  }

  function makeStreamCallbacks(sd, sessionId, streamKey) {
    const sKey = String(sessionId)
    function updateText() {
      _ocStreamData.value[sKey] = sd
      if (isActiveSession(sessionId)) ocChunk.value = sd.text
      chat.updateOcStreamCache(sessionId, sd.text, sd.thinking, streamKey)
    }
    function updateThinking() {
      _ocStreamData.value[sKey] = sd
      if (isActiveSession(sessionId)) ocThinking.value = sd.thinking
      chat.updateOcStreamCache(sessionId, sd.text, sd.thinking, streamKey)
    }
    function formatToolCall(content) {
      let name = content
      let args = ''
      try { const p = JSON.parse(content); if (p.name) name = p.name; if (p.arguments) args = typeof p.arguments === 'object' ? JSON.stringify(p.arguments, null, 2) : String(p.arguments) } catch {}
      let block = `\n\n┌─ 🔧 ${name}`
      if (args) block += `\n│ ${args.split('\n').join('\n│ ')}`
      block += '\n└──────────────\n'
      return block
    }
    return {
      onChunk(content) { sd.text += content; updateText() },
      onThinking(content) { sd.thinking += content; updateThinking() },
      onToolCall(content) { sd.text += formatToolCall(content); updateText() },
      onToolResult(content) { sd.text += `\`\`\`\n${content}\n\`\`\`\n`; updateText() },
      onToolData(content, partType) { sd.text += `\n> ${partType || 'data'}: ${content}\n`; updateText() },
      onTerminalLine(line, partType) {
        if (!_ocStreamData.value[sKey]) {
          _ocStreamData.value[sKey] = { text: '', thinking: '', streaming: false, terminalContent: '' }
        }
        _ocStreamData.value[sKey].terminalContent += line + '\n'
        if (isActiveSession(sessionId)) {
          terminalContent.value = _ocStreamData.value[sKey].terminalContent
        }
      },
    }
  }

  function getTerminalContentForSession(sid) {
    const sKey = sid ? String(sid) : null
    if (sKey && _ocStreamData.value[sKey]) {
      return _ocStreamData.value[sKey].terminalContent || ''
    }
    return ''
  }

  function clearTerminalContentForSession(sid) {
    const sKey = sid ? String(sid) : null
    if (sKey && _ocStreamData.value[sKey]) {
      _ocStreamData.value[sKey].terminalContent = ''
    }
  }

  function isActiveSession(sid) {
    return sid && Number(chat.activeSessionId) === Number(sid)
  }

  watch(() => chat.activeSessionId, (newId) => {
    _syncStreamData(newId)
  })

  async function _getProyectoId() {
    const sid = chat.activeSessionId
    if (!sid) return null
    try {
      const res = await fetch(`/api/proyecto/session/${sid}`, { credentials: 'include' })
      const data = await res.json()
      return data.proyectoId || null
    } catch (err) {
      console.error('Error al obtener proyecto de sesión:', err.message)
      return null
    }
  }

  async function resolveInput(text) {
    if (!text || !text.includes('{{')) return text
    const proyectoId = await _getProyectoId()
    if (!proyectoId) return text
    const variables = await getVariables(proyectoId)
    return interpolate(text, variables)
  }

  function fetchGitBranch() {
    return gitStore.fetchGitBranch(chat.activeSessionId)
  }

  async function addMessage(role, content, extra) {
    const msg = { role, content, _key: 'msg-' + Date.now() + '-' + Math.random(), ...extra }
    chat.pushMessage(msg)
    return msg
  }

  async function opencodeStreamDescripcion(sessionId, prompt, provider, model, thinking, mode, temperature, ticket) {
    const sd = _ensureStreamData(sessionId)
    sd.text = ''
    sd.thinking = ''
    sd.streaming = true
    ocStreaming.value = true
    streamSessionId.value = sessionId
    terminalContent.value = ''
    clearTerminalContentForSession(sessionId)
    if (isActiveSession(sessionId)) {
      ocChunk.value = ''
      ocThinking.value = ''
    }
    if (sessionId) chat.setSessionStatus(sessionId, 'executing')
    chat.setOcStreaming(sessionId, true)

    const streamMsg = await addMessage('opencode_stream', '', { streaming: true })
    streamMsg._key = 'stream-' + Date.now()

    await ocStore.streamPrompt(sessionId, prompt, provider, model, thinking, mode, temperature, {
      onChunk(content) {
        sd.text += content
        _ocStreamData.value[String(sessionId)] = sd
        if (isActiveSession(sessionId)) ocChunk.value = sd.text
        chat.updateOcStreamCache(sessionId, sd.text, sd.thinking, streamMsg._key)
        if (isActiveSession(sessionId)) {
          const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          if (idx >= 0) chat.messages[idx].content = sd.text
        }
      },
      onThinking(content) {
        sd.thinking += content
        _ocStreamData.value[String(sessionId)] = sd
        if (isActiveSession(sessionId)) ocThinking.value = sd.thinking
        chat.updateOcStreamCache(sessionId, sd.text, sd.thinking, streamMsg._key)
        if (isActiveSession(sessionId)) {
          const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          if (idx >= 0) chat.messages[idx].thinking = sd.thinking
        }
      },
      onControl(control) {
        const controlMsg = {
          role: 'opencode_control',
          content: JSON.stringify(control),
          controlData: control,
          _key: 'control-' + Date.now(),
        }
        chat._saveMessageToDb(sessionId, controlMsg)
        if (isActiveSession(sessionId)) {
          chat.pushMessage(controlMsg)
        } else {
          chat.pendingNotifications[sessionId] = Date.now()
        }
      },
      onDone(json, fullText) {
        sd.streaming = false
        _ocStreamData.value[String(sessionId)] = sd
        ocStreaming.value = false
        chat.setOcStreaming(sessionId, false)
        chat.clearOcStreamCache(sessionId)
        if (sessionId) chat.setSessionStatus(sessionId, 'idle')
        const fullResponse = json.fullResponse || fullText || '(sin respuesta)'
        const thinking = json.thinking || sd.thinking || null
        chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: fullResponse, thinking })
        if (isActiveSession(sessionId)) {
          const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          if (idx >= 0) {
            chat.messages[idx].streaming = false
            chat.messages[idx].role = 'opencode_result'
            chat.messages[idx].content = fullResponse
            chat.messages[idx].thinking = thinking
          }
          chat.pushMessage({
            role: 'opencode_control',
            controlData: {
              controlId: 'descripcion-result-' + Date.now(),
              controlType: 'descripcion_result',
              description: fullResponse,
              loading: false,
              ticket,
            },
            _key: 'control-' + Date.now(),
          })
        } else {
          chat.pendingNotifications[sessionId] = Date.now()
        }
      },
      onError(msg) {
        sd.streaming = false
        _ocStreamData.value[String(sessionId)] = sd
        ocStreaming.value = false
        chat.setOcStreaming(sessionId, false)
        chat.clearOcStreamCache(sessionId)
        if (sessionId) chat.setSessionStatus(sessionId, 'error')
        chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: `[Error: ${msg}]` })
        if (isActiveSession(sessionId)) {
          const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          if (idx >= 0) {
            chat.messages[idx].content = '[Error: ' + msg + ']'
            chat.messages[idx].streaming = false
          }
        } else {
          chat.pendingNotifications[sessionId] = Date.now()
        }
      },
    })
  }

  async function opencodeStreamDescripcionFollowup(sessionId, userPrompt, ticket, temperature, descripcionData) {
    const sd = _ensureStreamData(sessionId)
    sd.text = ''
    sd.thinking = ''
    sd.streaming = true
    ocStreaming.value = true
    streamSessionId.value = sessionId
    if (isActiveSession(sessionId)) {
      ocChunk.value = ''
      ocThinking.value = ''
    }
    if (sessionId) chat.setSessionStatus(sessionId, 'executing')
    chat.setOcStreaming(sessionId, true)

    if (isActiveSession(sessionId)) {
      chat.pushMessage({
        role: 'user',
        content: userPrompt,
        _key: 'user-' + Date.now(),
      })

      chat.pushMessage({
        role: 'opencode_info',
        content: '📤 Mensaje enviado a OpenCode:\n\n' + userPrompt,
        _key: 'prompt-' + Date.now(),
      })
    }

    const streamMsg = await addMessage('opencode_stream', '', { streaming: true })
    streamMsg._key = 'stream-' + Date.now()

    const callbacks = makeStreamCallbacks(sd, sessionId, streamMsg._key)

    await ocStore.streamPrompt(sessionId, userPrompt, descripcionData.provider, ocStore.selectedModel || descripcionData.model, ocStore.selectedThinking || descripcionData.thinking, ocStore.selectedMode || descripcionData.mode, temperature, {
      ...callbacks,
      onControl(control) {
        const controlMsg = {
          role: 'opencode_control',
          content: JSON.stringify(control),
          controlData: control,
          _key: 'control-' + Date.now(),
        }
        chat._saveMessageToDb(sessionId, controlMsg)
        if (isActiveSession(sessionId)) {
          chat.pushMessage(controlMsg)
        } else {
          chat.pendingNotifications[sessionId] = Date.now()
        }
      },
      onDone(json, fullText) {
        sd.streaming = false
        _ocStreamData.value[String(sessionId)] = sd
        ocStreaming.value = false
        chat.setOcStreaming(sessionId, false)
        chat.clearOcStreamCache(sessionId)
        if (sessionId) chat.setSessionStatus(sessionId, 'idle')
        const fullResponse = json.fullResponse || fullText || '(sin respuesta)'
        const thinking = json.thinking || sd.thinking || null
        chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: fullResponse, thinking })
        if (isActiveSession(sessionId)) {
          for (let i = chat.messages.length - 1; i >= 0; i--) {
            const m = chat.messages[i]
            if (m.controlData && m.controlData.controlType === 'descripcion_result') {
              chat.messages[i] = {
                role: 'result',
                content: m.controlData.description || '(descripción anterior)',
                _key: 'old-result-' + Date.now(),
              }
              break
            }
          }
          const streamIdx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          if (streamIdx >= 0) {
            chat.messages[streamIdx] = {
              role: 'opencode_control',
              controlData: {
                controlId: 'descripcion-result-' + Date.now(),
                controlType: 'descripcion_result',
                description: fullResponse,
                loading: false,
                ticket,
              },
              _key: 'control-' + Date.now(),
            }
          }
        } else {
          chat.pendingNotifications[sessionId] = Date.now()
        }
      },
      onError(msg) {
        sd.streaming = false
        _ocStreamData.value[String(sessionId)] = sd
        ocStreaming.value = false
        chat.setOcStreaming(sessionId, false)
        chat.clearOcStreamCache(sessionId)
        if (sessionId) chat.setSessionStatus(sessionId, 'error')
        chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: `[Error: ${msg}]` })
        if (isActiveSession(sessionId)) {
          const streamIdx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          if (streamIdx >= 0) {
            chat.messages[streamIdx].content = '[Error: ' + msg + ']'
            chat.messages[streamIdx].streaming = false
          }
        } else {
          chat.pendingNotifications[sessionId] = Date.now()
        }
      },
    })
  }

  async function opencodeStreamPrompt(sessionId, prompt, provider, model, thinking, mode, temperature) {
    const sd = _ensureStreamData(sessionId)
    sd.text = ''
    sd.thinking = ''
    sd.streaming = true
    ocStreaming.value = true
    streamSessionId.value = sessionId
    terminalContent.value = ''
    clearTerminalContentForSession(sessionId)
    if (isActiveSession(sessionId)) {
      ocChunk.value = ''
      ocThinking.value = ''
    }
    if (sessionId) chat.setSessionStatus(sessionId, 'executing')
    chat.setOcStreaming(sessionId, true)

    const streamMsg = await addMessage('opencode_stream', '', { streaming: true })
    streamMsg._key = 'stream-' + Date.now()

    if (mode === 'Build') {
      streamingConsole.value = true
    }

    const callbacks = makeStreamCallbacks(sd, sessionId, streamMsg._key)

    await ocStore.streamPrompt(sessionId, prompt, provider, model, thinking, mode, temperature, {
      ...callbacks,
      onControl(control) {
        const controlMsg = {
          role: 'opencode_control',
          content: JSON.stringify(control),
          controlData: control,
          _key: 'control-' + Date.now(),
        }
        chat._saveMessageToDb(sessionId, controlMsg)
        if (isActiveSession(sessionId)) {
          chat.pushMessage(controlMsg)
        } else {
          chat.pendingNotifications[sessionId] = Date.now()
        }
      },
      async onDone(json, fullText) {
        sd.streaming = false
        _ocStreamData.value[String(sessionId)] = sd
        ocStreaming.value = false
        chat.setOcStreaming(sessionId, false)
        chat.clearOcStreamCache(sessionId)
        if (sessionId) chat.setSessionStatus(sessionId, 'idle')
        let content = sd.text || json.fullResponse || fullText || '(sin respuesta)'

        if (json.diff && json.diff.length > 0) {
          content += '\n\n---\n### 📁 Archivos modificados\n'
          for (const d of json.diff) {
            content += `\n**\`${d.path}\`** (${d.type || 'modificado'}):\n\`\`\`diff\n${d.content}\n\`\`\`\n`
          }
        }

        const thinking = json.thinking || sd.thinking || null
        await chat._saveMessageToDb(sessionId, { role: 'opencode_result', content, thinking })
        if (!isActiveSession(sessionId)) {
          chat.pendingNotifications[sessionId] = Date.now()
          return
        }

        const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'opencode_result',
            content,
            thinking,
            _key: 'result-' + Date.now(),
          }
        }
        fetchGitBranch()
        streamingConsole.value = false
      },
      onError(msg) {
        sd.streaming = false
        _ocStreamData.value[String(sessionId)] = sd
        streamingConsole.value = false
        ocStreaming.value = false
        chat.setOcStreaming(sessionId, false)
        chat.clearOcStreamCache(sessionId)
        if (sessionId) chat.setSessionStatus(sessionId, 'error')
        chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: `[Error: ${msg}]` })
        if (isActiveSession(sessionId)) {
          const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          if (idx >= 0) {
            chat.messages[idx].streaming = false
            chat.messages[idx].role = 'opencode_result'
            chat.messages[idx].content = '[Error: ' + msg + ']'
          }
        } else {
          chat.pendingNotifications[sessionId] = Date.now()
        }
      },
    })
  }

  async function opencodeStreamPromptCommit(sessionId, prompt, provider, model, thinking, mode, temperature) {
    const sd = _ensureStreamData(sessionId)
    sd.text = ''
    sd.thinking = ''
    sd.streaming = true
    ocStreaming.value = true
    streamSessionId.value = sessionId
    terminalContent.value = ''
    clearTerminalContentForSession(sessionId)
    if (isActiveSession(sessionId)) {
      ocChunk.value = ''
      ocThinking.value = ''
    }
    if (sessionId) chat.setSessionStatus(sessionId, 'executing')
    chat.setOcStreaming(sessionId, true)

    const streamMsg = await addMessage('opencode_stream', '', { streaming: true })
    streamMsg._key = 'stream-' + Date.now()

    const callbacks = makeStreamCallbacks(sd, sessionId, streamMsg._key)

    await ocStore.streamPrompt(sessionId, prompt, provider, model, thinking, mode, temperature, {
      ...callbacks,
      onControl(control) {
        const controlMsg = {
          role: 'opencode_control',
          content: JSON.stringify(control),
          controlData: control,
          _key: 'control-' + Date.now(),
        }
        chat._saveMessageToDb(sessionId, controlMsg)
        if (isActiveSession(sessionId)) {
          chat.pushMessage(controlMsg)
        } else {
          chat.pendingNotifications[sessionId] = Date.now()
        }
      },
      async onDone(json, fullText) {
        sd.streaming = false
        _ocStreamData.value[String(sessionId)] = sd
        ocStreaming.value = false
        const opencodeResponse = json.fullResponse || fullText || '(sin respuesta)'
        const thinking = json.thinking || sd.thinking || null
        chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: opencodeResponse, thinking })
        chat.setOcStreaming(sessionId, false)
        chat.clearOcStreamCache(sessionId)
        if (sessionId) chat.setSessionStatus(sessionId, 'idle')
        if (!isActiveSession(sessionId)) {
          chat.pendingNotifications[sessionId] = Date.now()
          return
        }

        try {
          const systemPrompt = 'Eres un asistente que reduce mensajes de commit. Recibes un mensaje de commit y debes acortarlo a un máximo de 256 caracteres manteniendo el significado y la claridad. Devuelve ÚNICAMENTE el mensaje reducido, sin explicaciones ni formato adicional.'

          const res = await fetch('/api/chat/refine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ text: opencodeResponse, systemPrompt, sessionId }),
          })

          if (!res.ok) {
            let errMsg = 'Error al reducir mensaje de commit'
            try { const errData = await res.json(); if (errData.error) errMsg = errData.error } catch {}
            throw new Error(errMsg)
          }

          let refinedText = ''
          let localRefineChunk = ''
          let localRefineThinking = ''

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
                if (j.type === 'response') {
                  refinedText += j.content
                  localRefineChunk += j.content
                  sd.text = localRefineChunk
                  _ocStreamData.value[String(sessionId)] = sd
                  if (isActiveSession(sessionId)) ocChunk.value = localRefineChunk
                  chat.updateOcStreamCache(sessionId, localRefineChunk, sd.thinking, streamMsg._key)
                  if (isActiveSession(sessionId)) {
                    const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
                    if (idx >= 0) {
                      chat.messages[idx].content = refinedText
                    }
                  }
                } else if (j.type === 'thinking') {
                  localRefineThinking += j.content
                  sd.thinking = localRefineThinking
                  _ocStreamData.value[String(sessionId)] = sd
                  if (isActiveSession(sessionId)) ocThinking.value = localRefineThinking
                } else if (j.type === 'error') {
                  throw new Error(j.content)
                }
              } catch (e) {
                if (e.message && e.message !== 'Unexpected end of JSON input') throw e
              }
            }
          }

          sd.streaming = false
          _ocStreamData.value[String(sessionId)] = sd
          ocStreaming.value = false
          if (sessionId) chat.setSessionStatus(sessionId, 'idle')

          if (isActiveSession(sessionId)) {
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) {
              const finalMessage = refinedText || opencodeResponse
              chat.messages[idx] = {
                role: 'opencode_control',
                controlData: {
                  controlId: 'commit-result-' + Date.now(),
                  controlType: 'commit_result',
                  message: finalMessage,
                  loading: false,
                  modo_envio: 'encolar',
                },
                _key: 'control-' + Date.now(),
              }
            }
          }
        } catch (err) {
          console.error('Error al refinar mensaje de commit:', err.message)
          sd.streaming = false
          _ocStreamData.value[String(sessionId)] = sd
          ocStreaming.value = false
          if (sessionId) chat.setSessionStatus(sessionId, 'idle')
          if (isActiveSession(sessionId)) {
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) {
              const fallbackMessage = opencodeResponse + (err ? '\n\n[Error al reducir: ' + err.message + ']' : '')
              chat.messages[idx] = {
                role: 'opencode_control',
                controlData: {
                  controlId: 'commit-result-' + Date.now(),
                  controlType: 'commit_result',
                  message: fallbackMessage,
                  loading: false,
                  modo_envio: 'encolar',
                },
                _key: 'control-' + Date.now(),
              }
            }
          }
        }
        fetchGitBranch()
      },
      onError(msg) {
        sd.streaming = false
        _ocStreamData.value[String(sessionId)] = sd
        ocStreaming.value = false
        chat.setOcStreaming(sessionId, false)
        chat.clearOcStreamCache(sessionId)
        if (sessionId) chat.setSessionStatus(sessionId, 'error')
        chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: `[Error: ${msg}]` })
        if (isActiveSession(sessionId)) {
          const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          if (idx >= 0) {
            chat.messages[idx].streaming = false
            chat.messages[idx].role = 'opencode_result'
            chat.messages[idx].content = '[Error: ' + msg + ']'
          }
        } else {
          chat.pendingNotifications[sessionId] = Date.now()
        }
      },
    })
  }

  async function opencodeStreamPromptTestingNotes(sessionId, prompt, provider, model, thinking, mode, temperature, origen, destino) {
    if (!isActiveSession(sessionId)) {
      console.log('[testing-notes] sesión inactiva, ignorando')
      return
    }
    const sd = _ensureStreamData(sessionId)
    sd.text = ''
    sd.thinking = ''
    sd.streaming = true
    ocStreaming.value = true
    ocChunk.value = ''
    ocThinking.value = ''
    streamSessionId.value = sessionId
    if (sessionId) chat.setSessionStatus(sessionId, 'ai-thinking')
    chat.setOcStreaming(sessionId, true)

    const streamMsg = {
      role: 'opencode_stream',
      content: '',
      thinking: null,
      streaming: true,
      _key: 'stream-' + Date.now(),
    }
    chat.pushMessage(streamMsg)

    const callbacks = makeStreamCallbacks(sd, sessionId, streamMsg._key)

    await ocStore.streamPrompt(sessionId, prompt, provider, model, thinking, mode, temperature, {
      ...callbacks,
      onControl(control) {
        if (!isActiveSession(sessionId)) return
        console.log('[testing-notes] control:', control)
      },
      async onDone(json, fullText) {
        sd.streaming = false
        _ocStreamData.value[String(sessionId)] = sd
        const opencodeResponse = json.fullResponse || fullText || '(sin respuesta)'
        const thinking = json.thinking || sd.thinking || null
        chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: opencodeResponse, thinking })
        chat.setOcStreaming(sessionId, false)
        chat.clearOcStreamCache(sessionId)
        ocStreaming.value = chat.getIsOcStreaming(chat.activeSessionId)
        if (sessionId) chat.setSessionStatus(sessionId, 'idle')
        if (!isActiveSession(sessionId)) {
          chat.pendingNotifications[sessionId] = Date.now()
          return
        }

        if (isActiveSession(sessionId)) {
          const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'opencode_control',
              controlData: {
                controlId: 'ambientes-diff-comment-' + Date.now(),
                controlType: 'ambientes_diff_comment',
                message: opencodeResponse,
                sourceEnv: origen,
                targetEnv: destino,
                modo_envio: 'encolar',
                fromTestingNotes: true,
              },
              _key: 'control-' + Date.now(),
            }
          }
        }
      },
      onError(msg) {
        sd.streaming = false
        _ocStreamData.value[String(sessionId)] = sd
        console.error('[testing-notes] error:', msg)
        chat.setOcStreaming(sessionId, false)
        chat.clearOcStreamCache(sessionId)
        ocStreaming.value = chat.getIsOcStreaming(chat.activeSessionId)
        if (sessionId) chat.setSessionStatus(sessionId, 'idle')
        chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: `[Error: ${msg}]` })
        if (isActiveSession(sessionId)) {
          const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          if (idx >= 0) {
            chat.messages[idx].streaming = false
            chat.messages[idx].role = 'opencode_result'
            chat.messages[idx].content = '[Error: ' + msg + ']'
          }
        } else {
          chat.pendingNotifications[sessionId] = Date.now()
        }
      },
    })
  }

  async function opencodeStreamPromptDocUpdate(sessionId, prompt, provider, model, thinking, mode, temperature, proyectoId, tipo) {
    const sd = _ensureStreamData(sessionId)
    sd.text = ''
    sd.thinking = ''
    sd.streaming = true
    ocStreaming.value = true
    streamSessionId.value = sessionId
    terminalContent.value = ''
    clearTerminalContentForSession(sessionId)
    if (isActiveSession(sessionId)) {
      ocChunk.value = ''
      ocThinking.value = ''
    }
    if (sessionId) chat.setSessionStatus(sessionId, 'executing')
    chat.setOcStreaming(sessionId, true)

    const streamMsg = await addMessage('opencode_stream', '', { streaming: true })
    streamMsg._key = 'stream-' + Date.now()

    const callbacks = makeStreamCallbacks(sd, sessionId, streamMsg._key)

    await ocStore.streamPrompt(sessionId, prompt, provider, model, thinking, mode, temperature, {
      ...callbacks,
      onControl(control) {
        const controlMsg = {
          role: 'opencode_control',
          content: JSON.stringify(control),
          controlData: control,
          _key: 'control-' + Date.now(),
        }
        chat._saveMessageToDb(sessionId, controlMsg)
        if (isActiveSession(sessionId)) {
          chat.pushMessage(controlMsg)
        } else {
          chat.pendingNotifications[sessionId] = Date.now()
        }
      },
      async onDone(json, fullText) {
        sd.streaming = false
        _ocStreamData.value[String(sessionId)] = sd
        ocStreaming.value = false
        chat.setOcStreaming(sessionId, false)
        chat.clearOcStreamCache(sessionId)
        if (sessionId) chat.setSessionStatus(sessionId, 'idle')
        const fullResponse = json.fullResponse || fullText || '(sin respuesta)'
        const thinking = json.thinking || sd.thinking || null
        chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: fullResponse, thinking })
        if (isActiveSession(sessionId)) {
          const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          if (idx >= 0) {
            chat.messages[idx].streaming = false
            chat.messages[idx].role = 'opencode_result'
            chat.messages[idx].content = fullResponse
            chat.messages[idx].thinking = thinking
          }

          try {
            const label = DOC_LABELS[tipo] || tipo
            const res = await fetch(`/api/documentacion/${tipo}/${encodeURIComponent(proyectoId)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ data: fullResponse }),
            })
            if (!res.ok) {
              const errData = await res.json()
              throw new Error(errData.error || 'Error al guardar documentación')
            }
            chat.pushMessage({
              role: 'result',
              content: `Documentación de ${label} actualizada correctamente para el proyecto "${proyectoId}".`,
              _key: 'result-' + Date.now(),
            })
          } catch (err) {
            console.error('Error al guardar documentación:', err.message)
            chat.pushMessage({
              role: 'result',
              content: 'Error al guardar documentación: ' + err.message,
              _key: 'result-' + Date.now(),
            })
          }
        } else {
          chat.pendingNotifications[sessionId] = Date.now()
        }
      },
      onError(msg) {
        sd.streaming = false
        _ocStreamData.value[String(sessionId)] = sd
        ocStreaming.value = false
        chat.setOcStreaming(sessionId, false)
        chat.clearOcStreamCache(sessionId)
        if (sessionId) chat.setSessionStatus(sessionId, 'error')
        chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: `[Error: ${msg}]` })
        if (isActiveSession(sessionId)) {
          const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          if (idx >= 0) {
            chat.messages[idx].content = '[Error: ' + msg + ']'
            chat.messages[idx].streaming = false
          }
        } else {
          chat.pendingNotifications[sessionId] = Date.now()
        }
      },
    })
  }

  return {
    ocStreaming, ocChunk, ocThinking, streamSessionId, streamingConsole, terminalContent,
    isActiveSession, _getProyectoId, resolveInput, fetchGitBranch, addMessage,
    _syncStreamData, getTerminalContentForSession, clearTerminalContentForSession,
    opencodeStreamPrompt, opencodeStreamPromptCommit, opencodeStreamPromptTestingNotes,
    opencodeStreamPromptDocUpdate, opencodeStreamDescripcion, opencodeStreamDescripcionFollowup,
    DOC_LABELS,
  }
}
