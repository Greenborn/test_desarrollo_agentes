export function getProcessFieldDef(fields_def) {
  if (!fields_def || !Array.isArray(fields_def)) return []
  return fields_def.map(fd => ({
    field: fd.field,
    headerName: fd.headerName || fd.field,
    sortable: fd.sortable !== false,
    filterable: fd.filterable !== false,
    css: fd.css || '',
    form_type: fd.form_type || null,
    type: fd.type || 'text',
    editable: fd.editable || false,
  }))
}

export function reOrder(cols, order) {
  if (!order || !order.length) return cols
  const ordered = []
  for (const f of order) {
    const found = cols.find(c => c.field === f)
    if (found) ordered.push(found)
  }
  for (const c of cols) {
    if (!ordered.some(x => x.field === c.field)) ordered.push(c)
  }
  return ordered
}

export function getFieldsForFilter(cols) {
  if (!cols) return []
  return cols.filter(c => c.filterable !== false).map(c => c.field)
}

export function getFiltersFrFields(fields_def) {
  if (!fields_def) return {}
  const result = {}
  for (const fd of fields_def) {
    if (fd.filterable !== false) {
      result[fd.field] = { value: null, matchMode: 'contains' }
    }
  }
  return result
}

export function getFieldDefFFormated(fields_def) {
  if (!fields_def || !Array.isArray(fields_def)) return fields_def
  return fields_def.map(fd => ({
    ...fd,
    headerName: fd.headerName || fd.field,
  }))
}
