<template>
  <div v-if="!activeSession" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
    <span>Seleccione una sesión de chat</span>
  </div>
  <div v-else-if="!proyectoId" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
    <span>Sin proyecto asignado a esta sesión</span>
  </div>
  <div v-else class="comandos-list flex-grow-1 overflow-y-auto px-2 py-1">
    <div class="d-flex gap-2 mb-2">
      <button class="btn btn-sm btn-outline-argentina flex-grow-1" style="font-size: 0.7rem;" @click.stop="crearComando">+ Crear comando</button>
      <button class="btn btn-sm btn-outline-secondary flex-shrink-0" style="font-size: 0.7rem;" title="Recargar listados" @click.stop="recargar">↻</button>
    </div>

    <template v-if="comandos.length > 0 || loadingComandos">
      <div v-if="loadingComandos" class="d-flex flex-column align-items-center justify-content-center text-secondary small py-2">
        <span>Cargando comandos personalizados…</span>
      </div>
      <TableEditor v-else id="comandos" :data="commandsData" :config="commandsConfig" />
    </template>

    <template v-if="scriptsRows.length > 0 || loadingPackageScripts">
      <div class="section-divider d-flex align-items-center gap-2 my-2 px-1">
        <span class="text-muted flex-shrink-0" style="font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.5px;">Scripts package.json</span>
        <div class="flex-grow-1" style="height: 1px; background: #374151;"></div>
      </div>
      <div v-if="loadingPackageScripts" class="d-flex align-items-center justify-content-center text-secondary small py-2">
        <span>Cargando scripts…</span>
      </div>
      <TableEditor v-else id="scripts" :data="scriptsData" :config="scriptsConfig" />
    </template>

    <div v-if="comandos.length === 0 && scriptsRows.length === 0 && !loadingComandos && !loadingPackageScripts" class="d-flex flex-column align-items-center justify-content-center text-secondary small px-3 text-center py-3">
      <span>No hay comandos disponibles para este proyecto</span>
    </div>
  </div>
</template>

