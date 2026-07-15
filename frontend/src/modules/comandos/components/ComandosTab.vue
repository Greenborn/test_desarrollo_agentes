<template>
  <div v-if="!activeSession" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
    <span>Seleccione una sesión de chat</span>
  </div>
  <div v-else-if="!proyectoId" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
    <span>Sin proyecto asignado a esta sesión</span>
  </div>
  <div v-else-if="loadingComandos" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small">
    <span>Cargando comandos…</span>
  </div>
  <div v-else class="comandos-list flex-grow-1 overflow-y-auto px-2 py-1">
    <button class="btn btn-sm btn-outline-argentina w-100 mb-2" style="font-size: 0.7rem;" @click.stop="crearComando">+ Crear comando</button>
    <template v-if="comandos.length > 0">
      <div v-for="c in comandos" :key="c.id" class="comando-item d-flex flex-column px-2 py-2 mb-1 rounded">
        <div class="d-flex align-items-center gap-1 mb-1">
          <span class="comando-label small fw-semibold text-truncate">{{ c.label }}</span>
        </div>
        <div v-if="c.descripcion" class="comando-desc text-muted small text-truncate mb-2">{{ c.descripcion }}</div>
        <div class="d-flex gap-1 justify-content-end">
          <button v-if="!executingCommands.has(c.id)" class="btn btn-sm btn-outline-success py-0 px-2" style="font-size: 0.65rem;" @click.stop="ejecutarComando(c)">▶ Ejecutar</button>
          <button v-else class="btn btn-sm btn-outline-warning py-0 px-2" style="font-size: 0.65rem;" @click.stop="detenerComando(c)">⏹ Detener</button>
          <button class="btn btn-sm btn-outline-info py-0 px-2" style="font-size: 0.65rem;" @click.stop="editarComando(c)">✏</button>
          <button class="btn btn-sm btn-outline-secondary py-0 px-2" style="font-size: 0.65rem;" @click.stop="copiarComando(c)">📋</button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2" style="font-size: 0.65rem;" @click.stop="eliminarComando(c)">🗑</button>
        </div>
      </div>
    </template>

    <template v-if="packageScripts.length > 0">
      <div class="section-divider d-flex align-items-center gap-2 my-2 px-1">
        <span class="text-muted flex-shrink-0" style="font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.5px;">Scripts package.json</span>
        <div class="flex-grow-1" style="height: 1px; background: #374151;"></div>
      </div>
      <div v-if="loadingPackageScripts" class="d-flex align-items-center justify-content-center text-secondary small py-2">
        <span>Cargando scripts…</span>
      </div>
      <div v-else>
        <div v-for="pkg in packageScripts" :key="pkg.relativePath" class="package-group mb-2">
          <div class="package-path small text-muted px-1 mb-1" style="font-size: 0.6rem;">📦 {{ pkg.relativePath }}</div>
          <div v-for="script in pkg.scripts" :key="script.name" class="script-item d-flex align-items-center px-2 py-1 mb-1 rounded">
            <div class="flex-grow-1 min-width-0">
              <div class="script-name small fw-semibold text-truncate">{{ script.name }}</div>
              <div class="script-command text-muted" style="font-size: 0.55rem; font-family: monospace;">$ {{ script.command }}</div>
            </div>
            <button v-if="!executingScripts.has(pkg.relativePath + '/' + script.name)"
                    class="btn btn-sm btn-outline-success py-0 px-2 flex-shrink-0" style="font-size: 0.65rem;"
                    @click.stop="ejecutarNpmScript(pkg.relativePath, script.name, script.command)">▶ Ejecutar</button>
            <button v-else
                    class="btn btn-sm btn-outline-warning py-0 px-2 flex-shrink-0" style="font-size: 0.65rem;"
                    @click.stop="detenerNpmScript(pkg.relativePath, script.name)">⏹</button>
          </div>
        </div>
      </div>
    </template>

    <div v-if="comandos.length === 0 && packageScripts.length === 0" class="d-flex flex-column align-items-center justify-content-center text-secondary small px-3 text-center py-3">
      <span>No hay comandos disponibles para este proyecto</span>
    </div>
  </div>
</template>

