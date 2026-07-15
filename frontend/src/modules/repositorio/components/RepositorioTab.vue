<template>
  <RepoView class="flex-grow-1" :key="activeSessionId" />
</template>

<script>
import { computed } from 'vue'
import { useChatStore } from '../../../stores/chat.js'
import RepoView from '../../../components/dev-tools/RepoView.vue'
export default {
  components: { RepoView },
  setup() {
    const chatStore = useChatStore()
    const activeSessionId = computed(() => chatStore.activeSessionId)
    return { activeSessionId }
  },
}
</script>