<script>
import { watch, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../../../stores/chat.js'
import { useComandosPersonalizadosStore } from '../../../stores/comandosPersonalizados.js'
import { useModalStore } from '../../../stores/modal.js'
import TableEditor from '../../../components/TableEditor.vue'
import AlertModal from '../../../components/modals/AlertModal.vue'
import { BtnConfig } from '@/components/BtnConfig'
import wsClient from '../../../services/wsClient'

const SCRIPTS_NS = 'scripts_cache'

export default {
  components: { TableEditor },
  setup() {
    const chat = useChatStore()
    const comandosStore = useComandosPersonalizadosStore()
    const modal = useModalStore()
    const { activeSessionId, sessions } = storeToRefs(chat)

    const activeSession = computed(() => {
      return sessions.value.find(s => Number(s.id) === Number(activeSessionId.value)) || null
    })

    const proyectoId = computed(() => activeSession.value?.proyecto_id || null)

    const comandos = computed(() => {
      const pid = proyectoId.value
      if (!pid) return []
      return comandosStore.commandsByProject[pid] || []
    })
    const loadingComandos = computed(() => {
      const pid = proyectoId.value
      if (!pid) return false
      return !!comandosStore.loadingByProject[pid]
    })

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

    async function loadPackageScripts(force = false) {
      const sid = activeSessionId.value
      if (!sid) {
        packageScripts.value = []
        return
      }
      const key = String(sid)
      loadingPackageScripts.value = true
      try {
        if (!force) {
          try {
            const mem = await wsClient.send('memoria:get', { namespace: SCRIPTS_NS, key })
            if (mem.value) {
              packageScripts.value = mem.value
              return
            }
          } catch (err) {
            console.log('[comandos] Caché de scripts no disponible, consultando backend:', err.message)
          }
        }
        const res = await fetch(`/api/command/package-json-scripts?sessionId=${sid}`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          const packages = data.packages || []
          packageScripts.value = packages
          try {
            await wsClient.send('memoria:set', { namespace: SCRIPTS_NS, key, value: packages })
          } catch (err) {
            console.log('[comandos] Error al guardar caché de scripts:', err.message)
          }
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

    function recargar() {
      const pid = proyectoId.value
      const sid = activeSessionId.value
      if (pid) comandosStore.loadCommands(pid, { force: true })
      if (sid) loadPackageScripts(true)
    }

    function checkTerminalSlot(sid) {
      const check = chat.canCreateTerminal(sid)
      if (!check.ok) {
        console.log(`[comandos] Límite de terminales alcanzado (${check.used}/${check.total})`)
        modal.open(AlertModal, { message: `Límite de terminales alcanzado: ${check.used}/${check.total} terminales activas. Cierre una terminal antes de ejecutar un comando.` }, { title: 'Aviso' })
        return false
      }
      return true
    }

    async function ejecutarComando(c) {
      const sid = activeSessionId.value
      if (!sid || executingCommands.value.has(c.id)) return
      if (!checkTerminalSlot(sid)) return
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
      if (!checkTerminalSlot(sid)) return
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

    const commandsData = computed(() => {
      const rows = (comandos.value || []).map(c => ({
        ...c,
        name: c.label,
        description: c.descripcion || '',
      }))
      return {
        fields_def: [
          { field: 'name', headerName: 'Comando', sortable: true },
          { field: 'description', headerName: 'Descripción', sortable: true },
        ],
        rows,
      }
    })

    const commandsConfig = computed(() => ({
      hideToolbarEnd: true,
      hideRefresh: true,
      hideCsvExport: true,
      showPaginator: false,
      selectionMode: 'single',
      buttons: {
        rowActions: [
          new BtnConfig({ key: 'ejecutar', icon: 'bi bi-play-fill', severity: 'btn-outline-success', label: '▶ Ejecutar', onClick: (row) => ejecutarComando(row) }),
          new BtnConfig({ key: 'detener', icon: 'bi bi-stop-fill', severity: 'btn-outline-warning', label: '⏹ Detener', onClick: (row) => detenerComando(row) }),
          new BtnConfig({ key: 'edit', icon: 'bi bi-pencil', severity: 'btn-outline-info', label: '✏', onClick: (row) => editarComando(row) }),
          new BtnConfig({ key: 'copy', icon: 'bi bi-files', severity: 'btn-outline-secondary', label: '📋', onClick: (row) => copiarComando(row) }),
          new BtnConfig({ key: 'delete', icon: 'bi bi-trash', severity: 'btn-outline-danger', label: '🗑', onClick: (row) => eliminarComando(row) }),
        ],
      },
    }))

    const scriptsRows = computed(() => {
      const result = []
      for (const pkg of packageScripts.value) {
        for (const script of pkg.scripts) {
          result.push({
            name: script.name,
            command: script.command,
            _packagePath: pkg.relativePath,
            _scriptName: script.name,
            _scriptKey: pkg.relativePath + '/' + script.name,
          })
        }
      }
      return result
    })

    const scriptsData = computed(() => ({
      fields_def: [
        { field: 'name', headerName: 'Script', sortable: true },
        { field: 'command', headerName: 'Comando', sortable: true },
      ],
      rows: scriptsRows.value,
    }))

    const scriptsConfig = computed(() => ({
      hideToolbarEnd: true,
      hideRefresh: true,
      hideCsvExport: true,
      showPaginator: false,
      selectionMode: 'single',
      buttons: {
        rowActions: [
          new BtnConfig({ key: 'ejecutar', icon: 'bi bi-play-fill', severity: 'btn-outline-success', label: '▶ Ejecutar', onClick: (row) => ejecutarNpmScript(row._packagePath, row._scriptName, row.command) }),
          new BtnConfig({ key: 'detener', icon: 'bi bi-stop-fill', severity: 'btn-outline-warning', label: '⏹ Detener', onClick: (row) => detenerNpmScript(row._packagePath, row._scriptName) }),
        ],
      },
    }))

    watch([proyectoId, activeSessionId], () => {
      const pid = proyectoId.value
      const sid = activeSessionId.value
      if (!pid) {
        comandosStore.clearCommands()
        if (!sid) packageScripts.value = []
        return
      }
      comandosStore.loadCommands(pid)
      if (sid) loadPackageScripts()
    }, { immediate: true })

    return {
      activeSession,
      proyectoId,
      comandos,
      loadingComandos,
      loadingPackageScripts,
      scriptsRows,
      commandsData,
      commandsConfig,
      scriptsData,
      scriptsConfig,
      crearComando,
      recargar,
    }
  },
}
</script>

<style scoped>
.comandos-list {
  background: #16213e;
}

.comandos-list :deep(.te-wrapper) {
  height: auto;
  grid-template-rows: auto auto auto;
}
</style>
