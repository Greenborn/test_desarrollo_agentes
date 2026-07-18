<template>
  <div class="mb-3" :class="msg.role === 'user' || msg.role === 'command' ? 'text-end' : 'text-start'" @contextmenu.prevent="$emit('contextmenu', $event, msg)">
    <div v-if="msg.role === 'command'" class="d-inline-block rounded-3 p-2 text-start font-monospace" style="max-width: 90%; background: #1a2744; border: 1px solid #E8B800; color: #E8B800;">
      {{ msg.content }}
    </div>
    <div v-else-if="msg.role === 'result'" class="d-inline-block rounded-3 p-2 text-start font-monospace small" style="max-width: 90%; background: #16213e; border: 1px solid #75AADB; color: #e0e0e0;">
      <ChatFormatter v-if="!isRaw" :text="msg.content" />
      <pre v-else class="mb-0" style="white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word;">{{ msg.content }}</pre>
    </div>
    <div v-else-if="msg.role === 'opencode_control'" class="d-block w-100 rounded-3 p-3 text-start" style="background: #1a2744; border: 1px solid #75AADB; color: #e0e0e0;">
      <ChatGenerarCommitForm v-if="parsedControl && parsedControl.controlType === 'generar_commit_form'" :models="parsedControl.models || []" :modelValue="parsedControl.modelValue || ''" :thinkingOptions="parsedControl.thinkingOptions || []" :thinkingValue="parsedControl.thinkingValue || ''" :temperatureOptions="parsedControl.temperatureOptions || []" :temperatureValue="parsedControl.temperatureValue || ''" :modeValue="parsedControl.modeValue || 'Plan'" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <ChatOpencodeForm v-else-if="parsedControl && parsedControl.controlType === 'opencode_form'" :models="parsedControl.models || []" :modelValue="parsedControl.modelValue || ''" :thinkingOptions="parsedControl.thinkingOptions || []" :thinkingValue="parsedControl.thinkingValue || ''" :temperatureOptions="parsedControl.temperatureOptions || []" :temperatureValue="parsedControl.temperatureValue || ''" :modeValue="parsedControl.modeValue || 'Build'" :placeholder="parsedControl.placeholder || ''" :rows="parsedControl.rows || 3" :prefill="parsedControl.prefill || ''" :sessionId="String(parsedControl.sessionId ?? '')" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <ChatControlFollowup v-else-if="parsedControl && parsedControl.controlType === 'followup'" :models="parsedControl.models || []" :modelValue="parsedControl.modelValue || ''" :thinkingOptions="parsedControl.thinkingOptions || []" :thinkingValue="parsedControl.thinkingValue || ''" :placeholder="parsedControl.placeholder || ''" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <template v-else-if="parsedControl && parsedControl.controlType === 'select'">
        <ChatControlButtons v-if="parsedControl.options && parsedControl.options.length <= 4" :options="parsedControl.options" :question="parsedControl.question || ''" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
        <ControlSelect v-else :options="parsedControl.options || []" :preselect="parsedControl.preselect || ''" :placeholder="parsedControl.placeholder || 'Selecciona...'" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      </template>
      <ChatControlButtons v-else-if="parsedControl && parsedControl.controlType === 'buttons'" :options="parsedControl.options || []" :question="parsedControl.question || ''" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <ControlTextarea v-else-if="parsedControl && parsedControl.controlType === 'textarea'" :placeholder="parsedControl.placeholder || 'Escribe...'" :rows="parsedControl.rows || 3" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <FuncionalidadListControl v-else-if="parsedControl && parsedControl.controlType === 'funcionalidad_list'" :items="parsedControl.items || []" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <ResolutionSelectControl v-else-if="parsedControl && parsedControl.controlType === 'resolution_select'" :options="parsedControl.options || []" :preselect="parsedControl.preselect || ''" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <RedmineProjectList v-else-if="parsedControl && parsedControl.controlType === 'redmine_projects'" :projects="parsedControl.projects || []" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <TicketEditControl v-else-if="parsedControl && parsedControl.controlType === 'ticket_edit'" :ticket="parsedControl.ticket" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <TicketCreateControl v-else-if="parsedControl && parsedControl.controlType === 'ticket_create'" :project-id="parsedControl.projectId" :session-id="String(parsedControl.sessionId ?? '')" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <DescripcionEditControl v-else-if="parsedControl && parsedControl.controlType === 'descripcion_edit'" :initial-description="parsedControl.description || ''" :ticket-subject="parsedControl.ticketSubject || ''" :ticket-id="parsedControl.ticketId || ''" :session-id="String(parsedControl.sessionId ?? '')" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <DescripcionInputControl v-else-if="parsedControl && parsedControl.controlType === 'descripcion_input'" :placeholder="parsedControl.placeholder || ''" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <DescripcionResultControl v-else-if="parsedControl && parsedControl.controlType === 'descripcion_result'" :description="parsedControl.description || ''" :loading="parsedControl.loading || false" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <DescripcionResultControl v-else-if="parsedControl && parsedControl.controlType === 'refinar_result'" :description="parsedControl.description || ''" :loading="parsedControl.loading || false" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <CommitResultControl v-else-if="parsedControl && parsedControl.controlType === 'commit_result'" :message="parsedControl.message || ''" :loading="parsedControl.loading || false" :modoEnvioInicial="parsedControl.modo_envio || 'encolar'" :repoUrl="parsedControl.repoUrl || ''" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <ChatComandoEditControl v-else-if="parsedControl && parsedControl.controlType === 'comando_edit'" :mode="parsedControl.mode || 'create'" :label="parsedControl.label || ''" :descripcion="parsedControl.descripcion || ''" :comando="parsedControl.comando || ''" :ocultarEjecucion="parsedControl.ocultar_ejecucion === true" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <RedmineCommentsSendControl v-else-if="parsedControl && parsedControl.controlType === 'redmine_comments_send'" :comentarios_ids="parsedControl.comentarios_ids || []" :ticket_redmine_id="parsedControl.ticket_redmine_id || 0" :mensaje="parsedControl.mensaje || ''" :cantidad="parsedControl.cantidad || 0" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <AmbientesDiffCommentControl v-else-if="parsedControl && parsedControl.controlType === 'ambientes_diff_comment'" :message="parsedControl.message || ''" :sourceEnv="parsedControl.sourceEnv || ''" :targetEnv="parsedControl.targetEnv || ''" :modoEnvioInicial="parsedControl.modo_envio || 'encolar'" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <TicketCommentControl v-else-if="parsedControl && parsedControl.controlType === 'ticket_comment'" :ticketId="parsedControl.ticketId" :sessionId="String(parsedControl.sessionId ?? '')" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <DeployConfigForm v-else-if="parsedControl && parsedControl.controlType === 'deploy_config_form'" :initialSubprojects="parsedControl.initialSubprojects || []" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <NavegadorIniciarForm v-else-if="parsedControl && parsedControl.controlType === 'navegador_iniciar'" :session-id="String(parsedControl.sessionId ?? '')" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <CrearProyectoRedmineControl v-else-if="parsedControl && parsedControl.controlType === 'redmine_crear_proyecto'" :prefill="parsedControl.prefill || {}" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <ChatCdSelector v-else-if="parsedControl && parsedControl.controlType === 'cd_selector'" :current-dir="parsedControl.currentDir || '/' " @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <PeticionFormControl v-else-if="parsedControl && parsedControl.controlType === 'peticion'" :sending="parsedControl.sending || false" :progressText="parsedControl.progressText || ''" :initialData="parsedControl.initialData || null" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <PeticionResultDisplay v-else-if="parsedControl && parsedControl.controlType === 'peticion_result'" :payload="parsedControl.payload || {}" />
      <div v-else class="d-flex flex-column gap-2">
        <pre class="mb-0 small" style="white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word;">{{ msg.content }}</pre>
      </div>
    </div>
    <div v-else-if="msg.role === 'opencode_confirmed'" class="d-inline-block rounded-3 p-2 text-start font-monospace small" style="max-width: 90%; background: #1a2744; border: 1px solid #75AADB; color: #75AADB;">
      {{ msg.content }}
    </div>
    <div v-else-if="msg.role === 'opencode_stream'" class="d-block w-100 rounded-3 p-3 text-start" style="background: #1a2744; border: 1px solid #75AADB; color: #f0f0f0;">
      <div v-if="msg.thinking" class="mb-2">
        <button class="btn btn-sm w-100 text-start btn-outline-argentina" data-bs-toggle="collapse" :data-bs-target="'#think-' + uid">
          🧠 Razonando...
        </button>
        <div class="collapse show mt-1" :id="'think-' + uid">
          <pre class="mb-0 small text-muted" style="white-space: pre-wrap;">{{ msg.thinking }}</pre>
        </div>
      </div>
      <ChatFormatter v-if="!isRaw" :text="msg.content" /><pre v-else class="mb-0" style="white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word;">{{ msg.content }}</pre><span v-if="msg.streaming" class="blink">▌</span>
    </div>
    <div v-else-if="msg.role === 'opencode_result'" class="d-block w-100 rounded-3 p-3 text-start" style="background: #1a2744; border: 1px solid #75AADB; color: #f0f0f0;">
      <div v-if="msg.thinking" class="mb-2">
        <button class="btn btn-sm w-100 text-start btn-outline-argentina" data-bs-toggle="collapse" :data-bs-target="'#think-' + uid">
          🧠 Razonamiento interno
        </button>
        <div class="collapse mt-1" :id="'think-' + uid">
          <pre class="mb-0 small text-muted" style="white-space: pre-wrap;">{{ msg.thinking }}</pre>
        </div>
      </div>
      <ChatFormatter v-if="!isRaw" :text="msg.content" /><pre v-else class="mb-0" style="white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word;">{{ msg.content }}</pre>
      <div v-if="parsedInfo && parsedInfo.hash" class="mt-2 small" style="color: #75AADB;">Hash: {{ parsedInfo.hash }}</div>
    </div>
    <div v-else-if="msg.role === 'opencode_info'" class="d-block w-100 rounded-3 p-2 text-start small" style="background: #1a2744; border: 1px solid #374151; color: #9ca3af;">
      <template v-if="parsedInfoContent">
        <div class="mb-1 fw-semibold" style="color: #f0f0f0; font-size: 0.75rem;">{{ parsedInfoContent.summary }}</div>

        <template v-if="parsedInfoContent.type === 'network_errors'">
          <div v-for="(log, i) in parsedInfoContent.errors" :key="i" class="d-flex align-items-start gap-2 py-1" style="border-bottom: 1px solid rgba(255,255,255,0.04);">
            <span class="badge flex-shrink-0 mt-1" :class="log.type === 'error' ? 'bg-danger' : 'bg-warning text-dark'" style="font-size: 0.55rem; font-family: monospace;">{{ log.method || 'REQ' }}</span>
            <span v-if="log.status_code" class="badge flex-shrink-0 mt-1" :class="log.status_code >= 500 ? 'bg-danger' : 'bg-warning text-dark'" style="font-size: 0.55rem;">{{ log.status_code }}</span>
            <span v-else class="badge flex-shrink-0 mt-1 bg-danger" style="font-size: 0.55rem;">ERR</span>
            <div class="min-w-0 flex-grow-1">
              <div :style="{ color: log.type === 'error' ? '#ef4444' : '#eab308' }" style="word-break: break-all; white-space: pre-wrap; font-size: 0.7rem;">{{ log.url }}</div>
              <div v-if="log.error" class="mt-1" style="color: #f59e0b; font-size: 0.6rem;">{{ log.error }}</div>
            </div>
          </div>
        </template>

        <template v-else>
          <div v-for="(log, i) in parsedInfoContent.errors" :key="i" class="d-flex align-items-start gap-2 py-1" style="border-bottom: 1px solid rgba(255,255,255,0.04);">
            <span class="badge flex-shrink-0 mt-1" :class="log.type === 'error' ? 'bg-danger' : 'bg-warning text-dark'" style="font-size: 0.55rem;">{{ log.type }}</span>
            <div class="min-w-0 flex-grow-1">
              <div :style="{ color: log.type === 'error' ? '#ef4444' : '#eab308' }" style="word-break: break-all; white-space: pre-wrap; font-size: 0.7rem;">{{ log.text }}</div>
              <div v-if="log.location" class="mt-1" style="color: #6b7280; font-size: 0.6rem;">{{ log.location }}</div>
            </div>
          </div>
        </template>

        <div v-if="parsedInfoContent.errors.length === 0" style="color: #9ca3af; font-size: 0.7rem;">Sin errores o advertencias nuevos.</div>
      </template>
      <pre v-else class="mb-0" style="white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word;">{{ msg.content }}</pre>
    </div>
    <div
      v-else
      class="d-inline-block rounded-3 p-3 text-start"
      :class="msg.role === 'user' ? 'user-bubble' : 'assistant-bubble'"
      style="max-width: 80%;"
    >
      <div v-if="msg.thinking" class="mb-2">
        <button
          class="btn btn-sm w-100 text-start btn-outline-argentina"
          data-bs-toggle="collapse"
          :data-bs-target="'#think-' + uid"
        >
          🧠 Razonamiento interno
        </button>
        <div class="collapse mt-1" :id="'think-' + uid">
          <pre class="mb-0 small text-muted" style="white-space: pre-wrap;">{{ msg.thinking }}</pre>
        </div>
      </div>
      <ChatFormatter v-if="!isRaw" :text="msg.content" /><pre v-else class="mb-0" style="white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word;">{{ msg.content }}</pre>
    </div>
  </div>
