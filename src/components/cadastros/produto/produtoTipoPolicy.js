const TIPOS = [
  ['REVENDA', 'Revenda'],
  ['MATERIA_PRIMA', 'Matéria-Prima Produção'],
  ['COMPONENTE', 'Componente'],
  ['INTERMEDIARIO', 'Intermediário'],
  ['FABRICADO', 'Produto Acabado'],
  ['KIT', 'Kit'],
  ['SERVICO', 'Serviço'],
  ['RETALHO', 'Retalho'],
  ['SUCATA', 'Sucata'],
  ['CONSUMO_INTERNO', 'Consumo Interno'],
];

export const PRODUTO_TIPOS_CANONICOS = Object.freeze(
  Object.fromEntries(TIPOS),
);

export const PRODUTO_TIPO_OPTIONS = Object.freeze(
  TIPOS.map(([key, value]) => Object.freeze({ key, value, label: value })),
);

const aliases = new Map([
  ['REVENDA', PRODUTO_TIPOS_CANONICOS.REVENDA],
  ['MATERIA PRIMA', PRODUTO_TIPOS_CANONICOS.MATERIA_PRIMA],
  ['MATERIA PRIMA PRODUCAO', PRODUTO_TIPOS_CANONICOS.MATERIA_PRIMA],
  ['COMPONENTE', PRODUTO_TIPOS_CANONICOS.COMPONENTE],
  ['INTERMEDIARIO', PRODUTO_TIPOS_CANONICOS.INTERMEDIARIO],
  ['FABRICADO', PRODUTO_TIPOS_CANONICOS.FABRICADO],
  ['PRODUTO ACABADO', PRODUTO_TIPOS_CANONICOS.FABRICADO],
  ['KIT', PRODUTO_TIPOS_CANONICOS.KIT],
  ['SERVICO', PRODUTO_TIPOS_CANONICOS.SERVICO],
  ['RETALHO', PRODUTO_TIPOS_CANONICOS.RETALHO],
  ['SUCATA', PRODUTO_TIPOS_CANONICOS.SUCATA],
  ['CONSUMO INTERNO', PRODUTO_TIPOS_CANONICOS.CONSUMO_INTERNO],
]);

function aliasKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function normalizeProdutoTipoItem(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return PRODUTO_TIPOS_CANONICOS.REVENDA;
  return aliases.get(aliasKey(trimmed)) || trimmed;
}

export function resolveProdutoTipoImportacao(value) {
  const original = String(value || '').trim();
  if (!original) {
    return { value: PRODUTO_TIPOS_CANONICOS.REVENDA, requiresReview: false, usedDefault: true };
  }
  const normalized = normalizeProdutoTipoItem(original);
  const known = PRODUTO_TIPO_OPTIONS.some((option) => option.value === normalized);
  return { value: normalized, requiresReview: !known, usedDefault: false };
}
export function isProdutoTipo(value, expected) {
  return normalizeProdutoTipoItem(value) === expected;
}

export function isProdutoRevenda(value) {
  return isProdutoTipo(value, PRODUTO_TIPOS_CANONICOS.REVENDA);
}

export function isProdutoMateriaPrima(value) {
  return isProdutoTipo(value, PRODUTO_TIPOS_CANONICOS.MATERIA_PRIMA);
}

export function isProdutoAcabado(value) {
  return isProdutoTipo(value, PRODUTO_TIPOS_CANONICOS.FABRICADO);
}

export function isProdutoVendavel(value) {
  return isProdutoRevenda(value) || isProdutoAcabado(value);
}
export function getProdutoTipoOptions(currentValue) {
  const normalized = normalizeProdutoTipoItem(currentValue);
  if (PRODUTO_TIPO_OPTIONS.some((option) => option.value === normalized)) {
    return PRODUTO_TIPO_OPTIONS;
  }
  return [
    ...PRODUTO_TIPO_OPTIONS,
    Object.freeze({ key: 'LEGADO', value: normalized, label: normalized, legacy: true }),
  ];
}
