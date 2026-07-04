<template>
  <div class="oc-agent-terminal d-flex flex-column border rounded overflow-hidden" style="border-color: #30363d; background: #0d1117;">
    <div class="d-flex align-items-center px-2 py-1" style="background: #161b22; border-bottom: 1px solid #30363d;">
      <span class="small text-muted">OpenCode Agent — Terminal</span>
      <div class="ms-auto d-flex gap-1">
        <button class="btn btn-sm btn-outline-secondary py-0 px-1" style="font-size: 0.6rem;" @click="$emit('clear')" title="Limpiar terminal">🗑</button>
        <button class="btn btn-sm btn-outline-secondary py-0 px-1" style="font-size: 0.6rem;" @click="$emit('close')" title="Cerrar terminal">✕</button>
      </div>
    </div>
    <div ref="terminalBody" class="oc-terminal-body flex-grow-1 overflow-y-auto p-2 small font-monospace" style="min-height: 400px; max-height: 600px; line-height: 1.4; white-space: pre-wrap; word-break: break-word; color: #e6edf3; background: #0d1117;">
      <div v-if="!content" class="text-muted" style="font-style: italic;">Esperando salida del agente...</div>
      <span v-for="(seg, i) in parsedLines" :key="i" :style="seg.style">{{ seg.text }}</span>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick } from 'vue'

const ANSI_RE = /\x1b\[([0-9;]*)m/g

const ANSI_STYLES = {
  '0': { color: '#e6edf3' },
  '1': { fontWeight: 'bold' },
  '38;5;214': { color: '#d29922' },
  '38;5;246': { color: '#8b949e' },
  '38;5;39': { color: '#58a6ff' },
  '38;5;40': { color: '#3fb950' },
  '38;5;245': { color: '#6e7681' },
  '38;5;124': { color: '#ff7b72' },
}

function parseAnsi(text) {
  if (!text) return [{ text: '', style: {} }]
  const clean = text.replace(/\\x1b/g, '\x1b')
  const segments = []
  let currentStyle = {}
  let lastIndex = 0
  let match
  while ((match = ANSI_RE.exec(clean)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: clean.slice(lastIndex, match.index), style: { ...currentStyle } })
    }
    const codes = match[1].split(';')
    if (codes[0] === '0' || codes[0] === '') {
      currentStyle = {}
    } else {
      for (const code of codes) {
        if (ANSI_STYLES[code]) {
          Object.assign(currentStyle, ANSI_STYLES[code])
        }
      }
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < clean.length) {
    segments.push({ text: clean.slice(lastIndex), style: { ...currentStyle } })
  }
  return segments
}

export default {
  props: {
    content: { type: String, default: '' },
  },
  emits: ['close', 'clear'],
  setup(props) {
    const terminalBody = ref(null)

    const parsedLines = computed(() => parseAnsi(props.content))

    watch(() => props.content, () => {
      nextTick(() => {
        if (terminalBody.value) {
          terminalBody.value.scrollTop = terminalBody.value.scrollHeight
        }
      })
    })

    return { terminalBody, parsedLines }
  },
}
</script>

<style scoped>
.oc-agent-terminal {
  flex-shrink: 0;
}
.oc-terminal-body::-webkit-scrollbar {
  width: 6px;
}
.oc-terminal-body::-webkit-scrollbar-thumb {
  background: #30363d;
  border-radius: 3px;
}
.oc-terminal-body::-webkit-scrollbar-track {
  background: transparent;
}
</style>
