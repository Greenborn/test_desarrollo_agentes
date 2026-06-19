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
      const rawVal = eqIdx >= 0 ? arg.slice(eqIdx + 1) : 'true'
      const val = rawVal.replace(/^["']|["']$/g, '')
      const def = schema[key]
      params[key] = def?.type === 'number' ? Number(val) : val
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
