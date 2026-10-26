/**
 * Payload Cliente MASTER para o BFF HTTP.
 * Contrato canônico HTTP/PG: email / telefone / celular (escalares).
 * `contatos[]` (Base44/UI) NÃO cabe 1:1 nesse contrato — nome, observação,
 * ordem, ids e múltiplos do mesmo tipo seriam perdidos se projetássemos
 * em silêncio. Este módulo:
 *  - avalia fidelidade antes de projetar;
 *  - recusa projeção lossy (CONTATOS_SCALAR_OVERFLOW);
 *  - NÃO hidrata `contatos` a partir de escalares como se fosse a lista completa.
 * Evolução mínima proposta (gate separado): coluna jsonb `contatos` em clientes
 * ou tabela filha — ver docs/evidence/contatos-fidelidade-353-*.txt.
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

/** Código estável: array UI não cabe nos escalares MASTER sem perda. */
export const CONTATOS_SCALAR_OVERFLOW = 'CONTATOS_SCALAR_OVERFLOW';

function pickDoc(src) {
  const raw = src.documento ?? src.cpf_cnpj ?? src.cnpj ?? src.cpf ?? '';
  const text = String(raw ?? '').trim();
  const digits = text.replace(/\D/g, '');
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
 * Avalia se contatos[] cabe sem perda no contrato escalar (1 valor/canal).
 * Perdas: múltiplos no mesmo canal; nome/observação/id/ordem; tipo não mapeável;
 * divergência com escalares explícitos no mesmo payload.
 *
 * @param {unknown} contatos
 * @param {Record<string, unknown>} [scalars]
 * @returns {{ ok: boolean, losses: string[], channels: { email: string|null|undefined, telefone: string|null|undefined, celular: string|null|undefined } }}
 */
export function assessContatosScalarFidelity(contatos, scalars = {}) {
  /** @type {string[]} */
  const losses = [];
  /** @type {{ email: string|null|undefined, telefone: string|null|undefined, celular: string|null|undefined }} */
  const channels = { email: undefined, telefone: undefined, celular: undefined };

  if (contatos == null) return { ok: true, losses, channels };
  if (!Array.isArray(contatos)) {
    losses.push('contatos_nao_array');
    return { ok: false, losses, channels };
  }

  /** @type {Record<string, string[]>} */
  const byChannel = { email: [], telefone: [], celular: [] };
  contatos.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') {
      losses.push(`item_invalido:${index}`);
      return;
    }
    const c = /** @type {Record<string, unknown>} */ (raw);
    const channel = normalizeContatoTipo(c.tipo);
    const valor = String(c.valor ?? '').trim();
    if (!channel) {
      if (valor) losses.push(`tipo_nao_mapeavel:${index}`);
      return;
    }
    if (!valor) return;
    byChannel[channel].push(valor);
    if (String(c.nome ?? '').trim()) losses.push(`nome_perdido:${index}`);
    if (String(c.observacao ?? c.obs ?? '').trim()) losses.push(`observacao_perdida:${index}`);
    if (c.id != null && String(c.id).trim() !== '') losses.push(`id_perdido:${index}`);
    if (c.ordem != null && String(c.ordem).trim() !== '') losses.push(`ordem_perdida:${index}`);
  });

  for (const key of /** @type {const} */ (['email', 'telefone', 'celular'])) {
    const values = byChannel[key];
    if (values.length > 1) losses.push(`multiplo_${key}`);
    channels[key] = values.length === 0 ? null : values[0];
  }

  const blank = (v) => v === undefined || v === null || (typeof v === 'string' && String(v).trim() === '');
  for (const key of /** @type {const} */ (['email', 'telefone', 'celular'])) {
    const explicit = scalars[key];
    if (blank(explicit)) continue;
    const projected = channels[key];
    if (projected == null) {
      losses.push(`divergencia_${key}_array_vazio`);
      continue;
    }
    if (String(explicit).trim() !== String(projected).trim()) {
      losses.push(`divergencia_${key}`);
    }
  }

  return { ok: losses.length === 0, losses, channels };
}

