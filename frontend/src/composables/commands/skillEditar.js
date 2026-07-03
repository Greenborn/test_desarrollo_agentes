import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/skill_editar',
  category: 'Skills',
  description: 'Crea o edita un skill usando OpenCode. Si no existe, lo crea automáticamente. Toma el cwd de la sesión de chat.',
  usage: '/skill_editar <nombre_skill> <prompt...>',
  async execute(args, { chatStore, loadingIdx, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }
    if (args.length < 2) {
      throw new Error('Uso: /skill_editar <nombre_skill> <prompt...>')
    }

    const skillName = args[0]
    const prompt = args.slice(1).join(' ')

    if (chatStore.messages[loadingIdx]) {
      chatStore.messages[loadingIdx] = { ...chatStore.messages[loadingIdx], content: `🔍 Buscando sesión...` }
    }

    let cwd = null
    try {
      const sessionsRes = await fetch('/api/chat/sessions', { credentials: 'include' })
      const sessionsData = await sessionsRes.json()
      const session = (sessionsData.sessions || []).find(s => Number(s.id) === Number(sessionId))
      cwd = session?.cwd || null
    } catch (err) {
      console.error('Error al obtener sesiones:', err.message)
    }

    if (!cwd) {
      throw new Error('La sesión no tiene un directorio de trabajo (cwd) definido.')
    }

    if (chatStore.messages[loadingIdx]) {
      chatStore.messages[loadingIdx] = { ...chatStore.messages[loadingIdx], content: `📝 Preparando skill "${skillName}"...` }
    }

    let skillPath = null
    try {
      const listRes = await fetch(`/api/skills/list?cwd=${encodeURIComponent(cwd)}`, { credentials: 'include' })
      const listData = await listRes.json()
      const existing = (listData.skills || []).find(s => s.name === skillName)
      if (existing) {
        skillPath = existing.path
      }
    } catch (err) {
      console.error('Error al listar skills:', err.message)
    }

    if (!skillPath) {
      if (chatStore.messages[loadingIdx]) {
        chatStore.messages[loadingIdx] = { ...chatStore.messages[loadingIdx], content: `📁 Creando skill "${skillName}"...` }
      }
      try {
        const createRes = await fetch('/api/skills/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: skillName, cwd }),
        })
        const createData = await createRes.json()
        if (!createData.success) {
          throw new Error(createData.error || 'Error al crear skill')
        }
        skillPath = createData.path
      } catch (err) {
        throw new Error('Error al crear skill: ' + err.message)
      }
    }

    let currentContent = ''
    try {
      const readRes = await fetch(`/api/command/read-file?path=${encodeURIComponent(skillPath)}`, { credentials: 'include' })
      const readData = await readRes.json()
      if (readData.success) {
        currentContent = readData.content
      }
    } catch (err) {
      console.error('Error al leer skill:', err.message)
    }

    if (chatStore.messages[loadingIdx]) {
      chatStore.messages[loadingIdx] = { ...chatStore.messages[loadingIdx], content: `🤖 Consultando agente OpenCode para editar "${skillName}"...` }
    }

    const contextPrompt = `Trabajo en el directorio raíz del proyecto: "${cwd}"

Estoy editando el skill "${skillName}" ubicado en la ruta relativa:
.agents/skills/${skillName}/SKILL.md
(ruta absoluta: ${skillPath})

Contenido actual del archivo SKILL.md:
\`\`\`markdown
${currentContent}
\`\`\`

${prompt}

IMPORTANTE: Debes responder con el contenido completo y actualizado del archivo SKILL.md en un bloque de código markdown (usando \`\`\`markdown ... \`\`\`), precedido de un breve resumen de los cambios realizados. No modifiques archivos directamente, solo devuelve el contenido actualizado en el bloque de código.`

    let fullResponse = ''
    try {
      const startRes = await fetch('/api/opencode/editor-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cwd }),
      })
      const startData = await startRes.json()
      if (startData.error) {
        throw new Error(startData.error)
      }

      const provider = startData.providers?.[0]?.id || ''
      const defaultModels = startData.defaultModels || {}
      const model = defaultModels[provider] || (startData.providers?.[0]?.models ? Object.keys(startData.providers[0].models)[0] : '')

      if (!provider || !model) {
        fetch('/api/opencode/editor-finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ cwd }),
        }).catch(() => {})
        throw new Error('No se encontraron modelos de OpenCode disponibles. Configure un proveedor primero.')
      }

      if (chatStore.messages[loadingIdx]) {
        chatStore.messages[loadingIdx] = { ...chatStore.messages[loadingIdx], content: `⏳ Esperando respuesta del agente para "${skillName}"...` }
      }

      const sendRes = await fetch('/api/opencode/editor-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt: contextPrompt,
          provider,
          model,
          thinking: 'medium',
          mode: 'Plan',
          temperature: '0.7',
          cwd,
        }),
      })

      if (!sendRes.ok) {
        const errData = await sendRes.json().catch(() => ({}))
        throw new Error(errData.error || 'Error al enviar al agente')
      }

      const reader = sendRes.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let doneReceived = false

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
              fullResponse += j.content
            } else if (j.type === 'done') {
              doneReceived = true
            } else if (j.type === 'error') {
              console.error('Error del agente:', j.content)
              fullResponse += '\n[Error: ' + j.content + ']'
            }
          } catch (e) {
            if (e.message !== 'Unexpected end of JSON input') {
              console.error('Error parsing SSE:', e.message)
            }
          }
        }
      }

      if (!doneReceived && !fullResponse) {
        throw new Error('No se recibió respuesta del agente')
      }

      const mdMatch = fullResponse.match(/```markdown\s*([\s\S]*?)```/)
      const mdMatch2 = fullResponse.match(/```md\s*([\s\S]*?)```/)
      const updatedContent = mdMatch?.[1]?.trim() || mdMatch2?.[1]?.trim() || ''

      if (updatedContent) {
        const writeRes = await fetch('/api/command/write-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ path: skillPath, content: updatedContent }),
        })
        const writeData = await writeRes.json()
        if (!writeData.success) {
          console.error('Error al guardar skill actualizado:', writeData.error)
        }
      } else {
        console.log('No se encontró bloque markdown en la respuesta, guardando respuesta completa')
        const writeRes = await fetch('/api/command/write-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ path: skillPath, content: fullResponse }),
        })
        const writeData = await writeRes.json()
        if (!writeData.success) {
          console.error('Error al guardar skill:', writeData.error)
        }
      }
    } finally {
      try {
        await fetch('/api/opencode/editor-finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ cwd }),
        })
      } catch (err) {
        console.error('Error al finalizar editor:', err.message)
      }
    }

    let finalContent = ''
    try {
      const finalRes = await fetch(`/api/command/read-file?path=${encodeURIComponent(skillPath)}`, { credentials: 'include' })
      const finalData = await finalRes.json()
      if (finalData.success) {
        finalContent = finalData.content
      }
    } catch (err) {
      console.error('Error al leer skill final:', err.message)
    }

    const cleanedResponse = fullResponse.replace(/```markdown[\s\S]*?```/g, '').replace(/```md[\s\S]*?```/g, '').trim()

    return `✅ Skill "${skillName}" editado correctamente.

Ruta: \`.agents/skills/${skillName}/SKILL.md\`

${cleanedResponse ? '**Respuesta del agente:**\n' + cleanedResponse + '\n\n' : ''}**Contenido final del archivo:**

\`\`\`markdown
${finalContent}
\`\`\``
  },
})
