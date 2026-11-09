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

/**
 * Código estável: campos ricos da UI (locais/documentos) ainda sem contrato HTTP MASTER.
 * Falha fechada — não descartar em silêncio nem inventar storage paralelo.
 */
export const CLIENTE_HTTP_UNSUPPORTED_FIELDS = 'CLIENTE_HTTP_UNSUPPORTED_FIELDS';

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
 * preferência `principal` entre canais (contrato UI GerenciarContatos*);
 * metadata com valor vazio; divergência com escalares explícitos no mesmo payload.
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
  let valuedCount = 0;
  let principalTrueCount = 0;

  contatos.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') {
      losses.push(`item_invalido:${index}`);
      return;
    }
    const c = /** @type {Record<string, unknown>} */ (raw);
    const channel = normalizeContatoTipo(c.tipo);
    const valor = String(c.valor ?? '').trim();
    const nome = String(c.nome ?? '').trim();
    const observacao = String(c.observacao ?? c.obs ?? '').trim();
    const hasId = c.id != null && String(c.id).trim() !== '';
    const hasOrdem = c.ordem != null && String(c.ordem).trim() !== '';
    const hasMeta = Boolean(nome || observacao || hasId || hasOrdem);
    const isPrincipal = c.principal === true;

    if (isPrincipal) principalTrueCount += 1;

    // Metadata / principal com valor vazio: validar ANTES do early-return (Codex P2).
    // Rascunho vazio sem metadata e sem principal: tratamento vigente (ignorar).
    if (!valor) {
      if (hasMeta) losses.push(`metadata_sem_valor:${index}`);
      if (isPrincipal) losses.push(`principal_sem_valor:${index}`);
      return;
    }

    if (!channel) {
      losses.push(`tipo_nao_mapeavel:${index}`);
      return;
    }

    valuedCount += 1;
    byChannel[channel].push(valor);
    if (nome) losses.push(`nome_perdido:${index}`);
    if (observacao) losses.push(`observacao_perdida:${index}`);
    if (hasId) losses.push(`id_perdido:${index}`);
    if (hasOrdem) losses.push(`ordem_perdida:${index}`);
  });

  // Preferência principal entre ≥2 valores: escalares não têm campo principal (Codex P1).
  // Ex.: E-mail(principal=false)+Telefone(principal=true) — não redefinir por conveniência.
  if (valuedCount > 1 && principalTrueCount > 0) {
    losses.push('principal_nao_representavel');
  }

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
  const list = Array.isArray(losses) ? losses.slice() : [];
  const hints = [];
  if (list.includes('principal_nao_representavel')) {
    hints.push('preferência de contato principal entre canais');
  }
  if (list.some((l) => String(l).startsWith('metadata_sem_valor'))) {
    hints.push('nome/observação/id/ordem sem valor');
  }
  if (list.some((l) => String(l).startsWith('multiplo_'))) {
    hints.push('mais de um valor no mesmo canal');
  }
  const detail = hints.length ? ` (${hints.join('; ')})` : '';
  const error = /** @type {Error & { code: string, losses: string[], status: number }} */ (
    new Error(
      `Contatos da UI não cabem no contrato HTTP escalar sem perda de informação${detail}. `
      + 'Ajuste a lista ou aguarde o contrato canônico (jsonb/tabela filha); o rascunho não foi enviado.',
    )
  );
  error.name = 'ContatosScalarOverflowError';
  error.code = CONTATOS_SCALAR_OVERFLOW;
  error.status = 422;
  error.losses = list;
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
  // Celular escalar ≠ WhatsApp: WhatsApp só quando o tipo canônico for escolhido.
  if (celular) items.push({ canal: 'celular', tipo: 'Celular', valor: celular });
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
 * Adaptação de leitura HTTP → UI Cadastros/Completo.
 * MASTER usa `documento` unificado; a grade/form esperam `cpf`/`cnpj` (string, zeros).
 * Não inventa contatos[] nem endereços — só espelha documento quando cpf/cnpj ausentes.
 *
 * @param {unknown} row
 * @returns {unknown}
 */
