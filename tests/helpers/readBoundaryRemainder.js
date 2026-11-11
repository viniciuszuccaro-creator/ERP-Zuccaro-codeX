import assert from 'node:assert/strict';

const scalarFunction = "/** @param {unknown} value */\nexport function displayScalar(value) {\n  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)) ? value : null;\n}\n";
const userBefore = "      const err = new Error('Authentication required');\n      err.status = 401;\n      err.authType = 'auth_required';";
const userAfter = "      const err = Object.assign(new Error('Authentication required'), { status: 401, authType: 'auth_required' });";
export const readBoundaryHunks = {
  'src/lib/utils.js': [[scalarFunction, '', 1]],
  'src/components/chatbot/ChatbotFilaEspera.jsx': [
    ["import { displayScalar } from '@/lib/utils';\n", '', 1],
    ...['cliente_nome', 'prioridade', 'canal', 'status', 'sentimento_geral'].map(field => [`displayScalar(conversa.${field})`, `conversa.${field}`, 1]),
  ],
  'src/pages/OrcamentoSite.jsx': [
    ['import { displayScalar } from "@/lib/utils";\n', '', 1],
    ['displayScalar(p.descricao)', 'p.descricao', 1],
    ['displayScalar(p.codigo) || displayScalar(p.slug_site) || ""', 'p.codigo || p.slug_site || ""', 1],
  ],
  'src/components/lib/UserContext.jsx': [[userAfter, userBefore, 2]],
  'src/components/comercial/CentralCliente360Panel.jsx': [
    ['  isHttpApiError,\n  readHttpErrorBodyCode,\n', '', 1],
    ['const status = isHttpApiError(query.error) ? query.error.status : undefined;', 'const status = query.error?.status;', 1],
    ['const code = isHttpApiError(query.error) ? query.error.code || readHttpErrorBodyCode(query.error.body) : undefined;', 'const code = query.error?.code || query.error?.body?.error?.code;', 1],
  ],
  'src/components/comercial/centralCliente360Pagination.js': [
    [' * @template {Record<string, number>} T\n * @param {T} limits', ' * @param {Record<string, number>} limits', 1],
    [' * @returns {{[K in keyof T]: number} & Record<string, number>}\n', '', 1],
  ],
  'src/components/lib/useOrigemPedido.jsx': [['gcTime: 10 * 60 * 1000, // 10 minutos', 'cacheTime: 10 * 60 * 1000, // 10 minutos', 1]],
};
export function readBoundaryRemainder(file, text) {
  const hunks = readBoundaryHunks[file];
  if (!hunks) return text;
  let source = text.replace(/\r\n/g, '\n');
  for (const [current, previous, count] of hunks) {
    assert.equal(source.split(current).length - 1, count, `${file}: exact read boundary hunk`);
    source = source.split(current).join(previous);
  }
  if (file === 'src/components/lib/useOrigemPedido.jsx') {
    assert.ok(source.endsWith('export default useOrigemPedido;\n'), 'one final LF at existing export');
    source = source.slice(0, -1);
  }
  return source;
}