</template>

<script>
import ControlSelect from '../chat-controls/ChatControlSelect.vue'
import ControlTextarea from '../chat-controls/ChatControlTextarea.vue'
import ChatCdSelector from '../chat-controls/ChatCdSelector.vue'
import DeployConfigForm from '../chat-controls/DeployConfigForm.vue'
import ChatComandoEditControl from '../chat-controls/ChatComandoEditControl.vue'
import ChatControlButtons from '../chat-controls/ChatControlButtons.vue'
import ChatControlFollowup from '../chat-controls/ChatControlFollowup.vue'
import ChatOpencodeForm from '../chat-controls/ChatOpencodeForm.vue'
import ChatGenerarCommitForm from '../chat-controls/ChatGenerarCommitForm.vue'
import ChatFormatter from './ChatFormatter.vue'
import FuncionalidadListControl from '../chat-controls/FuncionalidadListControl.vue'
import RedmineProjectList from '../redmine/RedmineProjectList.vue'
import TicketEditControl from '../tickets/TicketEditControl.vue'
import TicketCreateControl from '../tickets/TicketCreateControl.vue'
import DescripcionEditControl from '../chat-controls/DescripcionEditControl.vue'
import DescripcionInputControl from '../chat-controls/DescripcionInputControl.vue'
import DescripcionResultControl from '../chat-controls/DescripcionResultControl.vue'
import CommitResultControl from '../chat-controls/CommitResultControl.vue'
import ResolutionSelectControl from '../chat-controls/ResolutionSelectControl.vue'
import RedmineCommentsSendControl from '../redmine/RedmineCommentsSendControl.vue'
import AmbientesDiffCommentControl from '../redmine/AmbientesDiffCommentControl.vue'
import TicketCommentControl from '../tickets/TicketCommentControl.vue'
import PeticionFormControl from '../peticiones/PeticionFormControl.vue'
import PeticionResultDisplay from '../peticiones/PeticionResultDisplay.vue'
import NavegadorIniciarForm from '../chat-controls/NavegadorIniciarForm.vue'
import CrearProyectoRedmineControl from '../projects/CrearProyectoRedmineControl.vue'

