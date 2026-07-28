export function row_formatter(row, fields_def) {
  if (!row || !fields_def) return row
  for (const fd of fields_def) {
    if (fd.formatter && typeof fd.formatter === 'function') {
      row[fd.field] = fd.formatter(row[fd.field], row)
    }
  }
  return row
}