export function hydrateClienteHttpRowForUi(row) {
  const withContacts = withHydratedContatos(row);
  if (!withContacts || typeof withContacts !== 'object' || Array.isArray(withContacts)) {
    return withContacts;
  }
  /** @type {Record<string, unknown>} */
  const record = { .../** @type {Record<string, unknown>} */ (withContacts) };
  const blank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  const docRaw = record.documento ?? record.cpf_cnpj ?? '';
  const doc = String(docRaw ?? '').trim();
  const digits = doc.replace(/\D/g, '');
  if (digits && !/^0+$/.test(digits)) {
    if (blank(record.cpf) && digits.length === 11) record.cpf = doc;
    if (blank(record.cnpj) && digits.length === 14) record.cnpj = doc;
  }
  // PF/PJ: não inventa nome; só preenche tipo ausente a partir do documento canônico.
  if (blank(record.tipo) && digits && !/^0+$/.test(digits)) {
    if (digits.length === 11) record.tipo = 'Pessoa Física';
    else if (digits.length === 14) record.tipo = 'Pessoa Jurídica';
  } else if (!blank(record.tipo)) {
    const normalized = normalizeTipo(record.tipo);
    if (normalized) record.tipo = normalized;
  }
  return record;
}

/**
 * Projeta linha canônica `cliente_locais` → shape do GerenciarEnderecosClienteForm.
 * ENTREGA/COBRANÇA preservados; demais finalidades viram rótulo sem presumir entrega=cadastral.
 * @param {Record<string, unknown>} local
 * @returns {Record<string, unknown>}
 */
export function mapClienteLocalToUiEndereco(local) {
  const row = local && typeof local === 'object' ? local : {};
  const fins = Array.isArray(row.finalidades) ? row.finalidades : [];
  const codes = fins
    .map((f) => String(/** @type {{ finalidade?: unknown }} */ (f)?.finalidade || '').toUpperCase())
    .filter(Boolean);
  let tipo_endereco = 'Entrega';
  if (codes.includes('COBRANCA')) tipo_endereco = 'Cobrança';
  else if (codes.includes('ENTREGA')) tipo_endereco = 'Entrega';
  else if (codes.includes('CADASTRAL') || codes.includes('FISCAL')) tipo_endereco = 'Entrega';
  return {
    id: row.id,
    apelido: row.nome || '',
    tipo_endereco,
    cep: row.cep || '',
    logradouro: row.logradouro || '',
    numero: row.numero || '',
    complemento: row.complemento || '',
    bairro: row.bairro || '',
    cidade: row.cidade || '',
    estado: row.uf || row.estado || '',
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    observacoes: row.referencia || '',
    principal: fins.some((f) => /** @type {{ principal?: unknown }} */ (f)?.principal === true),
    _fonte: 'cliente_locais',
    _finalidades: codes,
  };
}

/**
 * Parecer 6746649125 — valor significativo em campo rico fora do MASTER
 * não pode ser descartado em silêncio por ALLOWED_KEYS.
 * @param {unknown} value
 */
function isMeaningfulScalar(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
  if (typeof value === 'boolean') return true;
  return false;
}

/**
 * @param {unknown} endereco
 */
export function isMeaningfulEndereco(endereco) {
  if (!endereco || typeof endereco !== 'object' || Array.isArray(endereco)) return false;
  const row = /** @type {Record<string, unknown>} */ (endereco);
  return ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'estado', 'uf', 'complemento']
    .some((key) => isMeaningfulScalar(row[key]));
}

/**
 * @param {unknown} condicao
 */
function isMeaningfulCondicaoComercial(condicao) {
  if (!condicao || typeof condicao !== 'object' || Array.isArray(condicao)) return false;
  const row = /** @type {Record<string, unknown>} */ (condicao);
  if (isMeaningfulScalar(row.tabela_preco_id) || isMeaningfulScalar(row.forma_pagamento_padrao_id)) {
    return true;
  }
  const desconto = Number(row.percentual_desconto);
  const limite = Number(row.limite_credito);
  const usado = Number(row.limite_credito_utilizado);
  if (Number.isFinite(desconto) && desconto !== 0) return true;
  if (Number.isFinite(limite) && limite !== 0) return true;
  if (Number.isFinite(usado) && usado !== 0) return true;
  const pag = String(row.condicao_pagamento ?? '').trim();
  if (pag && pag !== 'À Vista' && pag !== 'A Vista') return true;
  return false;
}

