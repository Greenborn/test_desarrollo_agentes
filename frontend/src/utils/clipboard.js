export function copyToClipboard(text) {
  if (typeof text !== 'string') text = String(text)

  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch((err) => {
      console.log('[clipboard] navigator.clipboard.writeText falló:', err.message)
      return fallbackCopy(text)
    })
  }

  return fallbackCopy(text)
}

function fallbackCopy(text) {
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (!ok) {
      console.log('[clipboard] document.execCommand("copy") devolvió false')
      return Promise.reject(new Error('document.execCommand("copy") falló'))
    }
    return Promise.resolve(true)
  } catch (err) {
    console.log('[clipboard] Fallback copy falló:', err.message)
    return Promise.reject(err)
  }
}
