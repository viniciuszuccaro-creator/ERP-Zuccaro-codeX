/**
 * Payload Cliente MASTER para o BFF HTTP.
 * O formulário legado envia contatos/crédito/vendedor; a API master-data
 * rejeita esses campos (strict + OPERATIONAL_FIELD_FORBIDDEN).
 */

const CLIENTE_ORIGENS = new Set([
  'ERP', 'MIGRACAO', 'SITE_CPA', 'B2B', 'PORTAL', 'CHATBOT', 'WHATSAPP',
  'MARKETPLACE', 'APP', 'API',
]);

const CLIENTE_TIPOS = new Set(['Pessoa Física', 'Pessoa Jurídica']);

const ALLOWED_KEYS = [
  'empresa_id',
  'ativo',
  'tipo',
  'documento',
  'cpf_cnpj',
  'nome',
  'razao_social',
  'nome_fantasia',
  'nome_social',
  'inscricao_estadual',
  'inscricao_municipal',
  'email',
  'telefone',
  'celular',
  'status',
  'origem',
  'codigo_legado',
  'legacy_id',
  'source_system',
  'migration_batch',
  'observacoes',
];

function pickDoc(src) {
  const raw = src.documento ?? src.cpf_cnpj ?? src.cnpj ?? src.cpf ?? '';
  const text = String(raw ?? '').trim();
  return text || null;
}

function normalizeTipo(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  if (CLIENTE_TIPOS.has(raw)) return raw;
  const compact = raw.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (compact.includes('juridica')) return 'Pessoa Jurídica';
  if (compact.includes('fisica')) return 'Pessoa Física';
  return undefined;
}

/**
 * @param {Record<string, unknown>|null|undefined} raw
 * @returns {Record<string, unknown>}
 */
export function toClienteMasterHttpPayload(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of ALLOWED_KEYS) {
    if (src[key] !== undefined) out[key] = src[key];
  }

  const doc = pickDoc(src);
  if (doc) {
    out.documento = doc;
    delete out.cpf_cnpj;
  } else {
    delete out.documento;
    delete out.cpf_cnpj;
  }

  const tipo = normalizeTipo(out.tipo ?? src.tipo);
  if (tipo) out.tipo = tipo;
  else delete out.tipo;

  if (out.origem != null && !CLIENTE_ORIGENS.has(String(out.origem))) {
    delete out.origem;
  }

  if (typeof out.email === 'string' && out.email.trim() === '') {
    out.email = null;
  }

  // status legado "Prospect" etc. é aceito (max 40); não forçar enum.
  return out;
}
