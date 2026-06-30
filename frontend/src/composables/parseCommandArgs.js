export function splitArgs(input) {
  const args = []
  let current = ''
  let inSingleQuote = false

  for (const ch of input) {
    if (ch === "'") {
      inSingleQuote = !inSingleQuote
      current += ch
    } else if (ch === ' ' && !inSingleQuote) {
      if (current.length > 0) {
        args.push(current)
        current = ''
      }
    } else {
      current += ch
    }
  }
  if (current.length > 0) args.push(current)

  return args
}

export function getUsedFlags(args) {
  return args
    .filter(a => a.startsWith('--'))
    .map(a => {
      const eqIdx = a.indexOf('=')
      return eqIdx >= 0 ? a.slice(0, eqIdx + 1) : a
    })
}

export function parseCommandArgs(args, schema = {}) {
  const params = {}
  const errors = []

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=')
      const key = eqIdx >= 0 ? arg.slice(2, eqIdx) : arg.slice(2)
      if (!key) continue
      let rawVal = eqIdx >= 0 ? arg.slice(eqIdx + 1) : 'true'
      if (rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1)
      } else if (rawVal.startsWith('"') && rawVal.endsWith('"')) {
        rawVal = rawVal.slice(1, -1)
      }
      const def = schema[key]
      params[key] = def?.type === 'number' ? Number(rawVal) : rawVal
    }
  }

  for (const [key, def] of Object.entries(schema)) {
    if (def.required && !(key in params)) {
      const typeLabel = def.type || 'valor'
      errors.push(`Parámetro requerido: --${key}=<${typeLabel}>`)
    }
  }

  return { params, errors }
}
