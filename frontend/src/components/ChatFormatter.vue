<template>
  <div v-if="parsedHtml" v-html="parsedHtml" style="white-space: pre-wrap;"></div>
  <div v-else style="white-space: pre-wrap;">{{ text }}</div>
</template>

<script>
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function processInline(text) {
  let result = text

  result = result.replace(/`([^`]+)`/g, '<code>$1</code>')

  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>')

  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>')
  result = result.replace(/(^|\s)_([^_]+)_(\s|$)/g, '$1<em>$2</em>$3')

  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

  return result
}

function parseMarkdown(text) {
  if (!text) return ''

  let html = escapeHtml(text)

  const codeBlocks = []
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length
    codeBlocks.push({ lang, code: code.trim() })
    return `%%CB${idx}%%`
  })

  const lines = html.split('\n')
  const out = []
  let inP = false

  function closeP() {
    if (inP) { out.push('</p>'); inP = false }
  }

  function flush() {
    closeP()
    const r = out.join('')
    out.length = 0
    return r
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const t = line.trim()

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      closeP()
      out.push('<hr>')
      continue
    }

    if (t.startsWith('|') && t.endsWith('|')) {
      const tableLines = [t]
      while (i + 1 < lines.length) {
        const n = lines[i + 1].trim()
        if (!n.startsWith('|') || !n.endsWith('|')) break
        tableLines.push(n)
        i++
      }
      if (tableLines.length >= 2 && /^\|[-:| ]+\|$/.test(tableLines[1].trim())) {
        closeP()
        const headerCells = tableLines[0].split('|').slice(1, -1).map(c => c.trim())
        const alignments = tableLines[1].split('|').slice(1, -1).map(a => {
          if (a.startsWith(':') && a.endsWith(':')) return ' style="text-align:center"'
          if (a.endsWith(':')) return ' style="text-align:right"'
          return ''
        })
        let tableHtml = '<table class="table table-dark table-bordered table-sm mb-2" style="border: 1px solid #555; color: #e0e0e0;"><thead><tr>'
        headerCells.forEach((cell, idx) => {
          tableHtml += `<th${alignments[idx] || ''}>${processInline(cell)}</th>`
        })
        tableHtml += '</tr></thead><tbody>'
        for (let r = 2; r < tableLines.length; r++) {
          const cells = tableLines[r].split('|').slice(1, -1).map(c => c.trim())
          tableHtml += '<tr>'
          cells.forEach((cell, idx) => {
            tableHtml += `<td${alignments[idx] || ''}>${processInline(cell)}</td>`
          })
          tableHtml += '</tr>'
        }
        tableHtml += '</tbody></table>'
        out.push(tableHtml)
        continue
      }
    }

    const hMatch = t.match(/^(#{1,6})\s+(.+)$/)
    if (hMatch) {
      closeP()
      out.push(`<h${hMatch[1].length}>${processInline(hMatch[2])}</h${hMatch[1].length}>`)
      continue
    }

    if (t.startsWith('> ')) {
      closeP()
      out.push(`<blockquote><p>${processInline(t.slice(2))}</p></blockquote>`)
      continue
    }

    const ulMatch = t.match(/^[-*+]\s+(.+)$/)
    if (ulMatch) {
      closeP()
      const items = [processInline(ulMatch[1])]
      while (i + 1 < lines.length) {
        const n = lines[i + 1].trim()
        const m = n.match(/^[-*+]\s+(.+)$/)
        if (!m) break
        items.push(processInline(m[1]))
        i++
      }
      out.push('<ul>' + items.map((x) => `<li>${x}</li>`).join('') + '</ul>')
      continue
    }

    const olMatch = t.match(/^\d+\.\s+(.+)$/)
    if (olMatch) {
      closeP()
      const items = [processInline(olMatch[1])]
      while (i + 1 < lines.length) {
        const n = lines[i + 1].trim()
        const m = n.match(/^\d+\.\s+(.+)$/)
        if (!m) break
        items.push(processInline(m[1]))
        i++
      }
      out.push('<ol>' + items.map((x) => `<li>${x}</li>`).join('') + '</ol>')
      continue
    }

    if (t === '') {
      closeP()
      continue
    }

    if (!inP) { out.push('<p>'); inP = true }
    else { out.push('<br>') }
    out.push(processInline(line))
  }

  closeP()
  const result = flush()

  const final = result.replace(/%%CB(\d+)%%/g, (_, idx) => {
    const b = codeBlocks[parseInt(idx)]
    const lang = b.lang ? ` class="language-${b.lang}"` : ''
    return `<pre${lang}><code>${escapeHtml(b.code)}</code></pre>`
  })

  const hasMarkdown = /<(h[1-6]|strong|em|code|pre|ul|ol|li|blockquote|hr|a|table|th|td|tr|thead|tbody)\b/.test(final)
  return hasMarkdown ? final : ''
}

export default {
  props: {
    text: { type: String, default: '' },
  },
  computed: {
    parsedHtml() {
      return parseMarkdown(this.text)
    },
  },
}
</script>