<script>
import { watch, ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../../../stores/chat.js'
import { useComandosPersonalizadosStore } from '../../../stores/comandosPersonalizados.js'

export default {
  setup() {
    const chat = useChatStore()
    const comandosStore = useComandosPersonalizadosStore()
    const { activeSessionId, sessions } = storeToRefs(chat)

    const activeSession = computed(() => {
      return sessions.value.find(s => s.id === activeSessionId.value) || null
    })

    const proyectoId = computed(() => activeSession.value?.proyecto_id || null)

    const comandos = computed(() => comandosStore.getCommandsForProject(proyectoId.value))
    const loadingComandos = computed(() => comandosStore.loadingByProject[proyectoId.value] || false)

    const executingCommands = ref(new Map())
    const packageScripts = ref([])
    const loadingPackageScripts = ref(false)
    const executingScripts = ref(new Map())

    function _updateStreamMsg(streamKey, content) {
      const idx = chat.messages.findIndex(m => m._key === streamKey)
      if (idx >= 0) {
        chat.messages[idx].content = content
      }
    }

    async function loadPackageScripts() {
      const sid = activeSessionId.value
      if (!sid) {
        packageScripts.value = []
        return
      }
      loadingPackageScripts.value = true
      try {
        const res = await fetch(`/api/command/package-json-scripts?sessionId=${sid}`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          packageScripts.value = data.packages || []
        } else {
          packageScripts.value = []
        }
      } catch (err) {
        console.error('Error al cargar scripts package.json:', err)
        packageScripts.value = []
      } finally {
        loadingPackageScripts.value = false
      }
    }

    async function ejecutarComando(c) {
      const sid = activeSessionId.value
      if (!sid || executingCommands.value.has(c.id)) return
      const esOculto = c.ocultar_ejecucion ? true : false
      const abortController = new AbortController()
      executingCommands.value.set(c.id, { abortController, terminalId: null })
      const streamKey = 'stream-sb-' + Date.now()
      const isActive = () => Number(chat.activeSessionId) === Number(sid)
      chat.setCmdStreaming(sid, true)
      chat.updateCmdStreamCache(sid, '', streamKey)
      if (isActive()) {
        chat.messages.push({ role: 'result', content: '⏳ Resolviendo...', _key: streamKey })
        chat.flashLed(sid)
      }
      chat.setSessionStatus(sid, 'executing')
      const done = () => {
        executingCommands.value.delete(c.id)
        chat.setSessionStatus(sid, 'idle')
      }
      try {
        if (isActive()) _updateStreamMsg(streamKey, '⏳ Resolviendo comando...')
        chat.updateCmdStreamCache(sid, '⏳ Resolviendo comando...')
        const resolveRes = await fetch(`/api/comandos-personalizados/${c.id}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ sessionId: sid }),
          signal: abortController.signal,
        })
        if (!resolveRes.ok) {
          const errData = await resolveRes.json()
          throw new Error(errData.error || 'Error al resolver comando')
        }
        const resolved = await resolveRes.json()
        if (isActive()) _updateStreamMsg(streamKey, '⏳ Creando terminal...')
        chat.updateCmdStreamCache(sid, '⏳ Creando terminal...')
        const procRes = await fetch('/api/procesos/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            chatSessionId: sid,
            cwd: resolved.cwd || undefined,
            cmd: resolved.comando,
          }),
          signal: abortController.signal,
        })
        if (!procRes.ok) {
          const errData = await procRes.json()
          throw new Error(errData.error || 'Error al crear terminal')
        }
        const { terminalId } = await procRes.json()
        const entry = executingCommands.value.get(c.id)
        if (entry) entry.terminalId = terminalId
        chat.openTerminal({
          sessionId: sid,
          terminalId,
          cwd: resolved.cwd || undefined,
          initCommand: resolved.comando,
          label: c.label || 'comando',
        })
        chat.registerCmdPendingSave(sid, {
          commandLabel: c.label,
          ocultarEjecucion: esOculto,
          streamKey,
        })
        if (isActive()) _updateStreamMsg(streamKey, '⏳ Ejecutando en terminal...')
        chat.updateCmdStreamCache(sid, '⏳ Ejecutando en terminal...')
      } catch (err) {
        if (err.name === 'AbortError') {
          if (isActive()) _updateStreamMsg(streamKey, '(ejecución detenida)')
        } else {
          console.error('Error ejecutando comando:', err)
          chat.setSessionStatus(sid, 'error')
          if (isActive()) _updateStreamMsg(streamKey, 'Error: ' + err.message)
        }
        chat.setCmdStreaming(sid, false)
        chat.clearCmdStreamCache(sid)
      } finally {
        done()
      }
    }

    function detenerComando(c) {
      const entry = executingCommands.value.get(c.id)
      if (entry) {
        entry.abortController.abort()
        if (entry.terminalId) {
          fetch(`/api/procesos/terminal/${entry.terminalId}`, {
            method: 'DELETE', credentials: 'include',
          }).catch(() => {})
        }
      }
    }

    async function ejecutarNpmScript(pkgDir, scriptName, scriptCommand) {
      const sid = activeSessionId.value
      if (!sid || executingScripts.value.has(pkgDir + '/' + scriptName)) return
      const abortController = new AbortController()
      executingScripts.value.set(pkgDir + '/' + scriptName, { abortController, terminalId: null })
      const streamKey = 'stream-npm-' + Date.now()
      const isActive = () => Number(chat.activeSessionId) === Number(sid)
      chat.setCmdStreaming(sid, true)
      chat.updateCmdStreamCache(sid, '', streamKey)
      if (isActive()) {
        chat.messages.push({ role: 'result', content: '⏳ Ejecutando npm run ' + scriptName + '...', _key: streamKey })
        chat.flashLed(sid)
      }
      chat.setSessionStatus(sid, 'executing')
      const done = () => {
        executingScripts.value.delete(pkgDir + '/' + scriptName)
        chat.setSessionStatus(sid, 'idle')
      }
      try {
        if (isActive()) _updateStreamMsg(streamKey, '⏳ Creando terminal...')
        chat.updateCmdStreamCache(sid, '⏳ Creando terminal...')
        const procRes = await fetch('/api/procesos/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            chatSessionId: sid,
            cwd: pkgDir || undefined,
            cmd: scriptCommand || ('npm run ' + scriptName),
          }),
          signal: abortController.signal,
        })
        if (!procRes.ok) {
          const errData = await procRes.json()
          throw new Error(errData.error || 'Error al crear terminal para npm script')
        }
        const { terminalId } = await procRes.json()
        const entry = executingScripts.value.get(pkgDir + '/' + scriptName)
        if (entry) entry.terminalId = terminalId
        chat.openTerminal({
          sessionId: sid,
          terminalId,
          cwd: pkgDir || undefined,
          initCommand: scriptCommand || ('npm run ' + scriptName),
          label: 'npm run ' + scriptName,
        })
        chat.registerCmdPendingSave(sid, {
          commandLabel: 'npm run ' + scriptName,
          ocultarEjecucion: false,
          streamKey,
        })
        if (isActive()) _updateStreamMsg(streamKey, '⏳ Ejecutando en terminal...')
        chat.updateCmdStreamCache(sid, '⏳ Ejecutando en terminal...')
      } catch (err) {
        if (err.name === 'AbortError') {
          if (isActive()) _updateStreamMsg(streamKey, '(ejecución detenida)')
        } else {
          console.error('Error ejecutando npm script:', err)
          chat.setSessionStatus(sid, 'error')
          if (isActive()) _updateStreamMsg(streamKey, 'Error: ' + err.message)
        }
        chat.setCmdStreaming(sid, false)
        chat.clearCmdStreamCache(sid)
      } finally {
        done()
      }
    }

    function detenerNpmScript(pkgDir, scriptName) {
      const key = pkgDir + '/' + scriptName
      const entry = executingScripts.value.get(key)
      if (entry) {
        entry.abortController.abort()
        if (entry.terminalId) {
          fetch(`/api/procesos/terminal/${entry.terminalId}`, {
            method: 'DELETE', credentials: 'include',
          }).catch(() => {})
        }
      }
    }

    function crearComando() {
      const sid = activeSessionId.value
      if (!sid || !proyectoId.value) return
      chat.pushMessage({
        role: 'opencode_control',
        content: JSON.stringify({
          controlId: 'comando-edit-create-' + Date.now(),
          controlType: 'comando_edit',
          mode: 'create',
          proyectoId: proyectoId.value,
        }),
        controlData: {
          controlId: 'comando-edit-create-' + Date.now(),
          controlType: 'comando_edit',
          mode: 'create',
          proyectoId: proyectoId.value,
        },
        _key: 'ctrl-comando-' + Date.now(),
      })
    }

    async function editarComando(c) {
      const sid = activeSessionId.value
      if (!sid) return
      chat.pushMessage({
        role: 'opencode_control',
        content: JSON.stringify({
          controlId: 'comando-edit-update-' + Date.now(),
          controlType: 'comando_edit',
          mode: 'update',
          id: c.id,
          proyectoId: c.id_proyecto,
          label: c.label,
          descripcion: c.descripcion || '',
          comando: c.comando,
          ocultar_ejecucion: c.ocultar_ejecucion ? true : false,
        }),
        controlData: {
          controlId: 'comando-edit-update-' + Date.now(),
          controlType: 'comando_edit',
          mode: 'update',
          id: c.id,
          proyectoId: c.id_proyecto,
          label: c.label,
          descripcion: c.descripcion || '',
          comando: c.comando,
          ocultar_ejecucion: c.ocultar_ejecucion ? true : false,
        },
        _key: 'ctrl-comando-' + Date.now(),
      })
    }

    async function copiarComando(c) {
      try {
        const nuevoLabel = 'copia_' + c.label
        await comandosStore.createCommand({
          label: nuevoLabel,
          descripcion: c.descripcion || '',
          id_proyecto: c.id_proyecto,
          comando: c.comando,
          ocultar_ejecucion: c.ocultar_ejecucion ? true : false,
        })
        if (Number(chat.activeSessionId) === Number(activeSessionId.value) && activeSessionId.value) {
          chat.pushMessage({ role: 'result', content: `✓ Comando "${c.label}" copiado como "${nuevoLabel}".`, _key: 'cpy-' + Date.now() })
        }
      } catch (err) {
        console.error('Error al copiar comando:', err)
      }
    }

    async function eliminarComando(c) {
      if (!confirm(`¿Eliminar el comando "${c.label}"?`)) return
      try {
        await comandosStore.deleteCommand(c.id, proyectoId.value)
        if (Number(chat.activeSessionId) === Number(activeSessionId.value) && activeSessionId.value) {
          chat.pushMessage({ role: 'result', content: `✓ Comando "${c.label}" eliminado.`, _key: 'del-' + Date.now() })
        }
      } catch (err) {
        console.error('Error al eliminar comando:', err)
      }
    }

    watch(proyectoId, (newId) => {
      if (!newId) {
        comandosStore.clearCommands()
        packageScripts.value = []
        return
      }
      comandosStore.loadCommands(newId)
    })

    watch(activeSessionId, () => {
      if (activeSessionId.value) {
        loadPackageScripts()
      } else {
        packageScripts.value = []
      }
    })

    onMounted(() => {
      if (activeSessionId.value) {
        loadPackageScripts()
      }
    })

    return {
      activeSession,
      proyectoId,
      comandos,
      loadingComandos,
      executingCommands,
      packageScripts,
      loadingPackageScripts,
      executingScripts,
      ejecutarComando,
      detenerComando,
      crearComando,
      editarComando,
      copiarComando,
      eliminarComando,
      ejecutarNpmScript,
      detenerNpmScript,
    }
  },
}
</script>

<style scoped>
.comandos-list {
  background: #16213e;
}
.comando-item {
  background: #1a2744;
  border: 1px solid #374151;
  position: relative;
}
.comando-item:hover {
  background: #1e3050;
}
.comando-label {
  color: #75AADB;
}
.comando-desc {
  font-size: 0.65rem;
  line-height: 1.2;
}
.package-group {
  background: transparent;
}
.package-path {
  color: #6b7280;
}
.script-item {
  background: #1a2744;
  border: 1px solid #374151;
  cursor: default;
}
.script-item:hover {
  background: #1e3050;
}
.script-name {
  color: #e8b800;
  font-size: 0.7rem;
}
.script-command {
  color: #6b7280;
  font-family: monospace;
}
</style>
