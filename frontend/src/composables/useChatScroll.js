import { ref, nextTick } from 'vue'

export function useChatScroll() {
  const messagesContainer = ref(null)
  const _isNearBottom = ref(true)

  function checkNearBottom() {
    const el = messagesContainer.value
    if (!el) return true
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight
    return gap < 200
  }

  async function scrollToBottom(force = false) {
    if (!force && !_isNearBottom.value) return
    await nextTick()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    if (!messagesContainer.value) return
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    setTimeout(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    }, 100)
  }

  return { messagesContainer, _isNearBottom, scrollToBottom, checkNearBottom }
}
