<template>
  <div>
    <div
      v-for="(modal, i) in stack"
      :key="modal.id"
      class="app-modal-overlay"
      :style="{ zIndex: 1050 + i }"
    >
      <div class="app-modal-backdrop"></div>
      <div class="app-modal-wrapper" :class="{ wide: modal.wide }">
        <div class="app-modal-dialog">
          <div class="app-modal-header">
            <slot :name="'header-' + modal.id">
              <h5 class="app-modal-title font-monospace">{{ modal.title }}</h5>
            </slot>
            <button class="app-modal-close btn-close btn-close-white" @click="close(modal.id)"></button>
          </div>
          <div class="app-modal-body">
            <component :is="modal.component" v-bind="modal.props" @close="close(modal.id)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useModalStore } from '../../stores/modal.js'

export default {
  setup() {
    const modal = useModalStore()
    const { stack } = storeToRefs(modal)

    watch(() => stack.value.length, (len) => {
      document.body.style.overflow = len > 0 ? 'hidden' : ''
    })

    function close(id) {
      modal.close(id)
    }

    return { stack, close }
  },
}
</script>

<style>
.app-modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.app-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
}
.app-modal-wrapper {
  position: relative;
  width: 90%;
  max-width: 720px;
  max-height: 85vh;
}
.app-modal-wrapper.wide {
  max-width: 98%;
  width: 100%;
  height: 96vh;
}
.app-modal-wrapper.wide .app-modal-dialog {
  height: 100%;
  max-height: none;
}
.app-modal-wrapper.wide .app-modal-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.app-modal-dialog {
  background: #212529;
  border: 1px solid #495057;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  max-height: 85vh;
}
.app-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #495057;
}
.app-modal-title {
  margin: 0;
  font-size: 1rem;
  color: #f8f9fa;
}
.app-modal-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  opacity: 0.7;
}
.app-modal-close:hover {
  opacity: 1;
}
.app-modal-body {
  padding: 16px;
  overflow-y: auto;
  color: #e0e0e0;
}
</style>
