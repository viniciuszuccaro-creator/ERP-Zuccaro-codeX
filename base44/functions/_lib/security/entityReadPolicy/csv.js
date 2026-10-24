export function serializeReportCsv(rows, fields = Object.keys(rows[0] || {})) {
  const cell = value => {
    let text = value == null ? '' : String(typeof value === 'object' ? JSON.stringify(value) : value);
    if (typeof value !== 'number' && /^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g,'""')}"`;
  };
  return [fields.map(cell).join(','),...rows.map(row => fields.map(field => cell(row[field])).join(','))].join('\r\n');
}
