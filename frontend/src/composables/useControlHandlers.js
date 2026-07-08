import { ref } from 'vue'
import { useChatStore } from '../stores/chat.js'
import { useOpencodeStore } from '../stores/opencode.js'
import { useCommandStore } from '../stores/command.js'
import { useModalStore } from '../stores/modal.js'
import { useWorkspaceStore } from '../stores/workspace.js'
import { useAuthStore } from '../stores/auth.js'
import { useComandosPersonalizadosStore } from '../stores/comandosPersonalizados.js'
import { useRedmineCommentsStore } from '../stores/redmineComments.js'
import { useProjectVariablesStore } from '../stores/projectVariables.js'
import { useTicketStore } from '../stores/ticket.js'
import { settingSet } from '../services/settingService.js'
import FuncionalidadWizard from '../components/wizards/FuncionalidadWizard.vue'

export function useControlHandlers(api) {
  const chat = useChatStore()
  const ocStore = useOpencodeStore()
  const cmdStore = useCommandStore()
  const modal = useModalStore()
  const redmineComments = useRedmineCommentsStore()
  const projectVarStore = useProjectVariablesStore()

  const {
    opencodeStreamPrompt, opencodeStreamPromptCommit, opencodeStreamPromptTestingNotes,
    opencodeStreamPromptDocUpdate, opencodeStreamDescripcion, opencodeStreamDescripcionFollowup,
    fetchGitBranch, _getProyectoId, resolveInput, isActiveSession, addMessage,
    ocStreaming, ocChunk, ocThinking, streamSessionId,
    ticketInfo, loadTicketInfo,
  } = api

  let ocSetupData = { provider: '', model: '', thinking: '', mode: '', prompt: '' }
  let commitSetupData = { provider: '', model: '', thinking: '', mode: '', temperature: '' }
  let commitData = { prompt: '', provider: '', model: '', thinking: '', mode: '', temperature: '' }
  let testingNotesSetupData = { provider: '', model: '', thinking: '', mode: 'Plan', temperature: '' }
  let testingNotesData = { prompt: '', provider: '', model: '', thinking: '', mode: '', temperature: '', origen: '', destino: '' }
  let docUpdateData = { provider: '', model: '', thinking: '', mode: '', temperature: '' }
  let descripcionData = { provider: '', model: '', thinking: '', mode: 'Plan', temperature: '' }
  const descripcionUserInput = ref('')
  let repoCrearRamaData = { proyectoId: '', ticketRedmineId: '', baseBranch: '', repoAcronimo: '' }
  const peticionControllers = {}

  async function onControlConfirm({ controlId, value }) {
    const controlMsg = chat.messages.find((m) => m.controlData && m.controlData.controlId === controlId)
    const controlType = controlMsg && controlMsg.controlData ? controlMsg.controlData.controlType : ''
    const stepType = controlMsg && controlMsg.controlData ? controlMsg.controlData.stepType : ''

    if (stepType === 'opencode_setup') {
      await handleOpencodeSetup(controlId, value, controlMsg)
    } else if (stepType === 'generar_commit_setup') {
      await handleGenerarCommitSetup(controlId, value, controlMsg)
    } else if (stepType === 'ambientes_diff_testing_setup') {
      await handleAmbientesDiffTestingSetup(controlId, value, controlMsg)
    } else if (stepType === 'documentacion_update') {
      await handleDocumentacionUpdate(controlId, value, controlMsg)
    } else if (stepType === 'deteccion_model_setup') {
      const subStepType = controlMsg.controlData.subStepType
      if (subStepType === 'model') {
        const { startDeteccionProcessing } = await import('../composables/commands/deteccionFuncionalidades.js')
        await ocStore.select('model', value)
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'opencode_confirmed',
            content: value,
            _key: 'confirmed-' + Date.now(),
          }
        }
        chat.pushMessage({
          role: 'opencode_control',
          controlData: {
            controlId: 'df-thinking-' + Date.now(),
            controlType: 'select',
            stepType: 'deteccion_model_setup',
            subStepType: 'thinking',
            options: [
              { label: 'Low — mínimo esfuerzo de razonamiento (Flash)', value: 'low' },
              { label: 'Medium — equilibrio velocidad/profundidad', value: 'medium' },
              { label: 'High — máximo razonamiento profundo', value: 'high' },
            ],
            placeholder: 'Selecciona nivel de pensamiento...',
            preselect: ocStore.savedThinking || 'low',
          },
          _key: 'ctrl-thinking-' + Date.now(),
        })
      } else if (subStepType === 'thinking') {
        const { startDeteccionProcessing } = await import('../composables/commands/deteccionFuncionalidades.js')
        await ocStore.select('thinking', value)
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'opencode_confirmed',
            content: value,
            _key: 'confirmed-' + Date.now(),
          }
        }
        const model = ocStore.selectedModel || 'deepseek-chat'
        await startDeteccionProcessing(chat.activeSessionId, chat, model, value)
      }
      return
    } else if (stepType === 'ticket_descripcion') {
      if (controlType === 'followup' || controlType === 'opencode_form') {
        const { model, thinking, mode, temperature, prompt } = value
        if (!prompt) return
        ocStore.selectedModel = model || ocStore.selectedModel
        ocStore.selectedThinking = thinking || ocStore.selectedThinking
        ocStore.selectedMode = mode || ocStore.selectedMode
        ocStore.selectedTemperature = temperature || ocStore.selectedTemperature
        descripcionData.mode = ocStore.selectedMode
        await opencodeStreamDescripcionFollowup(chat.activeSessionId, prompt, controlMsg.controlData.ticket, temperature || descripcionData.temperature || ocStore.selectedTemperature || '', descripcionData)
        return
      } else if (value === null) {
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = { role: 'result', content: 'Edición de descripción cancelada.', _key: 'result-' + Date.now() }
        }
        return
      } else {
        await handleTicketDescripcion(controlId, value, controlMsg)
        return
      }
    } else if (controlType === 'descripcion_edit') {
      if (value === null) {
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = { role: 'result', content: 'Edición de descripción cancelada.', _key: 'result-' + Date.now() }
        }
        return
      }
      try {
        const res = await fetch(`/api/tickets/session/${chat.activeSessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ description: value.description }),
        })
        const data = await res.json()
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          if (data.success) {
            chat.messages[idx] = {
              role: 'result',
              content: `✓ Descripción del ticket #${data.ticket.redmine_id} actualizada correctamente.`,
              _key: 'result-' + Date.now(),
            }
          } else {
            chat.messages[idx] = {
              role: 'result',
              content: `Error: ${data.error || 'Error al actualizar la descripción'}`,
              _key: 'err-' + Date.now(),
            }
          }
        }
      } catch (err) {
        console.error('Error al actualizar descripción:', err)
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'Error de conexión al actualizar la descripción.',
            _key: 'err-' + Date.now(),
          }
        }
      }
      return
    } else if (stepType === 'repo_crear_rama') {
      await handleRepoCrearRama(controlId, value, controlMsg)
      return
    } else if (stepType === 'new_session_workspace') {
      await handleNewSessionWorkspace(controlId, value, controlMsg)
      return
    } else if (stepType === 'new_session_project') {
      await handleNewSessionProject(controlId, value, controlMsg)
      return
    } else if (stepType === 'new_session_ticket') {
      await handleNewSessionTicket(controlId, value, controlMsg)
      return
    } else if (controlType === 'descripcion_result') {
      if (value === null) {
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = { role: 'result', content: 'Edición de descripción cancelada.', _key: 'result-' + Date.now() }
        }
      } else if (value.action === 'accept') {
        await refinarDescripcionConDeepSeek(controlId, controlMsg, value.description)
      } else if (value.action === 'retry') {
        await regenerateDescripcion(controlId, controlMsg)
      }
      return
    } else if (controlType === 'refinar_result') {
      if (value === null) {
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = { role: 'result', content: 'Descripción descartada.', _key: 'result-' + Date.now() }
        }
      } else if (value.action === 'accept') {
        try {
          const res = await fetch(`/api/tickets/session/${chat.activeSessionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ description: value.description }),
          })
          const data = await res.json()
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            if (data.success) {
              chat.messages[idx] = {
                role: 'result',
                content: `✓ Descripción del ticket #${data.ticket.redmine_id} actualizada correctamente.`,
                _key: 'result-' + Date.now(),
              }
            } else {
              chat.messages[idx] = {
                role: 'result',
                content: `Error: ${data.error || 'Error al actualizar la descripción'}`,
                _key: 'err-' + Date.now(),
              }
            }
          }
        } catch (err) {
          console.error('Error al actualizar descripción:', err)
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: 'Error de conexión al actualizar la descripción.',
              _key: 'err-' + Date.now(),
            }
          }
        }
      } else if (value.action === 'retry') {
        await restartTicketDescripcion()
      }
      return
    } else if (controlType === 'commit_result') {
      if (value === null) {
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'Generación de commit cancelada.',
            _key: 'result-' + Date.now(),
          }
        }
      } else if (value.action === 'retry') {
        await regenerateCommit(controlId, controlMsg)
      } else if (value.action === 'confirm') {
        await executeCommit(controlId, controlMsg, value.message, value.addComment, value.modo_envio)
      }
      return
    } else if (controlType === 'ambientes_diff_comment') {
      if (value === null) {
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'Generación de comentario cancelada.',
            _key: 'result-' + Date.now(),
          }
        }
      } else if (value.action === 'confirm') {
        await executeAmbientesDiffComment(controlId, controlMsg, value.message, value.modo_envio)
      }
      return
    } else if (controlType === 'ticket_comment') {
      if (value === null) {
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'Comentario cancelado.',
            _key: 'result-' + Date.now(),
          }
        }
      } else if (value.action === 'confirm') {
        await executeTicketComment(controlId, controlMsg, value.message, value.modo_envio)
      }
      return
    } else if (stepType === 'resolution_set_default') {
      try {
        await settingSet('default_resolution', value)
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: `✓ Resolución por defecto establecida: "${value}"`,
            _key: 'result-' + Date.now(),
          }
        }
      } catch (err) {
        console.error('Error al guardar resolución por defecto:', err.message)
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'Error al guardar la resolución por defecto.',
            _key: 'err-' + Date.now(),
          }
        }
      }
      return
    } else if (controlType === 'funcionalidad_list') {
      modal.open(FuncionalidadWizard, {
        sessionId: value.sessionId,
        proyectoId: value.proyectoId,
      }, { title: 'Editar funcionalidad', wide: true })
      return
    } else if (controlType === 'ticket_edit') {
      if (value === null) {
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'Edición cancelada.',
            _key: 'result-' + Date.now(),
          }
        }
        return
      }
      try {
        const res = await fetch(`/api/tickets/session/${chat.activeSessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(value),
        })
        const data = await res.json()
        if (data.success) {
          ticketInfo.value = data.ticket
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: `✓ Ticket #${data.ticket.redmine_id} actualizado correctamente.`,
              _key: 'result-' + Date.now(),
            }
          }
        } else {
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: `Error: ${data.error || 'Error al actualizar ticket'}`,
              _key: 'err-' + Date.now(),
            }
          }
        }
      } catch (err) {
        console.error('Error al actualizar ticket:', err)
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'Error de conexión al actualizar el ticket.',
            _key: 'err-' + Date.now(),
          }
        }
      }
      return
    } else if (controlType === 'ticket_create') {
      if (value === null) {
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'Creación cancelada.',
            _key: 'result-' + Date.now(),
          }
        }
        return
      }
      try {
        const res = await fetch('/api/tickets/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(value),
        })
        const data = await res.json()
        if (data.success) {
          const ticketRedmineId = data.ticket.redmine_id
          const sessionId = chat.activeSessionId

          if (value.autoAssign && sessionId && ticketRedmineId) {
            try {
              const tr = await fetch('/api/tickets/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ sessionId, idTicketRedmine: ticketRedmineId }),
              })
              const td = await tr.json()
              if (td.workspaceIds) {
                const ws = useWorkspaceStore()
                const au = useAuthStore()
                ws.selectedIds = td.workspaceIds
                au.setWorkspaceIds(td.workspaceIds)
              }
              await chat.loadSessions()
              await loadTicketInfo()
            } catch (err) {
              console.error('Error al asignar ticket a sesión:', err)
            }
          }

          const ticketStore = useTicketStore()
          ticketStore.loadTickets()

          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: `✓ Ticket #${ticketRedmineId} creado correctamente en el proyecto "${data.ticket.proyecto_id}".`,
              _key: 'result-' + Date.now(),
            }
          }

          if (value.createBranch) {
            try {
              if (value.project_id) {
                const pr = await fetch('/api/proyecto/session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ sessionId: chat.activeSessionId, proyectoId: value.project_id, cwd: '' }),
                })
                const pd = await pr.json()
                if (pd.workspaceIds) {
                  const ws4 = useWorkspaceStore()
                  const au4 = useAuthStore()
                  ws4.selectedIds = pd.workspaceIds
                  au4.setWorkspaceIds(pd.workspaceIds)
                }
              }
              if (!value.autoAssign && ticketRedmineId) {
                const tr2 = await fetch('/api/tickets/session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ sessionId: chat.activeSessionId, idTicketRedmine: ticketRedmineId }),
                })
                const td2 = await tr2.json()
                if (td2.workspaceIds) {
                  const ws2 = useWorkspaceStore()
                  const au2 = useAuthStore()
                  ws2.selectedIds = td2.workspaceIds
                  au2.setWorkspaceIds(td2.workspaceIds)
                }
              }
              await chat.loadSessions()

              const settingsRes = await fetch('/api/settings', { credentials: 'include' })
              const settingsData = await settingsRes.json()
              const repoAcronimo = settingsData.repo_acronimo || 'TKT'

              await showBranchSelector(chat.activeSessionId, repoAcronimo, value.project_id, ticketRedmineId)
            } catch (err) {
              console.error('Error al preparar creación de rama:', err)
            }
          }
        } else {
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: `Error: ${data.error || 'Error al crear ticket'}`,
              _key: 'err-' + Date.now(),
            }
          }
        }
      } catch (err) {
        console.error('Error al crear ticket:', err)
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'Error de conexión al crear el ticket.',
            _key: 'err-' + Date.now(),
          }
        }
      }
      return
    } else if (controlType === 'redmine_comments_send') {
      if (value === null) {
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'Envío de comentarios cancelado.',
            _key: 'result-' + Date.now(),
          }
        }
        return
      }
      try {
        const res = await fetch('/api/redmine/comments/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            comentarios_ids: value.comentarios_ids,
            mensaje: value.mensaje,
          }),
        })
        const data = await res.json()
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          if (data.success) {
            redmineComments.refreshComments(chat.activeSessionId)
            chat.messages[idx] = {
              role: 'result',
              content: `✓ ${data.cantidad} comentario${data.cantidad !== 1 ? 's' : ''} enviado${data.cantidad !== 1 ? 's' : ''} al ticket #${data.ticket_id} correctamente.`,
              _key: 'result-' + Date.now(),
            }
          } else {
            chat.messages[idx] = {
              role: 'result',
              content: 'Error: ' + (data.error || 'Error al enviar comentarios'),
              _key: 'err-' + Date.now(),
            }
          }
        }
      } catch (err) {
        console.error('Error al enviar comentarios Redmine:', err.message)
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'Error de conexión al enviar comentarios.',
            _key: 'err-' + Date.now(),
          }
        }
      }
      return
    } else if (controlType === 'comando_edit') {
      if (value === null) {
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'Edición cancelada.',
            _key: 'result-' + Date.now(),
          }
        }
        return
      }
      const ctrlMsg = chat.messages.find((m) => m.controlData && m.controlData.controlId === controlId)
      const mode = ctrlMsg?.controlData?.mode || 'create'
      const proyectoId = ctrlMsg?.controlData?.proyectoId
      const id = ctrlMsg?.controlData?.id

      try {
        const store = useComandosPersonalizadosStore()
        if (mode === 'create') {
          await store.createCommand({
            label: value.label,
            descripcion: value.descripcion || '',
            id_proyecto: proyectoId,
            comando: value.comando,
            ocultar_ejecucion: value.ocultarEjecucion || false,
          })
        } else if (mode === 'update' && id) {
          await store.updateCommand(id, {
            label: value.label,
            descripcion: value.descripcion || '',
            comando: value.comando,
            ocultar_ejecucion: value.ocultarEjecucion || false,
          })
        }
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: `✓ Comando "${value.label}" ${mode === 'create' ? 'creado' : 'actualizado'} correctamente.`,
            _key: 'result-' + Date.now(),
          }
        }
      } catch (err) {
        console.error('Error al guardar comando personalizado:', err)
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'Error: ' + err.message,
            _key: 'err-' + Date.now(),
          }
        }
      }
      return
    } else if (controlType === 'peticion') {
      if (value === null) {
        const ctrl = peticionControllers[controlId]
        if (ctrl) {
          ctrl.abort()
          delete peticionControllers[controlId]
        }
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = { role: 'result', content: 'Petición detenida.', _key: 'result-' + Date.now() }
        }
        return
      }

      const controller = new AbortController()
      peticionControllers[controlId] = controller

      const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
      if (idx >= 0) {
        chat.messages[idx].controlData.sending = true
        chat.messages[idx].controlData.progressText = '🌐 Conectando con ' + value.method + ' ' + value.url + '...'
      }

      let payload
      try {
        const res = await fetch('/api/proxy/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(value),
          signal: controller.signal,
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Error del servidor proxy')
        }
        payload = await res.json()
      } catch (err) {
        if (err.name === 'AbortError') {
          if (idx >= 0) {
            chat.messages[idx] = { role: 'result', content: 'Petición detenida.', _key: 'result-' + Date.now() }
          }
          return
        }
        console.error('Error en petición proxy:', err)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'opencode_control',
            controlData: {
              controlType: 'peticion_result',
              payload: { status: 0, statusText: 'Error', headers: {}, body: '', truncated: false, bodySize: 0, elapsed: 0, error: err.message },
            },
            _key: 'result-' + Date.now(),
          }
        }
        return
      } finally {
        delete peticionControllers[controlId]
      }

      if (idx >= 0) {
        chat.messages[idx] = {
          role: 'opencode_control',
          controlData: {
            controlType: 'peticion_result',
            payload,
          },
          _key: 'result-' + Date.now(),
        }
      }

      const proyectoId = await _getProyectoId()
      if (proyectoId) {
        try {
          await projectVarStore.saveVariable(proyectoId, 'peticion_datos', JSON.stringify(value))
        } catch (err) {
          console.error('Error al guardar peticion_datos:', err.message)
        }
      }
      return
    } else if (controlType === 'cd_selector') {
      try {
        const res = await fetch('/api/command/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ command: `/cd ${value}`, sessionId: chat.activeSessionId }),
        })
        const data = await res.json()
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (data.success) {
          cmdStore.currentDir = data.result
          const session = chat.sessions.find(s => Number(s.id) === Number(chat.activeSessionId))
          if (session) session.cwd = data.result
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: `✓ Directorio cambiado a: ${data.result}`,
              _key: 'result-' + Date.now(),
            }
          }
        } else {
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: 'Error: ' + (data.result || 'Error al cambiar de directorio'),
              _key: 'err-' + Date.now(),
            }
          }
        }
      } catch (err) {
        console.error('Error en /cd:', err.message)
        const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'Error de conexión: ' + err.message,
            _key: 'err-' + Date.now(),
          }
        }
      }
      return
    } else if (controlType === 'followup') {
      let { model, thinking, temperature, prompt } = value
      if (!prompt) return
      prompt = await resolveInput(prompt)
      ocStore.selectedModel = model || ocStore.selectedModel
      ocStore.selectedThinking = thinking || ocStore.selectedThinking
      ocStore.selectedTemperature = temperature || ocStore.selectedTemperature
      await opencodeStreamPrompt(
        chat.activeSessionId,
        prompt,
        ocStore.selectedProvider,
        ocStore.selectedModel,
        ocStore.selectedThinking,
        ocStore.selectedMode,
        ocStore.selectedTemperature,
      )
      return
    } else if (controlType === 'opencode_form') {
      let { model, thinking, mode, temperature, prompt } = value
      if (!prompt) return
      prompt = await resolveInput(prompt)
      ocStore.selectedModel = model || ocStore.selectedModel
      ocStore.selectedThinking = thinking || ocStore.selectedThinking
      ocStore.selectedMode = mode || ocStore.selectedMode
      ocStore.selectedTemperature = temperature || ocStore.selectedTemperature
      await opencodeStreamPrompt(
        chat.activeSessionId,
        prompt,
        ocStore.selectedProvider,
        ocStore.selectedModel,
        ocStore.selectedThinking,
        ocStore.selectedMode,
        ocStore.selectedTemperature,
      )
      return
    } else {
      try {
        await fetch('/api/opencode/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ controlId, response: value }),
        })
      } catch (err) {
        console.error('Error en control confirm:', err)
      }
    }

    const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
    if (idx >= 0) {
      chat.messages[idx] = {
        role: 'opencode_confirmed',
        content: typeof value === 'object' ? JSON.stringify(value) : String(value),
        _key: 'confirmed-' + Date.now(),
      }
    }
  }

  async function handleDocumentacionUpdate(controlId, value, controlMsg) {
    const subStepType = controlMsg.controlData.subStepType

    if (subStepType === 'provider') {
      docUpdateData.provider = value
      docUpdateData.proyectoId = controlMsg.controlData.proyectoId || ''
      docUpdateData.docType = controlMsg.controlData.docType || ''
      await ocStore.select('provider', value)
      ocStore.selectedProvider = value
      const models = ocStore.getModelsForProvider(value)
      chat.pushMessage({
        role: 'opencode_control',
        controlData: {
          controlId: 'model-' + Date.now(),
          controlType: 'select',
          stepType: 'documentacion_update',
          subStepType: 'model',
          options: models,
          placeholder: 'Selecciona modelo...',
          preselect: ocStore.savedModel || '',
        },
        _key: 'control-' + Date.now(),
      })
    } else if (subStepType === 'model') {
      docUpdateData.model = value
      await ocStore.select('model', value)
      ocStore.selectedModel = value
      if (ocStore.modelSupportsReasoning(docUpdateData.provider, value)) {
        chat.pushMessage({
          role: 'opencode_control',
          controlData: {
            controlId: 'thinking-' + Date.now(),
            controlType: 'select',
            stepType: 'documentacion_update',
            subStepType: 'thinking',
            options: ocStore.thinkingOptions,
            placeholder: 'Selecciona nivel de pensamiento...',
            preselect: ocStore.savedThinking || 'medium',
          },
          _key: 'control-' + Date.now(),
        })
      } else {
        const fakeMsg = { controlData: { subStepType: 'thinking' } }
        await handleDocumentacionUpdate(null, null, fakeMsg)
      }
    } else if (subStepType === 'thinking') {
      docUpdateData.thinking = value
      await ocStore.select('thinking', value)
      ocStore.selectedThinking = value
      const fakeMsg = { controlData: { subStepType: 'mode' } }
      await handleDocumentacionUpdate(null, null, fakeMsg)
    } else if (subStepType === 'mode') {
      docUpdateData.mode = 'Plan'
      await ocStore.select('mode', 'Plan')
      ocStore.selectedMode = 'Plan'

      try {
        const tipos = docUpdateData.docType === 'all'
          ? ['base_datos', 'subproyectos', 'endpoints', 'web_sockets', 'funcionalidades']
          : [docUpdateData.docType]
        const settingsRes = await fetch('/api/settings', { credentials: 'include' })
        const settingsKeys = await settingsRes.json()

        const DOC_LABELS = {
          base_datos: 'Base de Datos',
          subproyectos: 'Subproyectos',
          endpoints: 'Endpoints',
          web_sockets: 'WebSockets',
          funcionalidades: 'Funcionalidades',
        }

        for (const tipo of tipos) {
          const promptKey = 'documentacion_prompt_' + tipo
          const defaultPrompt = 'Analiza el proyecto actual y documenta la información correspondiente a ' + (DOC_LABELS[tipo] || tipo) + '. Proporciona una descripción detallada que permita a otros agentes de IA entender su propósito y alcance.'
          const prompt = settingsKeys[promptKey] || defaultPrompt

          chat.pushMessage({
            role: 'opencode_info',
            content: '📋 Prompt a enviar a OpenCode:\n\n```\n' + prompt + '\n```',
            _key: 'preview-' + Date.now(),
          })

          await opencodeStreamPromptDocUpdate(
            chat.activeSessionId,
            prompt,
            docUpdateData.provider,
            docUpdateData.model,
            docUpdateData.thinking,
            docUpdateData.mode,
            docUpdateData.temperature || ocStore.selectedTemperature || '',
            docUpdateData.proyectoId,
            tipo,
          )
        }

        if (docUpdateData.docType === 'all') {
          chat.pushMessage({
            role: 'result',
            content: 'Documentación completada para todos los tipos.',
            _key: 'result-' + Date.now(),
          })
        }
      } catch (err) {
        console.error('Error al obtener prompt de documentación:', err.message)
        chat.pushMessage({
          role: 'result',
          content: 'Error al obtener prompt de documentación: ' + err.message,
          _key: 'result-' + Date.now(),
        })
      }
    }
  }

  async function handleTicketDescripcion(controlId, value, controlMsg) {
    const subStepType = controlMsg.controlData.subStepType

    if (subStepType === 'provider') {
      descripcionData.provider = value
      await ocStore.select('provider', value)
      ocStore.selectedProvider = value
      const models = ocStore.getModelsForProvider(value)
      chat.pushMessage({
        role: 'opencode_control',
        controlData: {
          controlId: 'model-' + Date.now(),
          controlType: 'select',
          stepType: 'ticket_descripcion',
          subStepType: 'model',
          options: models,
          placeholder: 'Selecciona modelo...',
          preselect: ocStore.savedModel || '',
          ticket: controlMsg.controlData.ticket,
          sessionId: controlMsg.controlData.sessionId,
        },
        _key: 'control-' + Date.now(),
      })
    } else if (subStepType === 'model') {
      descripcionData.model = value
      await ocStore.select('model', value)
      ocStore.selectedModel = value
      if (ocStore.modelSupportsReasoning(descripcionData.provider, value)) {
        chat.pushMessage({
          role: 'opencode_control',
          controlData: {
            controlId: 'thinking-' + Date.now(),
            controlType: 'select',
            stepType: 'ticket_descripcion',
            subStepType: 'thinking',
            options: ocStore.thinkingOptions,
            placeholder: 'Selecciona nivel de pensamiento...',
            preselect: ocStore.savedThinking || 'medium',
            ticket: controlMsg.controlData.ticket,
            sessionId: controlMsg.controlData.sessionId,
          },
          _key: 'control-' + Date.now(),
        })
      } else {
        const fakeMsg = { controlData: { subStepType: 'thinking', ticket: controlMsg.controlData.ticket, sessionId: controlMsg.controlData.sessionId } }
        await handleTicketDescripcion(null, null, fakeMsg)
      }
    } else if (subStepType === 'thinking') {
      descripcionData.thinking = value
      await ocStore.select('thinking', value)
      ocStore.selectedThinking = value
      chat.pushMessage({
        role: 'opencode_control',
        controlData: {
          controlId: 'descripcion-input-' + Date.now(),
          controlType: 'descripcion_input',
          stepType: 'ticket_descripcion',
          subStepType: 'descripcion_input',
          placeholder: 'Ej: Describe el error y los pasos para reproducirlo...',
          ticket: controlMsg.controlData.ticket,
          sessionId: controlMsg.controlData.sessionId,
        },
        _key: 'control-' + Date.now(),
      })
    } else if (subStepType === 'descripcion_input') {
      descripcionUserInput.value = value.text
      const ticket = controlMsg.controlData.ticket

      try {
        const settingsRes = await fetch('/api/settings', { credentials: 'include' })
        const settingsKeys = await settingsRes.json()
        const defaultPrompt = 'Eres un asistente experto en redactar descripciones técnicas para tickets de Redmine. Tu objetivo principal es generar una descripción ÓPTIMA y detallada para el siguiente ticket:\n\nContexto del ticket:\n- Título: {subject}\n- Estado actual: {status}\n- Prioridad: {priority}\n- Asignado a: {assigned_to}\n\nInstrucciones:\n1. Genera una descripción clara, precisa y bien estructurada que explique el problema o requerimiento del ticket.\n2. Utiliza la siguiente solicitud del usuario como guía para el contenido:\n{user_input}\n3. La descripción debe ser profesional, técnica y útil para desarrolladores.\n4. Incluye solo información relevante al ticket, sin divagaciones.'
        const promptTemplate = settingsKeys.ticket_descripcion_prompt || defaultPrompt
        const prompt = promptTemplate
          .replace(/{subject}/g, ticket.subject || '')
          .replace(/{status}/g, ticket.status_name || '')
          .replace(/{priority}/g, ticket.priority_name || '')
          .replace(/{assigned_to}/g, ticket.assigned_to_name || '')
          .replace(/{user_input}/g, descripcionUserInput.value)

        chat.pushMessage({
          role: 'opencode_info',
          content: '📤 Prompt enviado a OpenCode:\n\n' + prompt,
          _key: 'prompt-' + Date.now(),
        })

        await opencodeStreamDescripcion(
          chat.activeSessionId,
          prompt,
          descripcionData.provider,
          descripcionData.model,
          descripcionData.thinking,
          descripcionData.mode,
          descripcionData.temperature || ocStore.selectedTemperature || '',
          ticket,
        )
      } catch (err) {
        console.error('Error al obtener prompt de descripción:', err.message)
        chat.pushMessage({
          role: 'result',
          content: 'Error al obtener prompt de descripción: ' + err.message,
          _key: 'err-' + Date.now(),
        })
      }
    }
  }

  async function handleRepoCrearRama(controlId, value, controlMsg) {
    const subStepType = controlMsg.controlData.subStepType

    if (subStepType === 'project') {
      repoCrearRamaData.proyectoId = value
      repoCrearRamaData.repoAcronimo = controlMsg.controlData.repoAcronimo || 'TKT'

      try {
        const res = await fetch('/api/proyecto/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ sessionId: chat.activeSessionId, proyectoId: value, cwd: '' }),
        })
        const data = await res.json()
        if (!data.success) {
          console.error('Error al asignar proyecto:', data.error)
        }
        if (data.workspaceIds) {
          const ws5 = useWorkspaceStore()
          const au5 = useAuthStore()
          ws5.selectedIds = data.workspaceIds
          au5.setWorkspaceIds(data.workspaceIds)
        }
      } catch (err) {
        console.error('Error al asignar proyecto:', err.message)
      }

      const idx = chat.messages.findIndex(m => m.controlData && m.controlData.controlId === controlId)
      if (idx >= 0) {
        chat.messages[idx] = { role: 'opencode_confirmed', content: value, _key: 'confirmed-' + Date.now() }
      }

      await chat.loadSessions()
      const updatedSession = chat.sessions.find(s => s.id === chat.activeSessionId)

      if (updatedSession && updatedSession.id_ticket_redmine) {
        repoCrearRamaData.ticketRedmineId = updatedSession.id_ticket_redmine
        await showBranchSelector(controlMsg.controlData.sessionId, repoCrearRamaData.repoAcronimo, updatedSession.proyecto_id, updatedSession.id_ticket_redmine, controlMsg.controlData.baseBranch)
      } else {
        const ticketRes = await fetch('/api/tickets', { credentials: 'include' })
        const ticketData = await ticketRes.json()
        let tickets = ticketData.tickets || []
        if (value) {
          tickets = tickets.filter(t => t.proyecto_id === value)
        }
        const options = tickets.map(t => ({
          label: `#${t.redmine_id} — ${t.subject || ''}`,
          value: String(t.redmine_id),
        }))
        chat.pushMessage({
          role: 'opencode_control',
          controlData: {
            controlId: 'repo-ticket-' + Date.now(),
            controlType: 'select',
            stepType: 'repo_crear_rama',
            subStepType: 'ticket',
            options,
            placeholder: 'Selecciona ticket...',
            proyectoId: value,
            sessionId: controlMsg.controlData.sessionId,
            repoAcronimo: repoCrearRamaData.repoAcronimo,
            baseBranch: controlMsg.controlData.baseBranch,
          },
          _key: 'control-' + Date.now(),
        })
      }
    } else if (subStepType === 'ticket') {
      repoCrearRamaData.ticketRedmineId = value
      repoCrearRamaData.proyectoId = controlMsg.controlData.proyectoId || ''
      repoCrearRamaData.repoAcronimo = controlMsg.controlData.repoAcronimo || 'TKT'

      try {
        const res = await fetch('/api/tickets/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ sessionId: chat.activeSessionId, idTicketRedmine: parseInt(value) }),
        })
        const data = await res.json()
        if (!data.success) {
          console.error('Error al asignar ticket:', data.error)
        }
        if (data.workspaceIds) {
          const ws3 = useWorkspaceStore()
          const au3 = useAuthStore()
          ws3.selectedIds = data.workspaceIds
          au3.setWorkspaceIds(data.workspaceIds)
        }
      } catch (err) {
        console.error('Error al asignar ticket:', err.message)
      }

      const idx = chat.messages.findIndex(m => m.controlData && m.controlData.controlId === controlId)
      if (idx >= 0) {
        chat.messages[idx] = { role: 'opencode_confirmed', content: '#' + value, _key: 'confirmed-' + Date.now() }
      }

      await chat.loadSessions()
      const updatedSession = chat.sessions.find(s => s.id === chat.activeSessionId)

      await showBranchSelector(controlMsg.controlData.sessionId, repoCrearRamaData.repoAcronimo, repoCrearRamaData.proyectoId || updatedSession?.proyecto_id, parseInt(value), controlMsg.controlData.baseBranch)
    } else if (subStepType === 'branch') {
      repoCrearRamaData.baseBranch = value
      const proyectoId = controlMsg.controlData.proyectoId || repoCrearRamaData.proyectoId
      const ticketRedmineId = controlMsg.controlData.ticketRedmineId || repoCrearRamaData.ticketRedmineId
      const repoAcronimo = controlMsg.controlData.repoAcronimo || repoCrearRamaData.repoAcronimo || 'TKT'
      const sessionId = controlMsg.controlData.sessionId || chat.activeSessionId

      await performBranchCreation(sessionId, value, proyectoId, ticketRedmineId, repoAcronimo, controlId)
    }
    fetchGitBranch()
  }

  async function showBranchSelector(sessionId, repoAcronimo, proyectoId, ticketRedmineId, baseBranch) {
    if (baseBranch) {
      await performBranchCreation(sessionId, baseBranch, proyectoId, ticketRedmineId, repoAcronimo)
      return
    }

    try {
      const branchRes = await fetch('/api/command/git-list-branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId }),
      })
      const branchData = await branchRes.json()
      const branchOptions = (branchData.branches || []).map(b => ({ label: b, value: b }))
      const preselect = branchData.current && branchData.branches.includes(branchData.current) ? branchData.current : 'DEV'

      chat.pushMessage({
        role: 'opencode_control',
        controlData: {
          controlId: 'repo-branch-' + Date.now(),
          controlType: 'select',
          stepType: 'repo_crear_rama',
          subStepType: 'branch',
          options: branchOptions,
          placeholder: 'Selecciona rama base...',
          preselect,
          proyectoId,
          ticketRedmineId,
          sessionId,
          repoAcronimo,
        },
        _key: 'control-' + Date.now(),
      })
    } catch (err) {
      console.error('Error al obtener ramas:', err.message)
      chat.pushMessage({
        role: 'result',
        content: 'Error al listar ramas Git: ' + err.message,
        _key: 'err-' + Date.now(),
      })
    }
  }

  async function performBranchCreation(sessionId, baseBranch, proyectoId, ticketRedmineId, repoAcronimo, controlId) {
    const branchName = repoAcronimo + '-' + ticketRedmineId

    const updateMsg = (content, type) => {
      if (controlId) {
        const idx = chat.messages.findIndex(m => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = { role: 'result', content, _key: type + '-' + Date.now() }
        }
      } else {
        chat.pushMessage({ role: 'result', content, _key: type + '-' + Date.now() })
      }
    }

    try {
      const checkoutRes = await fetch('/api/command/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command: 'checkout ' + baseBranch, sessionId }),
      })
      const checkoutData = await checkoutRes.json()
      if (!checkoutData.success) {
        updateMsg('Error al cambiar a rama base "' + baseBranch + '": ' + (checkoutData.stderr || checkoutData.error || 'Error desconocido'), 'err')
        return
      }

      const branchRes = await fetch('/api/command/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command: 'checkout -b ' + branchName, sessionId }),
      })
      const branchData = await branchRes.json()

      if (branchData.success) {
        updateMsg('Rama creada correctamente: `' + branchName + '` (base: `' + baseBranch + '`)', 'result')
      } else {
        updateMsg('Error al crear rama "' + branchName + '": ' + (branchData.stderr || branchData.error || 'Error desconocido'), 'err')
      }
    } catch (err) {
      console.error('Error en repo:crear_rama:', err.message)
      updateMsg('Error de conexión: ' + err.message, 'err')
    }
  }

  async function refinarDescripcionConDeepSeek(controlId, controlMsg, description) {
    const sid = chat.activeSessionId
    ocStreaming.value = true
    ocChunk.value = ''
    ocThinking.value = ''
    streamSessionId.value = sid
    if (sid) chat.setSessionStatus(sid, 'executing')
    chat.setOcStreaming(sid, true)

    const streamMsg = await addMessage('opencode_stream', '', { streaming: true })
    streamMsg._key = 'stream-' + Date.now()

    try {
      const settingsRes = await fetch('/api/settings', { credentials: 'include' })
      const settingsKeys = await settingsRes.json()
      const systemPrompt = settingsKeys.ticket_refinar_prompt || 'Eres un asistente especializado en refinar descripciones técnicas. Mejora la redacción, estructura y claridad del texto. Devuelve únicamente la descripción refinada.'

      const res = await fetch('/api/chat/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: description, systemPrompt, sessionId: sid }),
      })

      if (!res.ok) {
        let errMsg = 'Error al refinar descripción'
        try { const errData = await res.json(); if (errData.error) errMsg = errData.error } catch {}
        throw new Error(errMsg)
      }

      let fullResponse = ''
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
              fullResponse += j.content
              ocChunk.value += j.content
              chat.updateOcStreamCache(sid, ocChunk.value, ocThinking.value, streamMsg._key)
            } else if (j.type === 'thinking') {
              ocThinking.value += j.content
              chat.updateOcStreamCache(sid, ocChunk.value, ocThinking.value, streamMsg._key)
            } else if (j.type === 'error') {
              throw new Error(j.content)
            }
          } catch (e) {
            if (e.message && e.message !== 'Unexpected end of JSON input') throw e
          }
        }
      }

      chat.setOcStreaming(sid, false)
      chat.clearOcStreamCache(sid)
      if (sid) chat.setSessionStatus(sid, 'idle')

      if (isActiveSession(sid)) {
        const ticket = controlMsg?.controlData?.ticket || {}
        const oldIdx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (oldIdx >= 0) {
          chat.messages[oldIdx] = {
            role: 'result',
            content: '✓ Descripción aceptada, refinando...',
            _key: 'old-result-' + Date.now(),
          }
        }
        const streamIdx = chat.messages.findIndex((m) => m._key === streamMsg._key)
        if (streamIdx >= 0) {
          chat.messages[streamIdx] = {
            role: 'opencode_control',
            controlData: {
              controlId: 'refinar-result-' + Date.now(),
              controlType: 'refinar_result',
              description: fullResponse,
              loading: false,
              ticket,
            },
            _key: 'control-' + Date.now(),
          }
        }
      }
    } catch (err) {
      console.error('Error al refinar descripción:', err.message)
      chat.setOcStreaming(sid, false)
      chat.clearOcStreamCache(sid)
      if (sid) chat.setSessionStatus(sid, 'error')
      const streamIdx = chat.messages.findIndex((m) => m._key === streamMsg._key)
      if (streamIdx >= 0 && isActiveSession(sid)) {
        chat.messages[streamIdx].content = '[Error: ' + err.message + ']'
        chat.messages[streamIdx].streaming = false
      }
    }
  }

  async function restartTicketDescripcion() {
    const sid = chat.activeSessionId
    if (!sid) return

    try {
      const res = await fetch(`/api/tickets/session/${sid}`, { credentials: 'include' })
      const data = await res.json()
      if (!data.idTicketRedmine || !data.ticket) {
        chat.pushMessage({
          role: 'result',
          content: 'Error: No hay ticket asignado a esta sesión.',
          _key: 'err-' + Date.now(),
        })
        return
      }

      const ocStoreLocal = useOpencodeStore()
      const startData = await ocStoreLocal.start()
      if (!startData) {
        chat.pushMessage({
          role: 'result',
          content: 'Error al iniciar OpenCode.',
          _key: 'err-' + Date.now(),
        })
        return
      }

      const providerList = ocStoreLocal.getAvailableProviders()
      if (providerList.length === 0) {
        chat.pushMessage({
          role: 'result',
          content: 'No se encontraron proveedores de OpenCode.',
          _key: 'err-' + Date.now(),
        })
        return
      }

      const preselectProvider = ocStoreLocal.savedProvider || providerList[0].value
      chat.pushMessage({
        role: 'opencode_control',
        controlData: {
          controlId: 'provider-' + Date.now(),
          controlType: 'select',
          stepType: 'ticket_descripcion',
          subStepType: 'provider',
          options: providerList,
          placeholder: 'Selecciona proveedor...',
          preselect: preselectProvider,
          ticket: data.ticket,
          sessionId: sid,
        },
        _key: 'control-' + Date.now(),
      })
    } catch (err) {
      console.error('Error al reiniciar:', err.message)
      chat.pushMessage({
        role: 'result',
        content: 'Error al reiniciar el proceso: ' + err.message,
        _key: 'err-' + Date.now(),
      })
    }
  }

  async function regenerateDescripcion(controlId, controlMsg) {
    const oldIdx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
    if (oldIdx >= 0 && isActiveSession(chat.activeSessionId)) {
      chat.messages[oldIdx].controlData.loading = true
    }

    const newStreamKey = 'stream-' + Date.now()
    const sid = chat.activeSessionId

    if (isActiveSession(sid)) {
      chat.pushMessage({
        role: 'opencode_stream',
        content: '',
        streaming: true,
        _key: newStreamKey,
      })
    }
    chat.setOcStreaming(sid, true)

    const ticket = controlMsg?.controlData?.ticket || {}
    ocStore.selectedModel = ocStore.selectedModel || descripcionData.model
    ocStore.selectedThinking = ocStore.selectedThinking || descripcionData.thinking

    try {
      const settingsRes = await fetch('/api/settings', { credentials: 'include' })
      const settingsKeys = await settingsRes.json()
      const defaultPrompt = 'Eres un asistente experto en redactar descripciones técnicas para tickets de Redmine. Tu objetivo principal es generar una descripción ÓPTIMA y detallada para el siguiente ticket:\n\nContexto del ticket:\n- Título: {subject}\n- Estado actual: {status}\n- Prioridad: {priority}\n- Asignado a: {assigned_to}\n\nInstrucciones:\n1. Genera una descripción clara, precisa y bien estructurada que explique el problema o requerimiento del ticket.\n2. Utiliza la siguiente solicitud del usuario como guía para el contenido:\n{user_input}\n3. La descripción debe ser profesional, técnica y útil para desarrolladores.\n4. Incluye solo información relevante al ticket, sin divagaciones.'
      const promptTemplate = settingsKeys.ticket_descripcion_prompt || defaultPrompt
      const prompt = promptTemplate
        .replace(/{subject}/g, ticket.subject || '')
        .replace(/{status}/g, ticket.status_name || '')
        .replace(/{priority}/g, ticket.priority_name || '')
        .replace(/{assigned_to}/g, ticket.assigned_to_name || '')
        .replace(/{user_input}/g, descripcionUserInput.value)

      if (isActiveSession(sid)) {
        chat.pushMessage({
          role: 'opencode_info',
          content: '📤 Prompt enviado a OpenCode:\n\n' + prompt,
          _key: 'prompt-' + Date.now(),
        })
      }

      await opencodeStreamDescripcion(
        sid,
        prompt,
        descripcionData.provider,
        descripcionData.model,
        descripcionData.thinking,
        descripcionData.mode,
        descripcionData.temperature || ocStore.selectedTemperature || '',
        ticket,
      )
    } catch (err) {
      console.error('Error al reintentar:', err.message)
      chat.setOcStreaming(sid, false)
      chat.clearOcStreamCache(sid)
      if (sid) chat.setSessionStatus(sid, 'error')
      if (oldIdx >= 0 && isActiveSession(sid)) {
        chat.messages[oldIdx].controlData.loading = false
      }
    }
  }

  async function handleOpencodeSetup(controlId, value, controlMsg) {
    const subStepType = controlMsg.controlData.subStepType

    if (subStepType === 'provider') {
      ocSetupData.provider = value
      await ocStore.select('provider', value)
      ocStore.selectedProvider = value
      ocStore.chatSessionId = chat.activeSessionId
      ocStore.saveCurrentToMap(chat.activeSessionId)
      const models = ocStore.getModelsForProvider(value)
      const prefill = controlMsg.controlData.prefill || ''
      const controlData = {
        controlId: 'opencode-form-' + Date.now(),
        controlType: 'opencode_form',
        stepType: 'opencode_setup',
        subStepType: 'form',
        models,
        modelValue: ocStore.savedModel || '',
        thinkingOptions: ocStore.thinkingOptions,
        thinkingValue: ocStore.savedThinking || '',
        temperatureOptions: ocStore.temperatureOptions,
        temperatureValue: ocStore.savedTemperature || '0.7',
        modeValue: ocStore.savedMode || 'Build',
        placeholder: prefill ? 'Revisa la descripción del ticket y modifícala si es necesario antes de enviar...' : 'Describe qué quieres que OpenCode haga...',
        rows: prefill ? 8 : 5,
        prefill,
        sessionId: chat.activeSessionId,
      }
      const formMsg = {
        role: 'opencode_control',
        content: JSON.stringify(controlData),
        controlData,
        _key: 'control-' + Date.now(),
      }
      chat.pushMessage(formMsg)
      chat._saveMessageToDb(chat.activeSessionId, formMsg)
    } else if (subStepType === 'form') {
        const { model, thinking, mode, temperature, prompt } = value
        ocSetupData.model = model
        ocSetupData.thinking = thinking
        ocSetupData.mode = mode
        ocSetupData.temperature = temperature
        ocSetupData.prompt = prompt
        await ocStore.select('model', model)
        await ocStore.select('thinking', thinking || '')
        await ocStore.select('mode', mode)
        if (temperature) await ocStore.select('temperature', temperature)
        ocStore.selectedModel = model
        ocStore.selectedThinking = thinking || ''
        ocStore.selectedMode = mode
        ocStore.selectedTemperature = temperature || ''

        const formIdx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
        if (formIdx >= 0) {
          chat.messages[formIdx] = {
            role: 'opencode_confirmed',
            content: typeof value === 'object' ? JSON.stringify(value) : String(value),
            _key: 'confirmed-' + Date.now(),
          }
        }

        await opencodeStreamPrompt(
          chat.activeSessionId,
          prompt,
          ocSetupData.provider,
          model,
          thinking,
          mode,
          temperature,
        )
    }
  }

  async function handleGenerarCommitSetup(controlId, value, controlMsg) {
    const subStepType = controlMsg.controlData.subStepType

    if (subStepType === 'provider') {
      commitSetupData.provider = value
      await ocStore.select('provider', value)
      ocStore.selectedProvider = value
      const models = ocStore.getModelsForProvider(value)
      chat.pushMessage({
        role: 'opencode_control',
        controlData: {
          controlId: 'gc-form-' + Date.now(),
          controlType: 'generar_commit_form',
          stepType: 'generar_commit_setup',
          subStepType: 'form',
          models,
          modelValue: ocStore.savedModel || '',
          thinkingOptions: ocStore.thinkingOptions,
          thinkingValue: ocStore.savedThinking || '',
          temperatureOptions: ocStore.temperatureOptions,
          temperatureValue: ocStore.savedTemperature || '0.7',
        },
        _key: 'control-' + Date.now(),
      })
    } else if (subStepType === 'form') {
      const { model, thinking = '', mode = 'Plan', temperature = '0.7' } = value || {}
      commitSetupData.model = model
      commitSetupData.thinking = thinking
      commitSetupData.mode = mode
      commitSetupData.temperature = temperature
      await ocStore.select('model', model)
      await ocStore.select('thinking', thinking || '')
      await ocStore.select('mode', mode)
      if (temperature) await ocStore.select('temperature', temperature)
      ocStore.selectedModel = model
      ocStore.selectedThinking = thinking || ''
      ocStore.selectedMode = mode
      ocStore.selectedTemperature = temperature || ''

      let prompt
      try {
        const tmplRes = await fetch('/api/templates/commit-prompt', { credentials: 'include' })
        if (tmplRes.ok) {
          const tmplData = await tmplRes.json()
          prompt = tmplData.content
        } else {
          prompt = 'Analizá los cambios realizados en el proyecto actual (revisando el diff de Git) y generá un mensaje de commit descriptivo. El mensaje debe ser conciso (máximo 300 caracteres) y reflejar claramente las modificaciones aplicadas al código. Debes comenzar en modo planificación mostrando primero la propuesta de commit. IMPORTANTE: Devuelve ÚNICAMENTE el mensaje de commit, sin explicaciones, análisis ni ningún otro texto adicional.'
        }
      } catch (err) {
        console.error('Error al cargar plantilla commit-prompt:', err)
        prompt = 'Analizá los cambios realizados en el proyecto actual (revisando el diff de Git) y generá un mensaje de commit descriptivo. El mensaje debe ser conciso (máximo 300 caracteres) y reflejar claramente las modificaciones aplicadas al código. Debes comenzar en modo planificación mostrando primero la propuesta de commit. IMPORTANTE: Devuelve ÚNICAMENTE el mensaje de commit, sin explicaciones, análisis ni ningún otro texto adicional.'
      }

      commitData.prompt = prompt
      commitData.provider = commitSetupData.provider
      commitData.model = model
      commitData.thinking = thinking
      commitData.mode = mode
      commitData.temperature = temperature

      await opencodeStreamPromptCommit(
        chat.activeSessionId,
        prompt,
        commitSetupData.provider,
        model,
        thinking,
        mode,
        temperature,
      )
    }
  }

  async function handleAmbientesDiffTestingSetup(controlId, value, controlMsg) {
    const subStepType = controlMsg.controlData.subStepType

    if (subStepType === 'provider') {
      testingNotesSetupData.provider = value
      testingNotesData.origen = controlMsg.controlData.origen || ''
      testingNotesData.destino = controlMsg.controlData.destino || ''
      testingNotesData.diffData = controlMsg.controlData.diffData || null
      await ocStore.select('provider', value)
      ocStore.selectedProvider = value
      const models = ocStore.getModelsForProvider(value)
      chat.pushMessage({
        role: 'opencode_control',
        controlData: {
          controlId: 'tn-form-' + Date.now(),
          controlType: 'generar_commit_form',
          stepType: 'ambientes_diff_testing_setup',
          subStepType: 'form',
          models,
          modelValue: ocStore.savedModel || '',
          thinkingOptions: ocStore.thinkingOptions,
          thinkingValue: ocStore.savedThinking || '',
          temperatureOptions: ocStore.temperatureOptions,
          temperatureValue: ocStore.savedTemperature || '0.7',
        },
        _key: 'control-' + Date.now(),
      })
    } else if (subStepType === 'form') {
      const { model, thinking = '', mode = 'Plan', temperature = '0.7' } = value || {}
      testingNotesSetupData.model = model
      testingNotesSetupData.thinking = thinking
      testingNotesSetupData.mode = mode
      testingNotesSetupData.temperature = temperature
      await ocStore.select('model', model)
      await ocStore.select('thinking', thinking || '')
      await ocStore.select('mode', mode)
      if (temperature) await ocStore.select('temperature', temperature)
      ocStore.selectedModel = model
      ocStore.selectedThinking = thinking || ''
      ocStore.selectedMode = mode
      ocStore.selectedTemperature = temperature || ''

      const origen = testingNotesData.origen
      const destino = testingNotesData.destino
      const diffData = testingNotesData.diffData

      let diffSummary = ''
      if (diffData && diffData.commits && diffData.commits.length > 0) {
        diffSummary = diffData.commits.map(c => {
          let s = `- ${c.message}`
          if (c.body) s += '\n' + c.body.split('\n').map(l => '  ' + l).join('\n')
          return s
        }).join('\n')
      }

      let prompt
      try {
        const tmplRes = await fetch('/api/templates/testing-notes-prompt', { credentials: 'include' })
        if (tmplRes.ok) {
          const tmplData = await tmplRes.json()
          prompt = tmplData.content
        } else {
          prompt = `Analizá las diferencias entre las ramas "${diffData?.sourceBranch || origen}" y "${diffData?.targetBranch || destino}" del proyecto.\n\nLos commits que diferen ambas ramas son:\n${diffSummary || '(sin commits detallados)'}\n\nGenerá un listado de puntos a considerar para realizar pruebas (testing):\n- Qué funcionalidades se ven afectadas\n- Qué se recomienda testear específicamente\n- Casos de prueba sugeridos\n\nDevolvé la respuesta en formato markdown listando cada punto.`
        }
      } catch (err) {
        console.error('Error al cargar plantilla testing-notes-prompt:', err)
        prompt = `Analizá las diferencias entre las ramas "${diffData?.sourceBranch || origen}" y "${diffData?.targetBranch || destino}" del proyecto.\n\nLos commits que diferen ambas ramas son:\n${diffSummary || '(sin commits detallados)'}\n\nGenerá un listado de puntos a considerar para realizar pruebas (testing):\n- Qué funcionalidades se ven afectadas\n- Qué se recomienda testear específicamente\n- Casos de prueba sugeridos\n\nDevolvé la respuesta en formato markdown listando cada punto.`
      }

      testingNotesData.prompt = prompt
      testingNotesData.provider = testingNotesSetupData.provider
      testingNotesData.model = model
      testingNotesData.thinking = thinking
      testingNotesData.mode = mode
      testingNotesData.temperature = temperature

      await opencodeStreamPromptTestingNotes(
        chat.activeSessionId,
        prompt,
        testingNotesSetupData.provider,
        model,
        thinking,
        mode,
        temperature,
        origen,
        destino,
      )
    }
  }

  async function regenerateCommit(controlId, controlMsg) {
    const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
    if (idx >= 0) {
      chat.messages[idx].controlData.loading = true
    }
    await opencodeStreamPromptCommit(
      chat.activeSessionId,
      commitData.prompt,
      commitData.provider,
      commitData.model,
      commitData.thinking,
      commitData.mode,
      commitData.temperature,
    )
  }

  async function executeCommit(controlId, controlMsg, message, addComment, modo_envio) {
    const sessionId = chat.activeSessionId
    const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
    if (idx >= 0) {
      chat.messages[idx].controlData.loading = true
    }

    const sessions = chat.sessions
    const ticketInfoValue = ticketInfo.value

    try {
      const session = sessions.find(s => Number(s.id) === Number(sessionId))
      const idTicket = session?.id_ticket_redmine || ticketInfoValue?.redmine_id || null

      let proyectoId = session?.proyecto_id || null
      if (!proyectoId) {
        try {
          const proyRes = await fetch(`/api/tickets/session/${sessionId}`, { credentials: 'include' })
          const proyData = await proyRes.json()
          proyectoId = proyData.proyectoId || null
        } catch (err) {
          console.error('Error al obtener proyecto_id de sesión:', err.message)
        }
      }

      const cleanMsg = message.replace(/^\[#\d+\]\s*/g, '').trim()
      const commitMsg = idTicket ? '[#' + idTicket + '] ' + cleanMsg : cleanMsg
      const escapedMessage = commitMsg.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

      const addRes = await fetch('/api/command/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command: 'add .', sessionId }),
      })
      const addData = await addRes.json()

      if (!addData.success) {
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'Error al ejecutar git add .: ' + (addData.stderr || addData.error || 'Error desconocido'),
            _key: 'err-' + Date.now(),
          }
        }
        return
      }

      const commitRes = await fetch('/api/command/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command: 'commit -m "' + escapedMessage + '"', sessionId }),
      })
      const commitData_ = await commitRes.json()

      if (!commitData_.success) {
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'Error al realizar commit: ' + (commitData_.stderr || commitData_.error || 'Error desconocido'),
            _key: 'err-' + Date.now(),
          }
        }
        return
      }

      let resultLines = ['✓ Commit realizado correctamente.', '', 'Mensaje: ' + commitMsg]

      const pushRes = await fetch('/api/command/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command: 'push', sessionId }),
      })
      const pushData = await pushRes.json()

      if (pushData.success) {
        resultLines.push('', '✓ Push realizado correctamente.')
      } else if (/(no tiene una rama upstream|no upstream|push\.autoSetupRemote)/i.test(pushData.stderr || '')) {
        const branchRes = await fetch('/api/command/git', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ command: 'rev-parse --abbrev-ref HEAD', sessionId }),
        })
        const branchData = await branchRes.json()
        const branch = branchData.success ? branchData.stdout.trim() : 'HEAD'

        const pushUpstreamRes = await fetch('/api/command/git', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ command: `push --set-upstream origin ${branch}`, sessionId }),
        })
        const pushUpstreamData = await pushUpstreamRes.json()
        if (pushUpstreamData.success) {
          resultLines.push('', '✓ Push realizado correctamente (upstream configurado).')
        } else {
          resultLines.push('', '✗ Error al hacer push: ' + (pushUpstreamData.stderr || '').trim())
        }
      } else if (pushData.stderr) {
        resultLines.push('', '⚠ Push: ' + pushData.stderr.trim())
      }

      if (addComment && idTicket) {
        const modoEnvio = modo_envio || 'encolar'
        if (modoEnvio === 'enviar') {
          try {
            let commitUrl = ''
            if (proyectoId) {
              const repoRes = await fetch('/api/proyecto/repositorio/' + encodeURIComponent(proyectoId) + '?sessionId=' + sessionId, { credentials: 'include' })
              const repoData = await repoRes.json()
              if (repoData.url_github) {
                const hashRes = await fetch('/api/command/git', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ command: 'rev-parse HEAD', sessionId }),
                })
                const hashData = await hashRes.json()
                if (hashData.success && hashData.stdout) {
                  const hash = hashData.stdout.trim()
                  commitUrl = repoData.url_github.replace(/\/+$/, '') + '/commit/' + hash
                }
              }
            }

            const notes = cleanMsg + '\n\n' + commitUrl
            const ticketRes = await fetch('/api/tickets/session/' + sessionId, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ notes }),
            })
            const ticketData = await ticketRes.json()
            if (ticketData.success) {
              resultLines.push('', '✓ Comentario agregado al ticket #' + idTicket + '.')
            } else {
              resultLines.push('', '✗ Error al agregar comentario al ticket: ' + (ticketData.error || 'Error desconocido'))
            }
          } catch (err) {
            console.error('Error al agregar comentario al ticket:', err.message)
            resultLines.push('', '✗ Error al agregar comentario al ticket: ' + err.message)
          }
        } else {
          try {
            let commitUrl = ''
            if (proyectoId) {
              const repoRes = await fetch('/api/proyecto/repositorio/' + encodeURIComponent(proyectoId) + '?sessionId=' + sessionId, { credentials: 'include' })
              const repoData = await repoRes.json()
              if (repoData.url_github) {
                const hashRes = await fetch('/api/command/git', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ command: 'rev-parse HEAD', sessionId }),
                })
                const hashData = await hashRes.json()
                if (hashData.success && hashData.stdout) {
                  const hash = hashData.stdout.trim()
                  commitUrl = repoData.url_github.replace(/\/+$/, '') + '/commit/' + hash
                }
              }
            }

            const notesBody = commitUrl ? cleanMsg + '\n\n' + commitUrl : cleanMsg
            const commentData = await redmineComments.queueComment(sessionId, idTicket, notesBody)
            resultLines.push('', '✓ Comentario encolado para el ticket #' + idTicket + '. Usá /dev_redmine_comentarios_enviar para enviarlo.')
          } catch (err) {
            console.error('Error al encolar comentario:', err.message)
            resultLines.push('', '✗ Error al encolar comentario: ' + err.message)
          }
        }
      }

      if (idx >= 0) {
        chat.messages[idx] = {
          role: 'result',
          content: resultLines.join('\n'),
          _key: 'result-' + Date.now(),
        }
      }
    } catch (err) {
      console.error('Error al ejecutar commit:', err.message)
      if (idx >= 0) {
        chat.messages[idx] = {
          role: 'result',
          content: 'Error de conexión: ' + err.message,
          _key: 'err-' + Date.now(),
        }
      }
    } finally {
      try {
        await fetch('/api/opencode/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ocSessionId: ocStore.ocSessionId, sessionId }),
        })
      } catch (finishErr) {
        console.error('Error al finalizar sesión OpenCode tras commit:', finishErr.message)
      }
      ocStore.finish()
    }
  }

  async function executeAmbientesDiffComment(controlId, controlMsg, message, modo_envio) {
    const sessionId = chat.activeSessionId
    const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
    if (idx >= 0) {
      chat.messages[idx].controlData.loading = true
    }

    try {
      const sessions = chat.sessions
      const ticketInfoValue = ticketInfo.value
      const session = sessions.find(s => Number(s.id) === Number(sessionId))
      const idTicket = session?.id_ticket_redmine || ticketInfoValue?.redmine_id || null

      if (!idTicket) {
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'No hay ticket asociado a la sesión. Use /chat_set_ticket para asignar uno.',
            _key: 'err-' + Date.now(),
          }
        }
        return
      }

      const notesBody = message.trim()

      if (modo_envio === 'enviar') {
        try {
          const ticketRes = await fetch('/api/tickets/session/' + sessionId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ notes: notesBody }),
          })
          const ticketData = await ticketRes.json()

          if (idx >= 0) {
            if (ticketData.success) {
              chat.messages[idx] = {
                role: 'result',
                content: '✓ Comentario enviado al ticket #' + idTicket + '.',
                _key: 'result-' + Date.now(),
              }
            } else {
              chat.messages[idx] = {
                role: 'result',
                content: '✗ Error al enviar comentario: ' + (ticketData.error || 'Error desconocido'),
                _key: 'err-' + Date.now(),
              }
            }
          }
        } catch (err) {
          console.error('Error al enviar comentario al ticket:', err.message)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: '✗ Error al enviar comentario: ' + err.message,
              _key: 'err-' + Date.now(),
            }
          }
        }
      } else {
        try {
          await redmineComments.queueComment(sessionId, idTicket, notesBody)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: '✓ Comentario encolado para el ticket #' + idTicket + '. Usá /dev_redmine_comentarios_enviar para enviarlo.',
              _key: 'result-' + Date.now(),
            }
          }
        } catch (err) {
          console.error('Error al encolar comentario:', err.message)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: '✗ Error al encolar comentario: ' + err.message,
              _key: 'err-' + Date.now(),
            }
          }
        }
      }
    } catch (err) {
      console.error('Error al procesar comentario de diff:', err.message)
      if (idx >= 0) {
        chat.messages[idx] = {
          role: 'result',
          content: 'Error de conexión: ' + err.message,
          _key: 'err-' + Date.now(),
        }
      }
    } finally {
      const fromTestingNotes = controlMsg?.controlData?.fromTestingNotes
      if (fromTestingNotes) {
        try {
          await fetch('/api/opencode/finish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ ocSessionId: ocStore.ocSessionId, sessionId }),
          })
        } catch (finishErr) {
          console.error('Error al cerrar sesión OpenCode:', finishErr.message)
        }
        ocStore.finish()
      }
    }
  }

  async function executeTicketComment(controlId, controlMsg, message, modo_envio) {
    const sessionId = chat.activeSessionId
    const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
    if (idx >= 0) {
      chat.messages[idx].controlData.loading = true
    }

    try {
      const sessions = chat.sessions
      const ticketInfoValue = ticketInfo.value
      const session = sessions.find(s => Number(s.id) === Number(sessionId))
      const idTicket = session?.id_ticket_redmine || ticketInfoValue?.redmine_id || null

      if (!idTicket) {
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'No hay ticket asociado a la sesión. Usá /chat_set_ticket para asignar uno.',
            _key: 'err-' + Date.now(),
          }
        }
        return
      }

      const notesBody = message.trim()

      if (modo_envio === 'enviar') {
        try {
          const ticketRes = await fetch('/api/tickets/session/' + sessionId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ notes: notesBody }),
          })
          const ticketData = await ticketRes.json()

          if (idx >= 0) {
            if (ticketData.success) {
              chat.messages[idx] = {
                role: 'result',
                content: '✓ Comentario enviado al ticket #' + idTicket + '.',
                _key: 'result-' + Date.now(),
              }
            } else {
              chat.messages[idx] = {
                role: 'result',
                content: '✗ Error al enviar comentario: ' + (ticketData.error || 'Error desconocido'),
                _key: 'err-' + Date.now(),
              }
            }
          }
        } catch (err) {
          console.error('Error al enviar comentario al ticket:', err.message)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: '✗ Error al enviar comentario: ' + err.message,
              _key: 'err-' + Date.now(),
            }
          }
        }
      } else {
        try {
          await redmineComments.queueComment(sessionId, idTicket, notesBody, 'ticket_comment')
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: '✓ Comentario encolado para el ticket #' + idTicket + '. Usá /dev_redmine_comentarios_enviar para enviarlo.',
              _key: 'result-' + Date.now(),
            }
          }
        } catch (err) {
          console.error('Error al encolar comentario:', err.message)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: '✗ Error al encolar comentario: ' + err.message,
              _key: 'err-' + Date.now(),
            }
          }
        }
      }
    } catch (err) {
      console.error('Error al procesar comentario de ticket:', err.message)
      if (idx >= 0) {
        chat.messages[idx] = {
          role: 'result',
          content: 'Error de conexión: ' + err.message,
          _key: 'err-' + Date.now(),
        }
      }
    }
  }

  async function handleNewSessionWorkspace(controlId, value, controlMsg) {
    const workspaceId = parseInt(value, 10)
    try {
      const res = await fetch(`/api/chat/sessions/${chat.activeSessionId}/workspace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ workspaceId }),
      })
      const data = await res.json()
      if (data.success) {
        if (data.workspaceIds) {
          const workspaceStore = useWorkspaceStore()
          const auth = useAuthStore()
          workspaceStore.selectedIds = data.workspaceIds
          auth.setWorkspaceIds(data.workspaceIds)
        }
        await chat.loadSessions()
        const idx = chat.messages.findIndex(m => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = { role: 'opencode_confirmed', content: `Workspace #${workspaceId} seleccionado`, _key: 'confirmed-' + Date.now() }
        }
        const projRes = await fetch('/api/proyecto', { credentials: 'include' })
        const projData = await projRes.json()
        const projOptions = (projData.proyectos || []).map(p => ({
          label: `${p.id} — ${p.descripcion || ''}`,
          value: p.id,
        }))
        chat.pushMessage({
          role: 'opencode_control',
          controlData: {
            controlId: 'setup-proj-' + Date.now(),
            controlType: 'select',
            stepType: 'new_session_project',
            question: '2. Selecciona un proyecto:',
            options: projOptions,
            placeholder: 'Selecciona proyecto...',
          },
          _key: 'ctrl-setup-proj-' + Date.now(),
        })
      }
    } catch (err) {
      console.error('Error al asignar workspace en setup:', err)
      const idx = chat.messages.findIndex(m => m.controlData && m.controlData.controlId === controlId)
      if (idx >= 0) {
        chat.messages[idx] = { role: 'result', content: 'Error al asignar workspace: ' + err.message, _key: 'err-' + Date.now() }
      }
    }
  }

  async function handleNewSessionProject(controlId, value, controlMsg) {
    try {
      const res = await fetch('/api/proyecto/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId: chat.activeSessionId, proyectoId: value }),
      })
      const data = await res.json()
      if (data.workspaceIds) {
        const workspaceStore = useWorkspaceStore()
        const auth = useAuthStore()
        workspaceStore.selectedIds = data.workspaceIds
        auth.setWorkspaceIds(data.workspaceIds)
      }
      await chat.loadSessions()
      const idx = chat.messages.findIndex(m => m.controlData && m.controlData.controlId === controlId)
      if (idx >= 0) {
        chat.messages[idx] = { role: 'opencode_confirmed', content: `Proyecto "${value}" seleccionado`, _key: 'confirmed-' + Date.now() }
      }
      const tktRes = await fetch(`/api/tickets?proyecto_id=${encodeURIComponent(value)}`, { credentials: 'include' })
      const tktData = await tktRes.json()
      const tktOptions = (tktData.tickets || []).map(t => ({
        label: `#${t.redmine_id} — ${t.subject || ''}`,
        value: String(t.redmine_id),
      }))
      chat.pushMessage({
        role: 'opencode_control',
        controlData: {
          controlId: 'setup-tkt-' + Date.now(),
          controlType: 'select',
          stepType: 'new_session_ticket',
          question: '3. Selecciona un ticket:',
          options: tktOptions,
          placeholder: 'Selecciona ticket...',
        },
        _key: 'ctrl-setup-tkt-' + Date.now(),
      })
    } catch (err) {
      console.error('Error al asignar proyecto en setup:', err)
      const idx = chat.messages.findIndex(m => m.controlData && m.controlData.controlId === controlId)
      if (idx >= 0) {
        chat.messages[idx] = { role: 'result', content: 'Error al asignar proyecto: ' + err.message, _key: 'err-' + Date.now() }
      }
    }
  }

  async function handleNewSessionTicket(controlId, value, controlMsg) {
    const idTicketRedmine = parseInt(value, 10)
    try {
      const res = await fetch('/api/tickets/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId: chat.activeSessionId, idTicketRedmine }),
      })
      const data = await res.json()
      if (data.success) {
        if (data.workspaceIds) {
          const workspaceStore = useWorkspaceStore()
          const auth = useAuthStore()
          workspaceStore.selectedIds = data.workspaceIds
          auth.setWorkspaceIds(data.workspaceIds)
        }
        await chat.loadSessions()
        if (typeof loadTicketInfo === 'function') {
          await loadTicketInfo()
        }
        const idx = chat.messages.findIndex(m => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = { role: 'opencode_confirmed', content: `Ticket #${idTicketRedmine} seleccionado`, _key: 'confirmed-' + Date.now() }
        }
      }
    } catch (err) {
      console.error('Error al asignar ticket en setup:', err)
      const idx = chat.messages.findIndex(m => m.controlData && m.controlData.controlId === controlId)
      if (idx >= 0) {
        chat.messages[idx] = { role: 'result', content: 'Error al asignar ticket: ' + err.message, _key: 'err-' + Date.now() }
      }
    }
  }

  return { onControlConfirm, ticketInfo, loadTicketInfo }
}
