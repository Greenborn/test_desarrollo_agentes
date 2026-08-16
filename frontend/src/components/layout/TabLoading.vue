<template>
  <div class="tab-loading d-flex align-items-center justify-content-center h-100" style="min-height: 120px;">
    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
    <span class="small text-secondary">Cargando pestaña...</span>
  </div>
</template>

<script>
export default {
  name: 'TabLoading',
}
</script>

<style scoped>
.tab-loading {
  background: transparent;
}
</style>
