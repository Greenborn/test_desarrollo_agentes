<template>
  <transition name="slide-down">
    <div v-if="visible" class="global-command-bar" ref="barEl" @mouseleave="onMouseLeave" @mouseenter="cancelHide">
      <div class="container-fluid px-3 py-1">
        <CommandInput />
      </div>
    </div>
  </transition>
</template>

<script>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import CommandInput from '../chat/CommandInput.vue'

export default {
  components: { CommandInput },
  setup() {
    const visible = ref(false)
    const barEl = ref(null)
    const inputFocused = ref(false)
    let hideTimer = null

    function cancelHide() {
      if (hideTimer) {
        clearTimeout(hideTimer)
        hideTimer = null
      }
    }

    function show() {
      visible.value = true
      cancelHide()
      nextTick(() => {
        const input = barEl.value?.querySelector('input')
        if (input) input.focus()
      })
    }

    function hide() {
      if (inputFocused.value) return
      cancelHide()
      visible.value = false
    }

    function onMouseMove(e) {
      if (e.clientY <= 15 && !visible.value) {
        show()
      }
    }

    function onMouseLeave() {
      cancelHide()
      hideTimer = setTimeout(hide, 500)
    }

    function onDocumentClick(e) {
      if (visible.value && barEl.value && !barEl.value.contains(e.target)) {
        hide()
      }
    }

    function onKeydown(e) {
      if (e.key === 'Escape' && visible.value) {
        visible.value = false
        const input = barEl.value?.querySelector('input')
        if (input) input.blur()
      }
    }

    function onGlobalFocusIn(e) {
      const input = barEl.value?.querySelector('input')
      if (input && e.target === input) {
        inputFocused.value = true
      }
    }

    function onGlobalFocusOut(e) {
      const input = barEl.value?.querySelector('input')
      if (input && e.target === input) {
        inputFocused.value = false
        // Si el mouse no está sobre la barra, programar ocultamiento
        if (visible.value) {
          cancelHide()
          hideTimer = setTimeout(hide, 500)
        }
      }
    }

    onMounted(() => {
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('click', onDocumentClick)
      document.addEventListener('keydown', onKeydown)
      document.addEventListener('focusin', onGlobalFocusIn)
      document.addEventListener('focusout', onGlobalFocusOut)
    })

    onUnmounted(() => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('click', onDocumentClick)
      document.removeEventListener('keydown', onKeydown)
      document.removeEventListener('focusin', onGlobalFocusIn)
      document.removeEventListener('focusout', onGlobalFocusOut)
      if (hideTimer) clearTimeout(hideTimer)
    })

    return { visible, barEl, onMouseLeave, cancelHide }
  },
}
</script>

<style scoped>
.global-command-bar {
  background: #1a2744;
  border-bottom: 1px solid #374151;
  position: relative;
  z-index: 100;
}
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.slide-down-enter-to,
.slide-down-leave-from {
  max-height: 60px;
  opacity: 1;
}
</style>
