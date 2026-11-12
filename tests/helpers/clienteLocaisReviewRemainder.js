import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Frozen additive delta over 947726e8; historical pins are intentionally unchanged.
export const clienteLocaisReviewBaseline = '947726e8f9a79f097e0ffd1d02791df52274d952';
export const clienteLocaisReviewHunks = {
  "src/components/cadastros/CadastroClienteCompleto.jsx": {
    "hash": "bbe180d6368ed9ccf1a162efbdbab464f96ceb3699f417ca63c0a76091aa870a",
    "hunks": [
      [
        "import GerenciarEnderecosClienteForm from \"./GerenciarEnderecosClienteForm\";\nimport ClienteLocaisRevisao from \"./ClienteLocaisRevisao\";\nimport {\n",
        "import GerenciarEnderecosClienteForm from \"./GerenciarEnderecosClienteForm\";\nimport {\n"
      ],
      [
        "                  <h3 className=\"font-semibold mb-3\">Endereço Principal (Fiscal)</h3>\n                  {isHttpBackendMode && cliente?.id && <button type=\"button\" className=\"text-sm text-blue-700 underline mb-3\" onClick={() => setActiveTab('enderecos')}>Consultar locais inativos em revisao, sem substituir este endereco</button>}\n                  <div className=\"grid grid-cols-4 gap-4\">\n",
        "                  <h3 className=\"font-semibold mb-3\">Endereço Principal (Fiscal)</h3>\n                  <div className=\"grid grid-cols-4 gap-4\">\n"
      ],
      [
        "              />\n              {isHttpBackendMode && <ClienteLocaisRevisao clienteId={clienteBoundId || cliente?.id} groupId={groupId} empresaId={empresaAtual?.id} />}\n            </TabsContent>\n",
        "              />\n            </TabsContent>\n"
      ]
    ]
  },
  "src/api/httpApiClient.js": {
    "hash": "53ba94920dd22d22eb96260b8d1ed22d550a082ce21343e67b697cdbfdec990c",
    "hunks": [
      [
        "    },\n    /**\n     * Pagina autoritativa para revisao; envelope invalido nunca representa vazio.\n     * @param {string} clienteId\n     * @param {{offset?: number, signal?: AbortSignal}} [options]\n     */\n    async listLocaisReviewPage(clienteId, { offset = 0, signal } = {}) {\n      const id = String(clienteId ?? '').trim();\n      if (!id) throw new Error('Cliente obrigatorio para revisao de locais');\n      const scope = Object.freeze({ ...getScope() });\n      const page = await request(`/api/v1/clientes/${encodeURIComponent(id)}/locais`, {\n        query: { limit: 50, offset, ativo: 'false', order_by: 'nome' }, signal, unwrap: false,\n      }, scope);\n      const meta = page?.meta;\n      if (!Array.isArray(page?.data) || !meta || page.partial === true || meta.partial === true\n        || page.incomplete === true || meta.incomplete === true || meta.limit !== 50 || meta.offset !== offset\n        || !Number.isSafeInteger(meta.total) || meta.total < 0 || typeof meta.hasMore !== 'boolean'\n        || page.data.length > 50 || offset + page.data.length > meta.total\n        || meta.hasMore !== (offset + page.data.length < meta.total)\n        || (meta.hasMore && page.data.length === 0)\n        || new Set(page.data.map(row => row?.id)).size !== page.data.length\n        || page.data.some(row => !row || typeof row.id !== 'string' || row.ativo !== false\n          || row.cliente_id !== id || row.group_id !== scope.groupId\n          || !Array.isArray(row.finalidades)\n          || row.finalidades.some(f => !f || typeof f.finalidade !== 'string'))) {\n        throw new Error('Resposta incompleta ou invalida na revisao de locais');\n      }\n      return page;\n    },\n    /**\n",
        "    },\n    /**\n"
      ]
    ]
  }
};
const hash = text => createHash('sha256').update(text).digest('hex');

export function clienteLocaisReviewRemainder(file, text, verify = true) {
  const entry = clienteLocaisReviewHunks[file];
  if (!entry) return text;
  let source = text.replace(/\r\n/g, '\n');
  if (hash(source) === entry.hash) return text;
  // Ancestors without this layer remain subject to their original downstream guards.
  const markers = file.endsWith('.jsx')
    ? ['ClienteLocaisRevisao', 'Consultar locais inativos em revisao']
    : ['listLocaisReviewPage', 'Pagina autoritativa para revisao'];
  if (!markers.some(marker => source.includes(marker))) return text;
  for (const [addition, previous] of entry.hunks) {
    assert.equal(source.split(addition).length, 2, file + ': exact frozen review addition');
    source = source.replace(addition, () => previous);
  }
  // Legacy non-verifying callers deliberately expose outside edits to their own hash.
  if (verify) assert.equal(hash(source), entry.hash, file + ': entire pre-review source');
  return text.includes('\r\n') ? source.replace(/\n/g, '\r\n') : source;
}
