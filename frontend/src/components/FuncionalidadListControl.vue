<template>
  <div class="d-flex flex-column gap-2">
    <div
      v-for="item in items"
      :key="item.sessionId"
      class="d-flex align-items-center justify-content-between p-2 rounded"
      style="background: #0f0f1e; border: 1px solid #374151; cursor: pointer;"
      @click="select(item)"
    >
      <span>{{ item.nombre }}</span>
      <span :class="'badge ' + badgeClass(item.etapa)">{{ item.etapa }}</span>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    items: { type: Array, required: true },
  },
  emits: ['confirm'],
  methods: {
    select(item) {
      this.$emit('confirm', { sessionId: item.sessionId, proyectoId: item.proyectoId })
    },
    badgeClass(etapa) {
      const map = {
        RELEVAMIENTO: 'bg-info',
        DISENIO: 'bg-primary',
        IMPLEMENTACION: 'bg-warning text-dark',
        TESTING: 'bg-success',
      }
      return map[etapa] || 'bg-secondary'
    },
  },
}
</script>
