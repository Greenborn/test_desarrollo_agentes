import { ref, watch } from 'vue'
import { useChatStore } from '../stores/chat.js'
import { useOpencodeStore } from '../stores/opencode.js'
import { useGitStore } from '../stores/git.js'
import { useSettingsStore } from '../stores/settings.js'
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
  const settings = useSettingsStore()
  const { getVariables, interpolate } = useProjectVariables()

  const ocStreaming = ref(false)
  const ocChunk = ref('')
  const ocThinking = ref('')
  const streamSessionId = ref(null)
  const streamingConsole = ref(false)
  const terminalContent = ref('')
  const _ocStreamData = ref({})
  const _agentTerminalContents = ref({})

  function _getAgentTerminalContent(agentId) {
    return _agentTerminalContents.value[agentId] || ''
  }

  function _setAgentTerminalContent(agentId, content) {
    _agentTerminalContents.value[agentId] = content
  }

  function _appendAgentTerminalContent(agentId, line) {
    if (!_agentTerminalContents.value[agentId]) {
      _agentTerminalContents.value[agentId] = ''
    }
    _agentTerminalContents.value[agentId] += line + '\n'
  }

  function _syncStreamData(sessionId) {
    const sKey = sessionId ? String(sessionId) : null
    if (sKey && _ocStreamData.value[sKey]) {
      ocChunk.value = _ocStreamData.value[sKey].text || ''
      ocThinking.value = _ocStreamData.value[sKey].thinking || ''
      ocStreaming.value = _ocStreamData.value[sKey].streaming || false
      const activeAgent = ocStore.getActiveAgent(sessionId)
      terminalContent.value = activeAgent ? _getAgentTerminalContent(activeAgent.id) : ''
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

  function makeStreamCallbacks(sd, sessionId, streamKey, agentId) {
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
    function flash() { chat.flashLed(sessionId) }
    return {
      onChunk(content) { sd.text += content; updateText(); flash() },
      onThinking(content) { sd.thinking += content; updateThinking(); flash() },
      onToolCall(content) { sd.text += formatToolCall(content); updateText(); flash() },
      onToolResult(content) { sd.text += `\`\`\`\n${content}\n\`\`\`\n`; updateText(); flash() },
      onToolData(content, partType) { sd.text += `\n> ${partType || 'data'}: ${content}\n`; updateText(); flash() },
      onTerminalLine(line, partType) {
        _appendAgentTerminalContent(agentId, line)
        const activeAgent = ocStore.getActiveAgent(sessionId)
        if (isActiveSession(sessionId) && activeAgent && activeAgent.id === agentId) {
          terminalContent.value = _getAgentTerminalContent(agentId)
        }
        flash()
      },
    }
  }

  function getAgentTerminalContent(agentId) {
    return _getAgentTerminalContent(agentId)
  }

  function clearAgentTerminalContent(agentId) {
    _agentTerminalContents.value[agentId] = ''
  }

  function getTerminalContentForSession(sid) {
    const activeAgent = ocStore.getActiveAgent(sid)
    return activeAgent ? _getAgentTerminalContent(activeAgent.id) : ''
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

    const totalSlots = chat.getTotalConcurrentSlots(sessionId)
    if (totalSlots >= chat.maxTerminalsLimit.value) {
      const agents = ocStore.getAgents(sessionId)
      if (agents.length > 0) {
        const oldest = agents.reduce((a, b) => a.createdAt < b.createdAt ? a : b)
        if (oldest.ocSessionId) {
          fetch('/api/opencode/close-agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ ocSessionId: oldest.ocSessionId, sessionId }),
          }).catch(err => console.error('Error al cerrar agente más antiguo:', err.message))
        }
        ocStore.removeAgent(sessionId, oldest.id)
      }
    }

    const streamMsg = await addMessage('opencode_stream', '', { streaming: true })
    streamMsg._key = 'stream-' + Date.now()

    if (mode === 'Build') {
      streamingConsole.value = true
    }

    const agent = ocStore.createNewAgent(sessionId)
    const agentId = agent.id

    const callbacks = makeStreamCallbacks(sd, sessionId, streamMsg._key, agentId)

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

  async function _callRefine(sessionId, text, systemPrompt) {
    const res = await fetch('/api/chat/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text, systemPrompt, sessionId }),
    })
    if (!res.ok) {
      let errMsg = 'Error en refine'
      try { const errData = await res.json(); if (errData.error) errMsg = errData.error } catch {}
      throw new Error(errMsg)
    }
    let result = ''
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
            result += j.content
          } else if (j.type === 'error') {
            throw new Error(j.content)
          }
        } catch (e) {
          if (e.message && e.message !== 'Unexpected end of JSON input') throw e
        }
      }
    }
    return result
  }

  async function deepseekStreamCommit(sessionId, prompt, systemPrompt) {
    const streamMsg = await addMessage('opencode_stream', '', { streaming: true })
    streamMsg._key = 'stream-' + Date.now()

    if (sessionId) chat.setSessionStatus(sessionId, 'executing')
    chat.setOcStreaming(sessionId, true)

    try {
      if (isActiveSession(sessionId)) {
        const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
        if (idx >= 0) {
          chat.messages[idx].content = 'Generando propuesta...'
        }
      }

      const generatedText = await _callRefine(sessionId, prompt, systemPrompt)

      if (!generatedText || generatedText.trim().length === 0) {
        throw new Error('No se generó propuesta de commit')
      }

      if (isActiveSession(sessionId)) {
        const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
        if (idx >= 0) {
          chat.messages[idx].content = 'Traduciendo a español...'
        }
      }

      const translateSystem = 'Sos un traductor especializado en commits técnicos. Traducí el siguiente mensaje de commit al español, preservando nombres de archivos, funciones, variables y términos técnicos. Devolvé ÚNICAMENTE el mensaje traducido, sin explicaciones, sin texto adicional.'

      let translatedText = ''
      const res = await fetch('/api/chat/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: generatedText, systemPrompt: translateSystem, sessionId }),
      })

      if (!res.ok) {
        let errMsg = 'Error al traducir mensaje de commit'
        try { const errData = await res.json(); if (errData.error) errMsg = errData.error } catch {}
        throw new Error(errMsg)
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
            if (j.type === 'response') {
              translatedText += j.content
              if (isActiveSession(sessionId)) {
                const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
                if (idx >= 0) {
                  chat.messages[idx].content = translatedText
                }
              }
            } else if (j.type === 'error') {
              throw new Error(j.content)
            }
          } catch (e) {
            if (e.message && e.message !== 'Unexpected end of JSON input') throw e
          }
        }
      }

      chat.setOcStreaming(sessionId, false)
      if (sessionId) chat.setSessionStatus(sessionId, 'idle')

      if (isActiveSession(sessionId)) {
        const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
        if (idx >= 0) {
          let repoUrl = ''
          try {
            const sess = chat.sessions.find(s => Number(s.id) === Number(sessionId))
            const proyectoId = sess?.proyecto_id || null
            let url_github = null
            if (proyectoId) {
              const repoRes = await fetch('/api/proyecto/repositorio/' + encodeURIComponent(proyectoId) + '?sessionId=' + sessionId, { credentials: 'include' })
              const repoData = await repoRes.json()
              url_github = repoData.url_github || null
            }
            if (!url_github) {
              const remoteRes = await fetch('/api/command/git', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ command: 'remote get-url origin', sessionId }),
              })
              const remoteData = await remoteRes.json()
              if (remoteData.success && remoteData.stdout) {
                const remote = remoteData.stdout.trim().replace(/\.git$/, '')
                if (/^git@/.test(remote)) {
                  const m = remote.match(/^git@([^:]+):(.+)$/)
                  if (m) url_github = 'https://' + m[1] + '/' + m[2]
                } else if (/^https?:\/\//.test(remote)) {
                  url_github = remote
                }
              }
            }
            if (url_github) {
              repoUrl = url_github.replace(/\/+$/, '')
            }
          } catch (err) {
            console.error('Error al obtener URL del repositorio:', err.message)
          }

          chat.messages[idx] = {
            role: 'opencode_control',
            controlData: {
              controlId: 'commit-result-' + Date.now(),
              controlType: 'commit_result',
              message: translatedText || '(sin respuesta)',
              repoUrl: repoUrl,
              loading: false,
              modo_envio: settings.defaultCommentModeCommit || 'encolar',
            },
            _key: 'control-' + Date.now(),
          }
        }
      }
    } catch (err) {
      console.error('Error al generar commit:', err.message)
      chat.setOcStreaming(sessionId, false)
      if (sessionId) chat.setSessionStatus(sessionId, 'idle')

      if (isActiveSession(sessionId)) {
        const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'opencode_control',
            controlData: {
              controlId: 'commit-result-' + Date.now(),
              controlType: 'commit_result',
              message: '[Error al generar commit: ' + err.message + ']',
              loading: false,
              modo_envio: settings.defaultCommentModeCommit || 'encolar',
            },
            _key: 'control-' + Date.now(),
          }
        }
      }
    }

    fetchGitBranch()
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
          let ticketContext = ''
          try {
            const sess = chat.sessions.find(s => Number(s.id) === Number(sessionId))
            const ticketRedmineId = sess?.id_ticket_redmine || null
            if (ticketRedmineId) {
              const ticketRes = await fetch(`/api/tickets/session/${sessionId}?comments=true`, { credentials: 'include' })
              const ticketData = await ticketRes.json()
              if (ticketData.ticket) {
                ticketContext += `## Contexto del ticket #${ticketRedmineId}\n\n`
                ticketContext += `- **Título:** ${ticketData.ticket.subject || ''}\n`
                ticketContext += `- **Estado:** ${ticketData.ticket.status_name || ''}\n`
                ticketContext += `- **Prioridad:** ${ticketData.ticket.priority_name || ''}\n`
                ticketContext += `- **Asignado a:** ${ticketData.ticket.assigned_to_name || ''}\n`
                if (ticketData.ticket.description) {
                  ticketContext += `- **Descripción:** ${ticketData.ticket.description}\n`
                }
              }
              if (ticketData.comments && ticketData.comments.length > 0) {
                ticketContext += `\n### Comentarios existentes en Redmine (${ticketData.comments.length})\n\n`
                for (const c of ticketData.comments) {
                  ticketContext += `- **${c.user}** (${c.created_on}): ${c.notes}\n`
                }
              }
              const pendingRes = await fetch(`/api/redmine/comments?ticket_redmine_id=${ticketRedmineId}&estado=todos`, { credentials: 'include' })
              const pendingData = await pendingRes.json()
              if (pendingData.comentarios && pendingData.comentarios.length > 0) {
                const comentariosPendientes = pendingData.comentarios.filter(c => c.estado !== 'enviado')
                if (comentariosPendientes.length > 0) {
                  ticketContext += `\n### Comentarios pendientes de enviar a Redmine (${comentariosPendientes.length})\n\n`
                  for (const c of comentariosPendientes) {
                    const estado = c.estado === 'pendiente' ? '⏳ Pendiente' : c.estado === 'error' ? '❌ Error' : c.estado
                    ticketContext += `- [${estado}] ${c.comentario}\n`
                  }
                }
              }
            }
          } catch (ctxErr) {
            console.error('Error al obtener contexto del ticket para DeepSeek:', ctxErr.message)
          }

          const deepseekText = ticketContext
            ? `Contexto del ticket:\n\n${ticketContext}\n\nPropuesta de commit generada por el agente:\n\n${opencodeResponse}`
            : opencodeResponse

          const systemPrompt = ticketContext
            ? 'Eres un asistente experto en generar mensajes de commit. Regla 75/25: el 75% del mensaje debe describir los cambios PUNTUALES listados en la propuesta del agente (archivos, funciones, lógica modificada). Solo el 25% restante puede usar el contexto del ticket para redondear el propósito general. Priorizá siempre los cambios concretos sobre la descripción del ticket. Máximo 512 caracteres. Devolvé ÚNICAMENTE el mensaje de commit.'
            : 'Eres un asistente que reduce mensajes de commit. Acortá el mensaje a un máximo de 512 caracteres manteniendo los cambios PUNTUALES (archivos, funciones, lógica modificada) y el impacto. Devuelve ÚNICAMENTE el mensaje reducido.'

          const res = await fetch('/api/chat/refine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ text: deepseekText, systemPrompt, sessionId }),
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

              let repoUrl = ''
              try {
                const sess = chat.sessions.find(s => Number(s.id) === Number(sessionId))
                const proyectoId = sess?.proyecto_id || null
                let url_github = null
                if (proyectoId) {
                  const repoRes = await fetch('/api/proyecto/repositorio/' + encodeURIComponent(proyectoId) + '?sessionId=' + sessionId, { credentials: 'include' })
                  const repoData = await repoRes.json()
                  url_github = repoData.url_github || null
                }
                if (!url_github) {
                  const remoteRes = await fetch('/api/command/git', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ command: 'remote get-url origin', sessionId }),
                  })
                  const remoteData = await remoteRes.json()
                  if (remoteData.success && remoteData.stdout) {
                    const remote = remoteData.stdout.trim().replace(/\.git$/, '')
                    if (/^git@/.test(remote)) {
                      const m = remote.match(/^git@([^:]+):(.+)$/)
                      if (m) url_github = 'https://' + m[1] + '/' + m[2]
                    } else if (/^https?:\/\//.test(remote)) {
                      url_github = remote
                    }
                  }
                }
                if (url_github) {
                  repoUrl = url_github.replace(/\/+$/, '')
                }
              } catch (err) {
                console.error('Error al obtener URL del repositorio:', err.message)
              }

              chat.messages[idx] = {
                role: 'opencode_control',
                controlData: {
                  controlId: 'commit-result-' + Date.now(),
                  controlType: 'commit_result',
                  message: finalMessage,
                  repoUrl: repoUrl,
                  loading: false,
                  modo_envio: settings.defaultCommentModeCommit || 'encolar',
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
              const opencodeResponse2 = json.fullResponse || fullText || '(sin respuesta)'
              const fallbackMessage = opencodeResponse2 + (err ? '\n\n[Error al reducir: ' + err.message + ']' : '')
              chat.messages[idx] = {
                role: 'opencode_control',
                controlData: {
                  controlId: 'commit-result-' + Date.now(),
                  controlType: 'commit_result',
                  message: fallbackMessage,
                  loading: false,
                  modo_envio: settings.defaultCommentModeCommit || 'encolar',
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
                modo_envio: settings.defaultCommentModeDiff || 'encolar',
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
    getAgentTerminalContent, clearAgentTerminalContent,
    opencodeStreamPrompt, opencodeStreamPromptCommit, deepseekStreamCommit,
    opencodeStreamPromptTestingNotes, opencodeStreamPromptDocUpdate,
    opencodeStreamDescripcion, opencodeStreamDescripcionFollowup,
    DOC_LABELS,
  }
}
