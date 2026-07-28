export function getCamposJson(fields_def) {
  if (!fields_def || !Array.isArray(fields_def)) return {}
  const result = {}
  for (const fd of fields_def) {
    if (fd.isJson) {
      result[fd.field] = fd
    }
  }
  return result
}

export function mapFilaJSONtabla(row, camposJson) {
  if (!row || !camposJson) return row
  for (const [field, cfg] of Object.entries(camposJson)) {
    const val = row[field]
    if (typeof val === 'string') {
      try {
        row[field] = JSON.parse(val)
      } catch {
        row[field] = val
      }
    }
  }
  return row
}

export function getCamposJSONyFieldDef(fields_def, camposJson, row) {
  if (!fields_def || !Array.isArray(fields_def)) return fields_def
  if (!camposJson || !row) return fields_def
  for (const [field, cfg] of Object.entries(camposJson)) {
    const val = row[field]
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      for (const [sub, subVal] of Object.entries(val)) {
        fields_def.push({
          field: `${field}.${sub}`,
          headerName: sub,
          sortable: false,
          filterable: false,
        })
      }
    }
  }
  return fields_def
}