/**
 * Rich fields present with values would be silently dropped by ALLOWED_KEYS.
 * Empty/undefined/default = nothing to lose (omit). Non-empty = fail closed.
 * @param {Record<string, unknown>} src
 */
export function assertClienteHttpRichFieldsWritable(src) {
  /** @type {string[]} */
  const unsupported = [];
  if (Array.isArray(src.locais_entrega) && src.locais_entrega.length > 0) {
    unsupported.push('locais_entrega');
  }
  if (Array.isArray(src.documentos) && src.documentos.length > 0) {
    unsupported.push('documentos');
  }
  if (isMeaningfulEndereco(src.endereco_principal)) {
    unsupported.push('endereco_principal');
  }
  if (isMeaningfulCondicaoComercial(src.condicao_comercial)) {
    unsupported.push('condicao_comercial');
  }
  // configuracao_fiscal: só bloqueia se observações fiscais ou IDs extras significativos
  // além dos defaults do formulário — defaults puros não contam como perda.
  if (src.configuracao_fiscal && typeof src.configuracao_fiscal === 'object') {
    const fiscal = /** @type {Record<string, unknown>} */ (src.configuracao_fiscal);
    if (isMeaningfulScalar(fiscal.observacoes_fiscais)) {
      unsupported.push('configuracao_fiscal');
    }
  }
  for (const key of [
    'vendedor_responsavel_id',
    'vendedor_responsavel',
    'indicador_id',
    'regiao_atendimento_id',
    'regiao_atendimento',
    'rg',
  ]) {
    if (isMeaningfulScalar(src[key])) unsupported.push(key);
  }
  if (unsupported.length === 0) return;
  const unique = [...new Set(unsupported)];
  const error = /** @type {Error & { code: string, status: number, fields: string[] }} */ (
    new Error(
      `Contrato HTTP Cliente ainda não persiste: ${unique.join(', ')}. `
        + 'Valores originais preservados no rascunho — sem descarte silencioso. '
        + 'Coordene BFF (cliente_locais / documentos / vínculos) — sem storage paralelo.',
    )
  );
  error.name = 'ClienteHttpUnsupportedFieldsError';
  error.code = CLIENTE_HTTP_UNSUPPORTED_FIELDS;
  error.status = 422;
  error.fields = unique;
  throw error;
}

/**
 * @param {Record<string, unknown>|null|undefined} raw
 * @returns {Record<string, unknown>}
 */
export function toClienteMasterHttpPayload(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  assertClienteHttpRichFieldsWritable(src);
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

  const tipoRaw = out.tipo ?? src.tipo;
  if (tipoRaw != null && String(tipoRaw).trim() !== '') {
    const tipo = normalizeTipo(tipoRaw);
    if (!tipo) {
      const error = /** @type {Error & { code: string, status: number, fields: string[] }} */ (
        new Error(
          'Tipo de pessoa inválido no payload HTTP Cliente. '
            + 'Valor original preservado no rascunho — sem descarte silencioso.',
        )
      );
      error.name = 'ClienteHttpUnsupportedFieldsError';
      error.code = CLIENTE_HTTP_UNSUPPORTED_FIELDS;
      error.status = 422;
      error.fields = ['tipo'];
      throw error;
    }
    out.tipo = tipo;
  } else {
    delete out.tipo;
  }

  if (out.origem != null && String(out.origem).trim() !== '') {
    if (!CLIENTE_ORIGENS.has(String(out.origem))) {
      const error = /** @type {Error & { code: string, status: number, fields: string[] }} */ (
        new Error(
          'Origem inválida no payload HTTP Cliente. '
            + 'Valor original preservado no rascunho — sem descarte silencioso.',
        )
      );
      error.name = 'ClienteHttpUnsupportedFieldsError';
      error.code = CLIENTE_HTTP_UNSUPPORTED_FIELDS;
      error.status = 422;
      error.fields = ['origem'];
      throw error;
    }
  }

  if (typeof out.email === 'string' && out.email.trim() === '') {
    out.email = null;
  }

  return out;
}
