<template>
  <div class="terminal-window">
    <div class="terminal-header">
      <span class="terminal-dots">
        <span class="dot dot-red"></span>
        <span class="dot dot-yellow"></span>
        <span class="dot dot-green"></span>
      </span>
      <span class="terminal-title">OpenCode Agent — user@opencode:~/project</span>
      <span class="terminal-copy" @click="copyAll" title="Copiar todo">📋</span>
    </div>
    <div ref="terminalEl" class="terminal-body" @dblclick="copyAll">
      <div v-if="!internalLines.length" class="terminal-line prompt-line">
        <span class="prompt-user">user</span>
        <span class="prompt-at">@</span>
        <span class="prompt-host">opencode</span>
        <span class="prompt-sep">:</span>
        <span class="prompt-path">~</span>
        <span class="prompt-dollar">$</span>
        <span class="prompt-text">Esperando respuesta...</span>
      </div>
      <div v-for="(line, i) in displayLines" :key="i" class="terminal-line" :class="line.css">
        <template v-if="line.type === 'command'">
          <span class="prompt-dollar">$</span>
          <span class="command-text">{{ line.text }}</span>
        </template>
        <template v-else-if="line.type === 'output'">
          <span class="output-text">{{ line.text }}</span>
        </template>
        <template v-else-if="line.type === 'thinking'">
          <span class="thinking-text">{{ line.text }}</span>
        </template>
        <template v-else-if="line.type === 'diff'">
          <span class="diff-text">{{ line.text }}</span>
        </template>
        <template v-else-if="line.type === 'done'">
          <span class="done-text">{{ line.text }}</span>
        </template>
        <template v-else-if="line.type === 'separator'">
          <span>&nbsp;</span>
        </template>
        <template v-else>
          {{ line.text }}
        </template>
      </div>
      <div v-if="streaming" class="terminal-line cursor-line">
        <span class="cursor-blink">▊</span>
      </div>
      <div v-if="!streaming && internalLines.length" class="terminal-line cursor-line">
        <span class="cursor-end">_</span>
      </div>
    </div>
    <div class="terminal-statusbar">
      <span class="status-item" :class="streaming ? 'status-running' : 'status-idle'">
        {{ streaming ? '● RUNNING' : '● IDLE' }}
      </span>
      <span class="status-item">{{ internalLines.length }} lines</span>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick } from 'vue'

export default {
  props: {
    lines: { type: Array, default: () => [] },
    streaming: { type: Boolean, default: false },
  },
  setup(props) {
    const terminalEl = ref(null)
    const internalLines = ref([])

    watch(() => props.lines, (val) => {
      internalLines.value = val
    }, { deep: true, immediate: true })

    const displayLines = computed(() => {
      const result = []
      for (const raw of internalLines.value) {
        if (raw === null || raw === undefined) continue
        const trimmed = String(raw)
        if (trimmed.startsWith('$ ')) {
          result.push({ type: 'command', text: trimmed.slice(2), css: 'line-cmd' })
        } else if (trimmed.startsWith('💭')) {
          result.push({ type: 'thinking', text: trimmed, css: 'line-thinking' })
        } else if (trimmed.startsWith('📁')) {
          result.push({ type: 'diff', text: trimmed, css: 'line-diff' })
        } else if (trimmed.startsWith('✅')) {
          result.push({ type: 'done', text: trimmed, css: 'line-done' })
        } else if (trimmed.startsWith('❌') || trimmed.startsWith('✗')) {
          result.push({ type: 'error', text: trimmed, css: 'line-error' })
        } else if (trimmed === '') {
          result.push({ type: 'separator', text: '', css: 'line-sep' })
        } else {
          result.push({ type: 'output', text: trimmed, css: 'line-output' })
        }
      }
      return result
    })

    async function copyAll() {
      try {
        await navigator.clipboard.writeText(internalLines.value.join('\n'))
      } catch {}
    }

    watch(() => internalLines.value.length, async () => {
      await nextTick()
      if (terminalEl.value) {
        terminalEl.value.scrollTop = terminalEl.value.scrollHeight
      }
    })

    return { terminalEl, internalLines, displayLines, copyAll }
  },
}
</script>

<style scoped>
.terminal-window {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  overflow: hidden;
  margin: 8px 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.terminal-header {
  background: #161b22;
  border-bottom: 1px solid #30363d;
  padding: 7px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  user-select: none;
}

.terminal-dots {
  display: flex;
  gap: 7px;
}

.dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
}
.dot-red { background: #ff5f56; }
.dot-yellow { background: #ffbd2e; }
.dot-green { background: #27c93f; }

.terminal-title {
  flex: 1;
  text-align: center;
  color: #8b949e;
  font-size: 0.75rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.terminal-copy {
  cursor: pointer;
  font-size: 0.85rem;
  opacity: 0.5;
  transition: opacity 0.15s;
}
.terminal-copy:hover { opacity: 1; }

.terminal-body {
  background: #0d1117;
  padding: 12px 16px;
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
  font-size: 0.82rem;
  line-height: 1.6;
  height: 360px;
  min-height: 200px;
  overflow-y: auto;
  user-select: text;
  cursor: text;
}

.terminal-body::-webkit-scrollbar {
  width: 7px;
}
.terminal-body::-webkit-scrollbar-track {
  background: #0d1117;
}
.terminal-body::-webkit-scrollbar-thumb {
  background: #30363d;
  border-radius: 4px;
}

.terminal-line {
  white-space: pre-wrap;
  word-break: break-all;
  color: #e6edf3;
  min-height: 1.3em;
}

.prompt-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px;
}

.prompt-user { color: #58a6ff; }
.prompt-at { color: #8b949e; }
.prompt-host { color: #58a6ff; }
.prompt-sep { color: #8b949e; }
.prompt-path { color: #d2a8ff; }
.prompt-dollar { color: #3fb950; margin-right: 8px; flex-shrink: 0; }
.prompt-text { color: #8b949e; font-style: italic; }

.command-text { color: #ffa657; }
.output-text { color: #e6edf3; }
.thinking-text { color: #8b949e; font-style: italic; }
.diff-text { color: #58a6ff; }
.done-text { color: #3fb950; font-weight: 600; }
.error-text { color: #f85149; }

.line-cmd { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px; }
.line-output { padding-left: 16px; border-left: 2px solid #21262d; margin: 1px 0; }
.line-thinking { padding-left: 4px; border-left: 2px solid #21262d; margin: 2px 0; }
.line-diff { padding-left: 12px; }
.line-done { }
.line-error { }

.line-sep { height: 8px; }

.cursor-line {
  display: flex;
  align-items: center;
  min-height: 1.4em;
}

.cursor-blink {
  animation: blink 1s step-end infinite;
  color: #3fb950;
  font-size: 1rem;
}

.cursor-end {
  color: #3fb950;
  font-size: 1rem;
}

@keyframes blink {
  50% { opacity: 0; }
}

.terminal-statusbar {
  background: #161b22;
  border-top: 1px solid #30363d;
  padding: 4px 14px;
  display: flex;
  gap: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 0.7rem;
}

.status-item {
  color: #8b949e;
}

.status-running { color: #3fb950; }
.status-idle { color: #8b949e; }
</style>
