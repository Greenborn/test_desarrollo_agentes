let initialized = false
let backdropEl = null
let menuEl = null
let currentRefText = ''

export function useComponentContextMenu() {
  function initGlobalHandler() {
    if (initialized) return
    initialized = true

    document.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      setTimeout(() => {
        if (document.querySelector('.context-menu-backdrop')) return

        const ref = buildComponentRef(e.target)
        if (!ref) return

        currentRefText = ref
        showMenu(e.clientX, e.clientY)
      }, 0)
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideMenu()
    })

    document.addEventListener('click', (e) => {
      if (e.button !== 2) hideMenu()
    })
  }

  function buildComponentRef(el) {
    let current = el
    let componentPath = ''
    let componentName = ''

    while (current && current !== document.documentElement) {
      const vpc = current.__vueParentComponent
      if (vpc) {
        const type = vpc.type
        if (type.__file) {
          const idx = type.__file.indexOf('frontend/')
          componentPath = idx >= 0 ? type.__file.substring(idx) : type.__file
        }
        componentName = type.name || type.__name || ''
        if (componentPath || componentName) break
      }
      current = current.parentElement
    }

    let ref = componentPath || componentName
    if (!ref) return ''

    const tag = el.tagName ? el.tagName.toLowerCase() : ''
    const interactiveTags = ['button', 'input', 'select', 'textarea', 'a']
    if (interactiveTags.includes(tag) || el.getAttribute?.('role') === 'button') {
      ref = ref + ' | type:' + tag + (el.id ? ' | #' + el.id : '')
    }

    return ref
  }

  function showMenu(x, y) {
    hideMenu()

    backdropEl = document.createElement('div')
    backdropEl.className = 'context-menu-backdrop'
    backdropEl.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1040;'
    backdropEl.addEventListener('click', hideMenu)
    backdropEl.addEventListener('contextmenu', (e) => { e.preventDefault(); hideMenu() })

    menuEl = document.createElement('div')
    menuEl.className = 'context-menu'
    menuEl.style.cssText = 'position:fixed;z-index:1050;background:#1a2744;border:1px solid #75AADB;border-radius:6px;padding:4px 0;min-width:200px;box-shadow:0 4px 12px rgba(0,0,0,0.4);left:' + x + 'px;top:' + y + 'px;'
    menuEl.addEventListener('click', (e) => e.stopPropagation())

    const item = document.createElement('div')
    item.className = 'context-menu-item'
    item.textContent = '📋 Copiar referencia'
    item.style.cssText = 'padding:8px 16px;cursor:pointer;font-size:0.875rem;color:#e0e0e0;user-select:none;'
    item.addEventListener('mouseenter', () => { item.style.background = '#1a2a4e' })
    item.addEventListener('mouseleave', () => { item.style.background = '' })
    item.addEventListener('click', () => {
      navigator.clipboard.writeText(currentRefText).catch(err => console.error('Error al copiar referencia:', err))
      hideMenu()
    })

    menuEl.appendChild(item)
    document.body.appendChild(backdropEl)
    document.body.appendChild(menuEl)
  }

  function hideMenu() {
    if (backdropEl && backdropEl.parentNode) backdropEl.parentNode.removeChild(backdropEl)
    if (menuEl && menuEl.parentNode) menuEl.parentNode.removeChild(menuEl)
    backdropEl = null
    menuEl = null
  }

  return { initGlobalHandler, buildComponentRef }
}
