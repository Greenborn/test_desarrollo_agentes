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
import GitGraphSvg from './GitGraphSvg.vue'

export default {
  components: { GitGraphSvg },
  setup() {
    const chatStore = useChatStore()
    const { activeSessionId, sessions } = storeToRefs(chatStore)

    const loading = ref(true)
    const isGitRepo = ref(false)
    const repoPath = ref('')
    const cwd = ref('')
    const currentBranch = ref(null)
    const branches = ref([])
    const tags = ref([])
    const structuredCommits = ref([])
    const zoom = ref(100)

    async function fetchRepoData() {
      const sessionId = activeSessionId.value
      if (!sessionId) {
        loading.value = false
        isGitRepo.value = false
        cwd.value = ''
        return
      }

      loading.value = true

      try {
        const verifyRes = await fetch('/api/command/git-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ sessionId }),
        })
        const verifyData = await verifyRes.json()

        const session = sessions.value.find(s => s.id === sessionId)
        cwd.value = session?.cwd || ''

        if (!verifyData.isRepo) {
          isGitRepo.value = false
          loading.value = false
          return
        }

        isGitRepo.value = true
        repoPath.value = verifyData.rootPath || ''

        const structRes = await fetch('/api/command/git-log-structured', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ sessionId, maxCount: 100 }),
        })
        const structData = await structRes.json()

        if (structData.success) {
          structuredCommits.value = structData.commits
          branches.value = structData.branches || []
          const current = structData.branches.find(b => b.isCurrent)
          currentBranch.value = current ? current.name : null
          tags.value = structData.tags || []
        }
      } catch (err) {
        console.error('Error al obtener datos del repositorio:', err)
        isGitRepo.value = false
      } finally {
        loading.value = false
      }
    }

    async function loadZoom() {
      try {
        const res = await fetch('/api/command/setting/git_graph_zoom', { credentials: 'include' })
        const data = await res.json()
        if (data.value !== null && data.value !== undefined) {
          zoom.value = parseInt(data.value, 10) || 100
        }
      } catch (err) {
        console.error('Error al cargar zoom:', err)
      }
    }

    async function saveZoom(val) {
      try {
        await fetch('/api/command/setting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key: 'git_graph_zoom', value: String(val) }),
        })
      } catch (err) {
        console.error('Error al guardar zoom:', err)
      }
    }

    function zoomIn() {
      const val = Math.min(200, zoom.value + 10)
      zoom.value = val
      saveZoom(val)
    }

    function zoomOut() {
      const val = Math.max(50, zoom.value - 10)
      zoom.value = val
      saveZoom(val)
    }

    function resetZoom() {
      zoom.value = 100
      saveZoom(100)
    }

    function refresh() {
      fetchRepoData()
    }

    watch(activeSessionId, (newId, oldId) => {
      if (newId !== oldId) {
        fetchRepoData()
      }
    })

    onMounted(() => {
      fetchRepoData()
      loadZoom()
    })

    return {
      loading,
      isGitRepo,
      repoPath,
      cwd,
      currentBranch,
      branches,
      tags,
      structuredCommits,
      activeSessionId,
      zoom,
      zoomIn,
      zoomOut,
      resetZoom,
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
