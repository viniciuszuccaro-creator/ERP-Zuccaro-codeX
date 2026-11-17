import assert from 'node:assert/strict';

// Exact document fix layer; historical pins and all non-document bytes stay unchanged.
export const clienteDocumentoHunks = [
  ['  hydrateClienteHttpRowForUi,\n', ''],
  ['  const [formData, setFormData] = useState(() => (cliente ? /** @type {typeof cliente} */ (hydrateClienteHttpRowForUi(cliente)) : {',
    '  const [formData, setFormData] = useState(cliente || {'],
  ['    group_id: groupId\n  }));', '    group_id: groupId\n  });'],
  [`        const documentField = data.tipo === 'Pessoa Física' ? 'cpf' : data.tipo === 'Pessoa Jurídica' ? 'cnpj' : null;
        // The visible edited field owns the document; the hydrated alias may be stale.
        if (documentField && typeof data[documentField] === 'string') {
          if (data[documentField].trim()) payload.documento = data[documentField];
          else if (data.documento) throw new Error('CPF/CNPJ vazio: documento anterior preservado. Corrija antes de salvar.');
        }
`, ''],
];

export function clienteDocumentoRemainder(text) {
  let source = text.replace(/\r\n/g, '\n');
  if (!clienteDocumentoHunks.some(([after]) => source.includes(after))) return text;
  for (const [after, before] of clienteDocumentoHunks) {
    assert.equal(source.split(after).length, 2, 'exact document hydration/save hunk');
    source = source.replace(after, () => before);
  }
  return text.includes('\r\n') ? source.replace(/\n/g, '\r\n') : source;
}

// Only the reviewed transport wiring is peeled; all ancestral pins remain intact.
export function clienteLocalOperationalRemainder(file, text) {
  if (file === 'src/components/cadastros/CadastroClienteCompleto.jsx') text = clienteDocumentoRemainder(text);
  let source = text.replace(/\r\n/g, '\n');
  const changes = file === 'src/api/httpApiClient.js' ? [
    ["import { createClienteLocalBatchHttpApi } from './clienteLocalBatchHttp.js';\n", ''],
    ['    ...createClienteLocalBatchHttpApi({ request, getScope, createHttpError }),\n', ''],
  ] : file === 'server/src/api/router.ts' ? [
    ['service.snapshot(ctxFromReq(req), req.params.clienteId, req.query.include_review === \'true\')',
      'service.snapshot(ctxFromReq(req), req.params.clienteId)'],
  ] : file === 'src/components/cadastros/CadastroClienteCompleto.jsx' ? [
    ['finalidade="FISCAL" allowReviewEdit />', 'finalidade="FISCAL" />'],
  ] : [];
  if (!changes.some(([after]) => source.includes(after))) return text;
  for (const [after, before] of changes) {
    assert.equal(source.split(after).length, 2, file + ': exact operational wiring');
    source = source.replace(after, () => before);
  }
  return text.includes('\r\n') ? source.replace(/\n/g, '\r\n') : source;
}
