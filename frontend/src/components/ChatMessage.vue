<template>
  <div class="mb-3" :class="msg.role === 'user' || msg.role === 'command' ? 'text-end' : 'text-start'" @contextmenu.prevent="$emit('contextmenu', $event, msg)">
    <div v-if="msg.role === 'command'" class="d-inline-block rounded-3 p-2 text-start font-monospace" style="max-width: 90%; background: #1a2744; border: 1px solid #E8B800; color: #E8B800;">
      {{ msg.content }}
    </div>
    <div v-else-if="msg.role === 'result'" class="d-inline-block rounded-3 p-2 text-start font-monospace small" style="max-width: 90%; background: #16213e; border: 1px solid #75AADB; color: #e0e0e0;">
      <ChatFormatter :text="msg.content" />
    </div>
    <div v-else-if="msg.role === 'opencode_control'" class="d-block w-100 rounded-3 p-3 text-start" style="background: #1a2744; border: 1px solid #75AADB; color: #e0e0e0;">
      <ChatGenerarCommitForm v-if="parsedControl && parsedControl.controlType === 'generar_commit_form'" :models="parsedControl.models || []" :modelValue="parsedControl.modelValue || ''" :thinkingOptions="parsedControl.thinkingOptions || []" :thinkingValue="parsedControl.thinkingValue || ''" :temperatureOptions="parsedControl.temperatureOptions || []" :temperatureValue="parsedControl.temperatureValue || ''" :modeValue="parsedControl.modeValue || 'Plan'" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <ChatOpencodeForm v-else-if="parsedControl && parsedControl.controlType === 'opencode_form'" :models="parsedControl.models || []" :modelValue="parsedControl.modelValue || ''" :thinkingOptions="parsedControl.thinkingOptions || []" :thinkingValue="parsedControl.thinkingValue || ''" :temperatureOptions="parsedControl.temperatureOptions || []" :temperatureValue="parsedControl.temperatureValue || ''" :modeValue="parsedControl.modeValue || 'Build'" :placeholder="parsedControl.placeholder || ''" :rows="parsedControl.rows || 3" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
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
      <TicketCreateControl v-else-if="parsedControl && parsedControl.controlType === 'ticket_create'" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <DescripcionInputControl v-else-if="parsedControl && parsedControl.controlType === 'descripcion_input'" :placeholder="parsedControl.placeholder || ''" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <DescripcionResultControl v-else-if="parsedControl && parsedControl.controlType === 'descripcion_result'" :description="parsedControl.description || ''" :loading="parsedControl.loading || false" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <DescripcionResultControl v-else-if="parsedControl && parsedControl.controlType === 'refinar_result'" :description="parsedControl.description || ''" :loading="parsedControl.loading || false" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <CommitResultControl v-else-if="parsedControl && parsedControl.controlType === 'commit_result'" :message="parsedControl.message || ''" :loading="parsedControl.loading || false" :modoEnvioInicial="parsedControl.modo_envio || 'encolar'" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <RedmineCommentsSendControl v-else-if="parsedControl && parsedControl.controlType === 'redmine_comments_send'" :comentarios_ids="parsedControl.comentarios_ids || []" :ticket_redmine_id="parsedControl.ticket_redmine_id || 0" :mensaje="parsedControl.mensaje || ''" :cantidad="parsedControl.cantidad || 0" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
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
      <ChatFormatter :text="msg.content" /><span v-if="msg.streaming" class="blink">▌</span>
    </div>
    <div v-else-if="msg.role === 'opencode_result'" class="d-block w-100 rounded-3 p-3 text-start" style="background: #1a2744; border: 1px solid #75AADB; color: #f0f0f0;">
      <ChatFormatter :text="msg.content" />
      <div v-if="parsedInfo && parsedInfo.hash" class="mt-2 small" style="color: #75AADB;">Hash: {{ parsedInfo.hash }}</div>
    </div>
    <div v-else-if="msg.role === 'opencode_info'" class="d-block w-100 rounded-3 p-2 text-start small" style="background: #1a2744; border: 1px solid #374151; color: #9ca3af;">
      <pre class="mb-0" style="white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word;">{{ msg.content }}</pre>
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
      <ChatFormatter :text="msg.content" />
    </div>
  </div>
</template>

<script>
import ControlSelect from './ChatControlSelect.vue'
import ControlTextarea from './ChatControlTextarea.vue'
import ChatControlButtons from './ChatControlButtons.vue'
import ChatControlFollowup from './ChatControlFollowup.vue'
import ChatOpencodeForm from './ChatOpencodeForm.vue'
import ChatGenerarCommitForm from './ChatGenerarCommitForm.vue'
import ChatFormatter from './ChatFormatter.vue'
import FuncionalidadListControl from './FuncionalidadListControl.vue'
import RedmineProjectList from './RedmineProjectList.vue'
import TicketEditControl from './TicketEditControl.vue'
import TicketCreateControl from './TicketCreateControl.vue'
import DescripcionInputControl from './DescripcionInputControl.vue'
import DescripcionResultControl from './DescripcionResultControl.vue'
import CommitResultControl from './CommitResultControl.vue'
import ResolutionSelectControl from './ResolutionSelectControl.vue'
import RedmineCommentsSendControl from './RedmineCommentsSendControl.vue'

let counter = 0

export default {
  components: { ControlSelect, ControlTextarea, ChatControlFollowup, ChatOpencodeForm, ChatGenerarCommitForm, ChatFormatter, FuncionalidadListControl, RedmineProjectList, TicketEditControl, TicketCreateControl, DescripcionInputControl, DescripcionResultControl, CommitResultControl, ChatControlButtons, ResolutionSelectControl, RedmineCommentsSendControl },
  props: {
    msg: { type: Object, required: true },
  },
  emits: ['control-confirm', 'contextmenu'],
  computed: {
    uid() {
      counter++
      return 'cm-' + counter
    },
    parsedControl() {
      try {
        return this.msg.controlData || (typeof this.msg.content === 'string' ? JSON.parse(this.msg.content) : this.msg.content)
      } catch {
        return null
      }
    },
    parsedResult() {
      try {
        const data = typeof this.msg.content === 'string' ? JSON.parse(this.msg.content) : this.msg.content
        if (data && data.type === 'opencode_result') return data
        return data
      } catch {
        return null
      }
    },
    parsedInfo() {
      if (this.msg.role !== 'opencode_result') return null
      // Look for hash in sibling opencode_info messages (not available here)
      // Try to parse content as JSON with hash
      try {
        const data = JSON.parse(this.msg.content)
        if (data.hash || data.extra?.hash) return data
      } catch {}
      return this.msg.extra || null
    },

  },
}
</script>

<style scoped>
.blink {
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  50% { opacity: 0; }
}
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
