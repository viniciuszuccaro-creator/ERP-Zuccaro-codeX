// Shared predicate for the existing legacy catalogue and transactional Produto relation guard.
// Equality of reviewed meaning is not authorization, lineage proof or quantity conversion.
const own = (row, key) => row && Object.prototype.hasOwnProperty.call(row, key);
const texts = ['id', 'group_id', 'sigla', 'nome_completo', 'tipo_grandeza'];
const bools = ['ativo', 'permite_conversao', 'usa_em_estoque', 'usa_em_compras', 'usa_em_vendas'];
function decimal(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  const match = /^(\d+)(?:\.(\d+))?$/.exec(String(value));
  if (!match) return null;
  const integer = match[1].replace(/^0+(?=\d)/, '');
  const fraction = (match[2] || '').replace(/0+$/, '');
  if (integer === '0' && !fraction) return null;
  return `${integer}${fraction ? `.${fraction}` : ''}`;
}
/** @param {Record<string, unknown> | null | undefined} actual
 * @param {Record<string, unknown> | null | undefined} reviewed */
export function unidadeSemanticaEquivalente(actual, reviewed) {
  if (!actual || !reviewed) return false;
  for (const key of texts) {
    if (!own(actual, key) || !own(reviewed, key) || typeof actual[key] !== 'string'
      || typeof reviewed[key] !== 'string' || !reviewed[key] || actual[key] !== reviewed[key]) return false;
  }
  for (const key of bools) {
    if (!own(actual, key) || !own(reviewed, key) || typeof actual[key] !== 'boolean'
      || typeof reviewed[key] !== 'boolean' || actual[key] !== reviewed[key]) return false;
  }
  if (actual.ativo !== true || reviewed.ativo !== true) return false;
  for (const key of ['empresa_id', 'unidade_base_conversao']) {
    if (!own(actual, key) || !own(reviewed, key)
      || !(reviewed[key] === null || typeof reviewed[key] === 'string')
      || actual[key] !== reviewed[key]) return false;
  }
  return own(actual, 'fator_conversao_para_base') && own(reviewed, 'fator_conversao_para_base')
    && decimal(reviewed.fator_conversao_para_base) !== null
    && decimal(actual.fator_conversao_para_base) === decimal(reviewed.fator_conversao_para_base);
}
