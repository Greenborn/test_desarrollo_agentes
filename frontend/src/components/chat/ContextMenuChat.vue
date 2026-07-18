<template>
  <div v-if="ctxMenu.show" class="context-menu-backdrop" @click="close" @contextmenu.prevent="close"></div>
  <div v-if="ctxMenu.show" ref="menuRef" class="context-menu" :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }" @click.stop>
    <div class="context-menu-item" @click="toggleRaw(ctxMenu.msg)">{{ isRaw ? '🎨 Vista formateada' : '📄 Vista texto plano' }}</div>
    <div class="context-menu-item" @click="copyPlain(ctxMenu.msg)">📋 Copiar texto plano</div>
    <div class="context-menu-item" @click="copyRef">📋 Copiar referencia</div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item text-danger" @click="deleteMsg(ctxMenu.msg)">🗑️ Eliminar mensaje</div>
  </div>
</template>

<script>
import { useComponentContextMenu } from '../../composables/useComponentContextMenu.js'
import { adjustContextMenuPosition } from '../../utils/contextMenu.js'

export default {
  props: {
    ctxMenu: { type: Object, required: true },
    rawMsgKeys: { type: Set, default: () => new Set() },
    msgKey: { type: Function, default: (msg) => msg.id || msg._key },
  },
  emits: ['toggleRaw', 'copyPlain', 'delete', 'close', 'adjustPosition'],
  computed: {
    isRaw() {
      if (!this.ctxMenu.msg) return false
      return this.rawMsgKeys.has(this.msgKey(this.ctxMenu.msg))
    },
  },
  methods: {
    toggleRaw(msg) { this.$emit('toggleRaw', msg) },
    copyPlain(msg) { this.$emit('copyPlain', msg) },
    deleteMsg(msg) { this.$emit('delete', msg) },
    close() { this.$emit('close') },
    copyRef() {
      const { buildComponentRef } = useComponentContextMenu()
      const ref = buildComponentRef(this.ctxMenu.target)
      if (ref) {
        navigator.clipboard.writeText(ref).catch(err => console.error('Error al copiar referencia:', err))
      }
      this.$emit('close')
    },
  },
  watch: {
    'ctxMenu.show'(val) {
      if (val) {
        this.$nextTick(() => {
          const el = this.$refs.menuRef
          if (el) {
            const adjusted = adjustContextMenuPosition(el, this.ctxMenu.x, this.ctxMenu.y)
            this.$emit('adjustPosition', adjusted)
          }
        })
      }
    },
  },
}
</script>

<style scoped>
.context-menu-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1040;
}
.context-menu {
  position: fixed;
  z-index: 1050;
  background: #1a2744;
  border: 1px solid #75AADB;
  border-radius: 6px;
  padding: 4px 0;
  min-width: 180px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}
.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 0.875rem;
  color: #e0e0e0;
}
.context-menu-item:hover {
  background: #1a2a4e;
}
.context-menu-item.text-danger {
  color: #f87171 !important;
}
.context-menu-item.text-danger:hover {
  background: #3a1a1a;
}
.context-menu-divider {
  height: 1px;
  background: #374151;
  margin: 4px 0;
}
</style>
