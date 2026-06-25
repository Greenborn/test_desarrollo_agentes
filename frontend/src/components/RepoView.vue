<template>
  <div class="repo-view d-flex flex-column h-100">
    <template v-if="!activeSessionId">
      <div class="flex-grow-1 d-flex align-items-center justify-content-center text-muted small">
        Seleccione una conversación para ver su repositorio
      </div>
    </template>

    <template v-else-if="loading">
      <div class="flex-grow-1 d-flex align-items-center justify-content-center text-muted small">
        Verificando repositorio...
      </div>
    </template>

    <template v-else-if="!isGitRepo">
      <div class="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-muted small gap-1">
        <span>El directorio base de la sesión no contiene un repositorio Git</span>
        <span class="text-secondary" style="font-size: 0.65rem;">{{ cwd || '(directorio no disponible)' }}</span>
      </div>
    </template>

    <template v-else>
      <div class="repo-toolbar d-flex align-items-center px-3 py-1 flex-shrink-0">
        <span class="current-branch-label small" style="font-size: 0.75rem;">
          <span class="text-success">●</span> {{ currentBranch || '—' }}
        </span>
        <span class="ms-2 text-secondary" style="font-size: 0.65rem;">{{ repoPath }}</span>
        <div class="zoom-controls d-flex align-items-center ms-auto gap-1">
          <button
            class="btn btn-sm btn-outline-secondary py-0 px-1"
            @click="zoomOut"
            :disabled="zoom <= 50"
            style="font-size: 0.7rem; line-height: 1.4;"
          >−</button>
          <span class="small text-secondary px-1" style="font-size: 0.65rem; min-width: 32px; text-align: center;">{{ zoom }}%</span>
          <button
            class="btn btn-sm btn-outline-secondary py-0 px-1"
            @click="zoomIn"
            :disabled="zoom >= 200"
            style="font-size: 0.7rem; line-height: 1.4;"
          >+</button>
          <button
            class="btn btn-sm btn-outline-secondary py-0 px-1"
            @click="resetZoom"
            :disabled="zoom === 100"
            style="font-size: 0.65rem; line-height: 1.4;"
          >⟲</button>
        </div>
        <button
          class="btn btn-sm btn-outline-secondary py-0 px-2 ms-2"
          @click="refresh"
          :disabled="loading"
          style="font-size: 0.7rem;"
        >
          ⟳ Refrescar
        </button>
      </div>
      <div class="d-flex flex-grow-1" style="min-height: 0;">
        <div class="git-graph-panel flex-grow-1 overflow-auto">
          <GitGraphSvg :commits="structuredCommits" :zoom="zoom" :branches="branches" />
        </div>
        <div class="git-branches-panel flex-shrink-0 overflow-y-auto px-3 py-2 border-start border-secondary" style="width: 170px;">
          <div class="small text-secondary mb-2" style="font-size: 0.7rem;">Ramas</div>
          <div
            v-for="b in branches"
            :key="b.name"
            class="branch-item small px-1 py-0 mb-1"
            :class="{ current: b.isCurrent }"
            style="font-size: 0.7rem; cursor: default;"
          >
            {{ b.isCurrent ? '●' : '○' }} {{ b.name }}
          </div>
          <div v-if="tags.length" class="small text-secondary mt-3 mb-2" style="font-size: 0.7rem;">Tags</div>
          <div
            v-for="t in tags"
            :key="t.name"
            class="tag-item small px-1 py-0 mb-1"
            style="font-size: 0.65rem; cursor: default;"
          >
            <rect width="6" height="6" rx="1" fill="#d29922" style="display: inline-block;" />
            {{ t.name }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { ref, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../stores/chat.js'
import { useGitStore } from '../stores/git.js'
import GitGraphSvg from './GitGraphSvg.vue'

export default {
  components: { GitGraphSvg },
  setup() {
    const chatStore = useChatStore()
    const gitStore = useGitStore()
    const { activeSessionId, sessions } = storeToRefs(chatStore)
    const cwd = ref('')

    function refresh() {
      const sessionId = activeSessionId.value
      const session = sessions.value.find(s => s.id === sessionId)
      cwd.value = session?.cwd || ''
      gitStore.fetchRepoData(sessionId)
    }

    watch(activeSessionId, (newId, oldId) => {
      if (newId !== oldId) {
        refresh()
      }
    })

    onMounted(() => {
      refresh()
      gitStore.loadZoom('git')
    })

    return {
      loading: gitStore.loading,
      isGitRepo: gitStore.isGitRepo,
      repoPath: gitStore.repoPath,
      cwd,
      currentBranch: gitStore.currentBranch,
      branches: gitStore.branches,
      tags: gitStore.tags,
      structuredCommits: gitStore.structuredCommits,
      activeSessionId,
      zoom: gitStore.gitZoom,
      zoomIn: () => gitStore.zoomIn('git'),
      zoomOut: () => gitStore.zoomOut('git'),
      resetZoom: () => gitStore.resetZoom('git'),
      refresh,
    }
  },
}
</script>

<style scoped>
.repo-view {
  background: #1a1a2e;
}
.repo-toolbar {
  background: #16213e;
  border-bottom: 1px solid #374151;
}
.current-branch-label {
  color: #cbd5e1;
}
.git-graph-panel {
  background: #0d1117;
  overflow-x: auto;
}
.git-branches-panel {
  background: #16213e;
  min-width: 150px;
}
.branch-item {
  color: #8b949e;
  line-height: 1.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.branch-item.current {
  color: #3fb950;
  font-weight: 600;
}
.tag-item {
  color: #d29922;
  line-height: 1.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