let counter = 0

export default {
  components: { ControlSelect, ControlTextarea, ChatCdSelector, DeployConfigForm, ChatControlFollowup, ChatOpencodeForm, ChatGenerarCommitForm, ChatFormatter, FuncionalidadListControl, RedmineProjectList, TicketEditControl, TicketCreateControl, DescripcionEditControl, DescripcionInputControl, DescripcionResultControl, CommitResultControl, ChatControlButtons, ResolutionSelectControl, RedmineCommentsSendControl, AmbientesDiffCommentControl, TicketCommentControl, ChatComandoEditControl, PeticionFormControl, PeticionResultDisplay, NavegadorIniciarForm, CrearProyectoRedmineControl },
  props: {
    msg: { type: Object, required: true },
    rawMsgKeys: { type: Set, default: () => new Set() },
  },
  emits: ['control-confirm', 'contextmenu'],
  computed: {
    msgKey() {
      return this.msg.id || this.msg._key
    },
    isRaw() {
      return this.rawMsgKeys.has(this.msgKey)
    },
    uid() {
      counter++
      return 'cm-' + counter
    },
    parsedControl() {
      try {
        return this.msg.controlData || (typeof this.msg.content === 'string' ? JSON.parse(this.msg.content) : this.msg.content)
      } catch (e) {
        console.error('Error parsing control message:', e)
        return null
      }
    },
    parsedInfo() {
      if (this.msg.role !== 'opencode_result') return null
      if (typeof this.msg.content !== 'string' || !this.msg.content.startsWith('{')) return this.msg.extra || null
      try {
        const data = JSON.parse(this.msg.content)
        if (data.hash || data.extra?.hash) return data
      } catch {
      }
      return this.msg.extra || null
    },

    parsedInfoContent() {
      if (this.msg.role !== 'opencode_info') return null
      try {
        const data = JSON.parse(this.msg.content)
        if (data && (data.type === 'console_errors' || data.type === 'network_errors')) return data
      } catch (e) {
        console.error('Error parsing infoContent message:', e)
      }
      return null
    },

  },
}
</script>

<style scoped>
.mb-3 > div {
  overflow-wrap: break-word;
  word-break: break-word;
}
.user-bubble {
  background-color: #75AADB;
  color: #fff;
  border: 1px solid #75AADB;
}
.assistant-bubble {
  background-color: #1a2744;
  color: #e0e0e0;
  border: 1px solid #374151;
}
.btn-outline-argentina {
  background-color: transparent;
  color: #75AADB;
  border: 1px solid #75AADB;
}
.btn-outline-argentina:hover {
  background-color: #1a2a4e;
  color: #75AADB;
}
</style>
