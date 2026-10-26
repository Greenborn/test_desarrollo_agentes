<template>
  <div class="almacenamiento-container d-flex flex-column flex-grow-1 overflow-hidden" style="min-height: 0;">
    <FileTreePanel :session-id="ALMACENAMIENTO_TREE_KEY" />
  </div>
</template>

<script>
import FileTreePanel from '../../../components/files/FileTreePanel.vue'
import { ALMACENAMIENTO_TREE_KEY } from '../../../stores/fileTree.js'

export default {
  components: { FileTreePanel },
  setup() {
    return { ALMACENAMIENTO_TREE_KEY }
  },
}
</script>

<style scoped>
.almacenamiento-container {
  min-height: 0;
}
</style>
