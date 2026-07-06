export function useCsvParser() {
  function parseCsv(rawContent, delimiter, quoteChar, hasHeader) {
    if (!rawContent) {
      return { columns: [], rows: [] }
    }

    const lines = rawContent.split(/\r?\n/).filter(line => line.trim().length > 0)
    if (lines.length === 0) {
      return { columns: [], rows: [] }
    }

    const delim = delimiter
    const quote = quoteChar

    function parseLine(line) {
      const result = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (inQuotes) {
          if (ch === quote) {
            if (i + 1 < line.length && line[i + 1] === quote) {
              current += quote
              i++
            } else {
              inQuotes = false
            }
          } else {
            current += ch
          }
        } else {
          if (ch === quote) {
            inQuotes = true
          } else if (ch === delim) {
            result.push(current.trim())
            current = ''
          } else {
            current += ch
          }
        }
      }
      result.push(current.trim())
      return result
    }

    const parsed = lines.map(line => parseLine(line))
    const maxCols = Math.max(...parsed.map(r => r.length))
    let columns, rows

    if (hasHeader && parsed.length > 0) {
      columns = parsed[0].map((c, idx) => c || `Columna ${idx + 1}`)
      while (columns.length < maxCols) {
        columns.push(`Columna ${columns.length + 1}`)
      }
      rows = parsed.slice(1).map(row => {
        while (row.length < maxCols) row.push('')
        return row
      })
    } else {
      columns = Array.from({ length: maxCols }, (_, i) => `Columna ${i + 1}`)
      rows = parsed.map(row => {
        while (row.length < maxCols) row.push('')
        return row
      })
    }

    return { columns, rows }
  }

  return { parseCsv }
}
