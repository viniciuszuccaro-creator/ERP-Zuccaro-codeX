import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { clienteLocalOperationalRemainder } from './clienteLocalOperationalRemainder.js';

// Purpose split only; the preceding c93 helper and all its pins remain intact.
export const clienteLocaisPurposeBaseline = '109ec52a5f866eff1d5c689bacfcccacd73dcabf';
export const clienteLocaisPurposeHunks = {
  "src/api/httpApiClient.js": {
    "hash": "9159f8a6330530fea2d633889972cf9ef1a5a9c52f841de9ee81600640ba8d74",
    "hunks": [
      [
        "    /**\n     * Pagina autoritativa para revisao; envelope invalido nunca representa vazio.\n     * @param {string} clienteId\n     * @param {{offset?: number, finalidade?: 'FISCAL'|'ENTREGA', signal?: AbortSignal}} [options]\n     */\n    async listLocaisReviewPage(clienteId, { offset = 0, finalidade, signal } = {}) {\n      const id = String(clienteId ?? '').trim();\n      if (!id) throw new Error('Cliente obrigatorio para revisao de locais');\n      if (finalidade !== undefined && !['FISCAL', 'ENTREGA'].includes(finalidade)) throw new Error('Finalidade de revisao invalida');\n      const scope = Object.freeze({ ...getScope() });\n      const page = await request(`/api/v1/clientes/${encodeURIComponent(id)}/locais`, {\n        query: { limit: 50, offset, ativo: 'false', order_by: 'nome', ...(finalidade ? { finalidade } : {}) }, signal, unwrap: false,\n      }, scope);\n      const meta = page?.meta;\n      if (!Array.isArray(page?.data) || !meta || page.partial === true || meta.partial === true\n        || page.incomplete === true || meta.incomplete === true || meta.limit !== 50 || meta.offset !== offset\n        || !Number.isSafeInteger(meta.total) || meta.total < 0 || typeof meta.hasMore !== 'boolean'\n        || page.data.length > 50 || offset + page.data.length > meta.total\n        || meta.hasMore !== (offset + page.data.length < meta.total)\n        || (meta.hasMore && page.data.length === 0)\n        || new Set(page.data.map(row => row?.id)).size !== page.data.length\n        || page.data.some(row => !row || typeof row.id !== 'string' || row.ativo !== false\n          || row.cliente_id !== id || row.group_id !== scope.groupId\n          || !Array.isArray(row.finalidades)\n          || row.finalidades.some(f => !f || typeof f.finalidade !== 'string')\n          || (finalidade && !row.finalidades.some(f => f.finalidade === finalidade && f.ativo === true)))) {\n        throw new Error('Resposta incompleta ou invalida na revisao de locais');\n      }\n      return page;\n    },\n",
        "    /**\n     * Pagina autoritativa para revisao; envelope invalido nunca representa vazio.\n     * @param {string} clienteId\n     * @param {{offset?: number, signal?: AbortSignal}} [options]\n     */\n    async listLocaisReviewPage(clienteId, { offset = 0, signal } = {}) {\n      const id = String(clienteId ?? '').trim();\n      if (!id) throw new Error('Cliente obrigatorio para revisao de locais');\n      const scope = Object.freeze({ ...getScope() });\n      const page = await request(`/api/v1/clientes/${encodeURIComponent(id)}/locais`, {\n        query: { limit: 50, offset, ativo: 'false', order_by: 'nome' }, signal, unwrap: false,\n      }, scope);\n      const meta = page?.meta;\n      if (!Array.isArray(page?.data) || !meta || page.partial === true || meta.partial === true\n        || page.incomplete === true || meta.incomplete === true || meta.limit !== 50 || meta.offset !== offset\n        || !Number.isSafeInteger(meta.total) || meta.total < 0 || typeof meta.hasMore !== 'boolean'\n        || page.data.length > 50 || offset + page.data.length > meta.total\n        || meta.hasMore !== (offset + page.data.length < meta.total)\n        || (meta.hasMore && page.data.length === 0)\n        || new Set(page.data.map(row => row?.id)).size !== page.data.length\n        || page.data.some(row => !row || typeof row.id !== 'string' || row.ativo !== false\n          || row.cliente_id !== id || row.group_id !== scope.groupId\n          || !Array.isArray(row.finalidades)\n          || row.finalidades.some(f => !f || typeof f.finalidade !== 'string'))) {\n        throw new Error('Resposta incompleta ou invalida na revisao de locais');\n      }\n      return page;\n    },\n"
      ]
    ]
  },
  "src/components/cadastros/CadastroClienteCompleto.jsx": {
    "hash": "8a99466088c04fa056ef8d343018469399481b46b1e6117aee30090fd3172cd5",
    "hunks": [
      [
        "                  <h3 className=\"font-semibold mb-3\">Endereço Principal (Fiscal)</h3>\n                  {isHttpBackendMode && <ClienteLocaisRevisao clienteId={clienteBoundId || cliente?.id} groupId={groupId} empresaId={empresaAtual?.id} finalidade=\"FISCAL\" />}\n                  <div className=\"grid grid-cols-4 gap-4\">\n",
        "                  <h3 className=\"font-semibold mb-3\">Endereço Principal (Fiscal)</h3>\n                  {isHttpBackendMode && cliente?.id && <button type=\"button\" className=\"text-sm text-blue-700 underline mb-3\" onClick={() => setActiveTab('enderecos')}>Consultar locais inativos em revisao, sem substituir este endereco</button>}\n                  <div className=\"grid grid-cols-4 gap-4\">\n"
      ],
      [
        "              />\n              {isHttpBackendMode && <ClienteLocaisRevisao clienteId={clienteBoundId || cliente?.id} groupId={groupId} empresaId={empresaAtual?.id} finalidade=\"ENTREGA\" />}\n            </TabsContent>\n",
        "              />\n              {isHttpBackendMode && <ClienteLocaisRevisao clienteId={clienteBoundId || cliente?.id} groupId={groupId} empresaId={empresaAtual?.id} />}\n            </TabsContent>\n"
      ]
    ]
  }
};
const hash = source => createHash('sha256').update(source).digest('hex');

export function clienteLocaisPurposeRemainder(file, text, verify = true) {
  const entry = clienteLocaisPurposeHunks[file];
  if (!entry) return text;
  let source = clienteLocalOperationalRemainder(file, text).replace(/\r\n/g, '\n');
  if (hash(source) === entry.hash) return text;
  const markers = file.endsWith('.jsx')
    ? ['finalidade="FISCAL"', 'finalidade="ENTREGA"']
    : ["Finalidade de revisao invalida", "finalidade?: 'FISCAL'|'ENTREGA'", 'offset = 0, finalidade, signal'];
  // Older inputs must still pass the unchanged downstream historical guards.
  if (!markers.some(marker => source.includes(marker))) return text;
  for (const [after, before] of entry.hunks) {
    assert.equal(source.split(after).length, 2, file + ': exact purpose review hunk');
    source = source.replace(after, () => before);
  }
  if (verify) assert.equal(hash(source), entry.hash, file + ': entire pre-purpose source');
  return text.includes('\r\n') ? source.replace(/\n/g, '\r\n') : source;
}
