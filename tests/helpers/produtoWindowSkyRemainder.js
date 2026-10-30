import assert from 'node:assert/strict';

/**
 * #433 — chrome sky + ID técnico no windowMode de ProdutoFormV22_Completo.
 * Peels exatamente o bloco autorizado de volta ao wrapper `bg-white` anterior,
 * preservando golden stage46 / product-query-v5 (sem pin cego).
 */
const AFTER =
  '  // Recuperação azul-clara (erp-integra): chrome sky + ID técnico no windowMode existente.\n'
  + '  // Keep both com ProdutoFormCompleto; sem 3º módulo; sem alterar persistência/RBAC.\n'
  + '  if (windowMode) {\n'
  + '    const boundId = produto?.id || null;\n'
  + '    return (\n'
  + '      <div className="w-full h-full flex flex-col bg-white" data-produto-v22-window-sky="true">\n'
  + '        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-sky-50 to-sky-100 shrink-0">\n'
  + '          <Package className="w-6 h-6 text-sky-600" />\n'
  + '          <h2 className="text-lg font-bold text-slate-900">\n'
  + '            {boundId ? \'Editar Produto\' : \'Novo Produto\'}\n'
  + '          </h2>\n'
  + '        </div>\n'
  + '        <div className="flex-1 overflow-auto min-h-0">\n'
  + '          {boundId ? (\n'
  + '            <p className="text-xs text-slate-500 px-4 pt-3">\n'
  + '              ID técnico: <span className="font-mono">{String(boundId)}</span>\n'
  + '            </p>\n'
  + '          ) : null}\n'
  + '          {content}\n'
  + '        </div>\n'
  + '      </div>\n'
  + '    );\n'
  + '  }\n';

const BEFORE =
  '  if (windowMode) {\n'
  + '    return <div className="w-full h-full bg-white">{content}</div>;\n'
  + '  }\n';

export function produtoWindowSkyRemainder(file, source) {
  if (!file.endsWith('ProdutoFormV22_Completo.jsx')) return source;
  // Preserva CRLF de runtimeProofSource (product-query-v5); stage46 entra em LF.
  const crlf = source.includes('\r\n');
  const text = source.replace(/\r\n/g, '\n');
  assert.equal(text.split(AFTER).length - 1, 1, 'produto window sky hunk must appear exactly once');
  const peeled = text.replace(AFTER, BEFORE);
  return crlf ? peeled.replace(/\n/g, '\r\n') : peeled;
}