/**
 * @param {string[]} losses
 * @returns {Error & { code: string, losses: string[], status: number }}
 */
export function createContatosScalarOverflowError(losses) {
  const error = /** @type {Error & { code: string, losses: string[], status: number }} */ (
    new Error('Contatos da UI não cabem no contrato HTTP escalar sem perda de informação.')
  );
  error.name = 'ContatosScalarOverflowError';
  error.code = CONTATOS_SCALAR_OVERFLOW;
  error.status = 422;
  error.losses = Array.isArray(losses) ? losses.slice() : [];
  return error;
}

/**
 * Projeta contatos[] → escalares SOMENTE quando a avaliação de fidelidade ok.
 * Caso contrário lança CONTATOS_SCALAR_OVERFLOW (não descarta em silêncio).
 *
 * @param {Record<string, unknown>} src
 * @param {Record<string, unknown>} out
 */
export function applyContatosProjection(src, out) {
  if (!Object.prototype.hasOwnProperty.call(src, 'contatos')) return;
  const contatos = src.contatos;
  if (contatos == null) return;

  const assessment = assessContatosScalarFidelity(contatos, {
    email: out.email,
    telefone: out.telefone,
    celular: out.celular,
  });
  if (!assessment.ok) {
    throw createContatosScalarOverflowError(assessment.losses);
  }

  const blank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  if (assessment.channels.email !== undefined && blank(out.email)) out.email = assessment.channels.email;
  if (assessment.channels.telefone !== undefined && blank(out.telefone)) out.telefone = assessment.channels.telefone;
  if (assessment.channels.celular !== undefined && blank(out.celular)) out.celular = assessment.channels.celular;
}

/**
 * Resumo explícito a partir de escalares — NÃO é a lista canônica de contatos.
 * @param {Record<string, unknown>|null|undefined} row
 */
export function scalarContactSummary(row) {
  const src = row && typeof row === 'object' && !Array.isArray(row) ? row : {};
  /** @type {Array<{ canal: string, tipo: string, valor: string }>} */
  const items = [];
  const email = typeof src.email === 'string' ? src.email.trim() : '';
  const telefone = typeof src.telefone === 'string' ? src.telefone.trim() : '';
  const celular = typeof src.celular === 'string' ? src.celular.trim() : '';
  if (email) items.push({ canal: 'email', tipo: 'E-mail', valor: email });
  if (telefone) items.push({ canal: 'telefone', tipo: 'Telefone', valor: telefone });
  if (celular) items.push({ canal: 'celular', tipo: 'WhatsApp', valor: celular });
  return {
    source: /** @type {const} */ ('scalars'),
    complete: false,
    items,
  };
}

/**
 * @deprecated Não usar para reabrir lista UI — resumo ≠ contatos[].
 * Mantido só para testes de regressão que comprovam a proibição.
 */
export function hydrateContatosFromScalars(row) {
  return scalarContactSummary(row).items.map((item, index) => ({
    nome: '',
    tipo: item.tipo,
    valor: item.valor,
    principal: index === 0,
  }));
}

/**
 * NÃO injeta `contatos` fabricados a partir de escalares.
 * Se a linha já trouxer `contatos` do transporte (Base44), preserva.
 * Anexa apenas `contatos_escalares` (resumo explícito incompleto).
 *
 * @param {unknown} row
 * @returns {unknown}
 */
export function withHydratedContatos(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
  /** @type {Record<string, unknown>} */
  const record = /** @type {Record<string, unknown>} */ (row);
  const summary = scalarContactSummary(record);
  if (summary.items.length === 0) {
    if (record.contatos_escalares === undefined) return record;
    const { contatos_escalares: _drop, ...rest } = record;
    return rest;
  }
  return { ...record, contatos_escalares: summary };
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

  return out;
}
