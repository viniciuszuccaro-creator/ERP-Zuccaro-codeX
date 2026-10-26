/**
 * Payload Cliente MASTER para o BFF HTTP.
 * O formulário legado envia contatos/crédito/vendedor; a API master-data
 * rejeita `contatos[]` (schema .strict). Canal canônico já existente:
 * email / telefone / celular — projetamos a partir do array da UI.
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
  const digits = text.replace(/\D/g, '');
  // Placeholder/máscara vazia do form não pode ir no PATCH (senão identity check 400).
  if (!digits || /^0+$/.test(digits)) return null;
  return text;
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

function normalizeContatoTipo(tipo) {
  const compact = String(tipo ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase();
  if (!compact) return '';
  if (compact.includes('mail') || compact === 'e-mail' || compact === 'email') return 'email';
  if (compact.includes('whats')) return 'celular';
  if (compact.includes('celul') || compact.includes('mobile')) return 'celular';
  if (compact.includes('telef') || compact.includes('fone') || compact === 'tel') return 'telefone';
  return '';
}

/**
 * Escolhe o valor principal (ou o primeiro) de um canal tipado do array contatos[].
 * @param {unknown} contatos
 * @param {'email'|'telefone'|'celular'} channel
 * @returns {string|null|undefined} undefined = canal ausente no array; null = limpar
 */
function pickContatoChannel(contatos, channel) {
  if (!Array.isArray(contatos)) return undefined;
  const matched = contatos
    .filter((c) => c && typeof c === 'object' && normalizeContatoTipo(c.tipo) === channel)
    .map((c) => ({
      valor: String(c.valor ?? '').trim(),
      principal: Boolean(c.principal),
    }))
    .filter((c) => c.valor.length > 0);
  if (matched.length === 0) {
    // Array presente e sem itens deste canal → limpar escalar (remover contato).
    return null;
  }
  const principal = matched.find((c) => c.principal);
  return (principal || matched[0]).valor;
}

/**
 * Projeta contatos[] da UI nos escalares do contrato MASTER (email/telefone/celular).
 * Não envia `contatos` no wire — BFF .strict rejeita.
 * Escalares explícitos no payload têm precedência sobre a projeção.
 *
 * @param {Record<string, unknown>} src
 * @param {Record<string, unknown>} out
 */
export function applyContatosProjection(src, out) {
  if (!Object.prototype.hasOwnProperty.call(src, 'contatos')) return;
  const contatos = src.contatos;
  if (contatos == null) return;
  if (!Array.isArray(contatos)) return;

  const email = pickContatoChannel(contatos, 'email');
  const telefone = pickContatoChannel(contatos, 'telefone');
  const celular = pickContatoChannel(contatos, 'celular');

  // Escalares não-vazios explícitos vencem; vazio/null/undefined cede à projeção.
  const blank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  if (email !== undefined && blank(out.email)) out.email = email;
  if (telefone !== undefined && blank(out.telefone)) out.telefone = telefone;
  if (celular !== undefined && blank(out.celular)) out.celular = celular;
}

/**
 * Reconstrói contatos[] mínimos a partir dos escalares persistidos (reabertura UI).
 * @param {Record<string, unknown>|null|undefined} row
 * @returns {Array<{ nome: string, tipo: string, valor: string, principal: boolean }>}
 */
export function hydrateContatosFromScalars(row) {
  const src = row && typeof row === 'object' && !Array.isArray(row) ? row : {};
  /** @type {Array<{ nome: string, tipo: string, valor: string, principal: boolean }>} */
  const out = [];
  const email = typeof src.email === 'string' ? src.email.trim() : '';
  const telefone = typeof src.telefone === 'string' ? src.telefone.trim() : '';
  const celular = typeof src.celular === 'string' ? src.celular.trim() : '';
  if (email) out.push({ nome: '', tipo: 'E-mail', valor: email, principal: out.length === 0 });
  if (telefone) out.push({ nome: '', tipo: 'Telefone', valor: telefone, principal: out.length === 0 });
  if (celular) out.push({ nome: '', tipo: 'WhatsApp', valor: celular, principal: out.length === 0 });
  if (out.length > 0) out[0].principal = true;
  return out;
}

/**
 * Anexa contatos hidratados se a linha ainda não trouxer array (resposta BFF).
 * @param {unknown} row
 * @returns {unknown}
 */
export function withHydratedContatos(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
  /** @type {Record<string, unknown>} */
  const record = /** @type {Record<string, unknown>} */ (row);
  if (Array.isArray(record.contatos)) return record;
  const contatos = hydrateContatosFromScalars(record);
  // Sem escalares: não injeta contatos:[] (listagens/count preservam shape do BFF).
  if (contatos.length === 0) return record;
  return { ...record, contatos };
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

  applyContatosProjection(src, out);

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
  // `contatos` nunca sai no wire — contrato MASTER = escalares.
  return out;
}
