<template>
  <Transition name="dropdown-fade">
    <div v-if="show" class="variable-autocomplete-dropdown">
      <div
        v-for="(v, i) in items"
        :key="v.key"
        class="variable-autocomplete-item"
        :class="{ active: i === selectedIndex }"
        @mousedown.prevent
        @click="onSelect(v.key)"
        @mouseenter="$emit('update:selectedIndex', i)"
      >
        <span class="var-key">{{ v.key }}</span>
        <span v-if="v.value" class="var-value text-muted small">{{ v.value }}</span>
      </div>
      <div v-if="items.length === 0" class="px-2 py-1 text-muted small">
        Sin variables disponibles
      </div>
    </div>
  </Transition>
</template>

<script>
export default {
  props: {
    show: { type: Boolean, default: false },
    items: { type: Array, default: () => [] },
    selectedIndex: { type: Number, default: 0 },
  },
  emits: ['select', 'update:selectedIndex'],
  methods: {
    onSelect(key) {
      this.$emit('select', key)
    },
  },
}
</script>

<style scoped>
.variable-autocomplete-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1060;
  background: #1a2744;
  border: 1px solid #374151;
  border-radius: 6px;
  max-height: 200px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.variable-autocomplete-item {
  padding: 6px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.1s;
  font-size: 0.85rem;
}
.variable-autocomplete-item:hover,
.variable-autocomplete-item.active {
  background: #253a5c;
}
.var-key {
  color: #75AADB;
  font-weight: 600;
  font-family: monospace;
  flex-shrink: 0;
}
.var-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
  font-size: 0.8rem;
  color: #9ca3af;
}
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: opacity 0.12s ease;
}
.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
}
</style>
