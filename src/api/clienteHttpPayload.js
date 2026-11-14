/**
 * Payload Cliente MASTER para o BFF HTTP.
 * Contrato canônico (decisão a — pack Contatos): `contatos[]` jsonb no MASTER
 * + escalares email/telefone/celular espelhados best-effort.
 *  - omitir chave `contatos` ≠ limpar (campo não carregado não apaga);
 *  - `contatos: []` = limpeza explícita;
 *  - WhatsApp ≠ Celular (nunca projetar WhatsApp → celular);
 *  - canal inválido fica em quarentena (não conta como contato válido na UI);
 *  - NÃO hidrata `contatos[]` a partir de escalares como lista completa;
 *  - Sem ContatoClienteV2 / storage paralelo; ContatoB2B FK não destrava este fluxo.
 * assessContatosScalarFidelity permanece diagnóstico (legado / auditoria).
 */

const CLIENTE_ORIGENS = new Set([
  'ERP', 'MIGRACAO', 'SITE_CPA', 'B2B', 'PORTAL', 'CHATBOT', 'WHATSAPP',
  'MARKETPLACE', 'APP', 'API',
]);

const CLIENTE_TIPOS = new Set(['Pessoa Física', 'Pessoa Jurídica']);
export const CLIENTE_MASTER_EXTRA_KEYS = Object.freeze([
  'rg', 'numero_caixa_postal', 'cep_caixa_postal', 'caixa_postal_cobranca', 'inscricao_produtor_rural',
]);

const ALLOWED_KEYS = [
  ...CLIENTE_MASTER_EXTRA_KEYS,
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
  'contatos',
  'expectedVersion',
  'status',
  'origem',
  'codigo_legado',
  'legacy_id',
  'source_system',
  'migration_batch',
  'observacoes',
];

/** Canais canônicos do formulário Completo / GerenciarContatos (sem inventar WhatsApp). */
export const CONTATO_CANAIS_CANONICOS = Object.freeze(['Telefone', 'Celular', 'WhatsApp', 'E-mail']);

/** Limite canônico de itens em contatos[] — contrato Codex 29726d3d (rejeitar, não truncar). */
export const CONTATOS_MAX_ITEMS = 200;
export const CONTATO_OBS_MAX = 2000;
export const CONTATO_NOME_MAX = 180;
export const CONTATO_VALOR_MAX = 180;
export const CONTATO_CARGO_MAX = 120;
export const CONTATO_DEPTO_MAX = 120;
export const CONTATO_RAMAL_MAX = 40;

/** Código estável (legado): array UI não cabia nos escalares MASTER sem perda. */
export const CONTATOS_SCALAR_OVERFLOW = 'CONTATOS_SCALAR_OVERFLOW';

/**
 * @param {unknown} tipo
 * @returns {boolean}
 */
export function isContatoCanalCanonico(tipo) {
  return CONTATO_CANAIS_CANONICOS.includes(String(tipo ?? '').trim());
}

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

/**
 * Normaliza tipo de contato para canal de projeção escalar.
 * WhatsApp é canal próprio — NUNCA mapeia para celular (Celular ≠ WhatsApp).
 * @param {unknown} tipo
 * @returns {''|'email'|'telefone'|'celular'|'whatsapp'}
 */
function normalizeContatoTipo(tipo) {
  const compact = String(tipo ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase();
  if (!compact) return '';
  if (compact.includes('mail') || compact === 'e-mail' || compact === 'email') return 'email';
  if (compact.includes('whats')) return 'whatsapp';
  if (compact.includes('celul') || compact.includes('mobile')) return 'celular';
  if (compact.includes('telef') || compact.includes('fone') || compact === 'tel') return 'telefone';
  return '';
}

/**
 * @param {unknown} value
 * @param {number} max
 * @param {string} field
 */
function sanitizeContatoTextStrict(value, max, field) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length > max) {
    const error = /** @type {Error & { code: string, status: number, field: string }} */ (
      new Error(
        `Contato.${field} excede ${max} caracteres — rejeitado sem truncamento silencioso.`,
      )
    );
    error.name = 'ContatosValidationError';
    error.code = 'CLIENTE_CONTATOS_VALIDATION';
    error.status = 422;
    error.field = field;
    throw error;
  }
  return text;
}

/**
 * Sanitiza contatos[] para o fio HTTP/jsonb — preserva procedência/flags/null;
 * rejeita acima do limite (200 / obs 2000); não inventa WhatsApp a partir de celular.
 * Canais inválidos permanecem no array (quarentena) para não apagar na omissão.
 *
 * @param {unknown} contatos
 * @returns {Record<string, unknown>[]}
 */
export function sanitizeContatosForHttp(contatos) {
  if (!Array.isArray(contatos)) {
    const error = /** @type {Error & { code: string, losses: string[], status: number }} */ (
      createContatosScalarOverflowError(['contatos_nao_array'])
    );
    throw error;
  }
  if (contatos.length > CONTATOS_MAX_ITEMS) {
    const error = /** @type {Error & { code: string, status: number }} */ (
      new Error(
        `Contatos[] excede ${CONTATOS_MAX_ITEMS} itens — rejeitado sem truncamento silencioso.`,
      )
    );
    error.name = 'ContatosValidationError';
    error.code = 'CLIENTE_CONTATOS_VALIDATION';
    error.status = 422;
    throw error;
  }
  const ids = new Set();
  let principals = 0;
  return contatos.map((raw) => {
    const base = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? { .../** @type {Record<string, unknown>} */ (raw) }
      : {};
    const tipo = sanitizeContatoTextStrict(base.tipo, 60, 'tipo') || '';
    const valor = sanitizeContatoTextStrict(base.valor, CONTATO_VALOR_MAX, 'valor');
    const nome = sanitizeContatoTextStrict(base.nome, CONTATO_NOME_MAX, 'nome');
    const cargo = sanitizeContatoTextStrict(base.cargo, CONTATO_CARGO_MAX, 'cargo');
    const departamento = sanitizeContatoTextStrict(base.departamento, CONTATO_DEPTO_MAX, 'departamento');
    const ramal = sanitizeContatoTextStrict(base.ramal, CONTATO_RAMAL_MAX, 'ramal');
    const observacao = sanitizeContatoTextStrict(
      base.observacao !== undefined ? base.observacao : base.obs,
      CONTATO_OBS_MAX,
      'observacao',
    );
    /** @type {Record<string, unknown>} */
    const out = { ...base, tipo };
    if (valor !== undefined) out.valor = valor;
    if (nome !== undefined) out.nome = nome;
    if (cargo !== undefined) out.cargo = cargo;
    if (departamento !== undefined) out.departamento = departamento;
    if (ramal !== undefined) out.ramal = ramal;
    if (observacao !== undefined) {
      out.observacao = observacao;
      if ('obs' in out && out.obs !== observacao) delete out.obs;
    }
    // principal/ativo ausentes permanecem ausentes (não fabricar false).
    if (base.principal !== undefined) out.principal = base.principal === true;
    if (base.ativo !== undefined) out.ativo = base.ativo === true;
    if (base.id != null && String(base.id).trim() !== '') {
      const id = String(base.id);
      if (ids.has(id)) {
        const error = /** @type {Error & { code: string, status: number }} */ (
          new Error('Contatos[] com id duplicado — rejeitado.')
        );
        error.name = 'ContatosValidationError';
        error.code = 'CLIENTE_CONTATOS_VALIDATION';
        error.status = 422;
        throw error;
      }
      ids.add(id);
      out.id = id;
    }
    if (out.principal === true) principals += 1;
    if (principals > 1) {
      const error = /** @type {Error & { code: string, status: number }} */ (
        new Error('Contatos[] com múltiplos principais — rejeitado.')
      );
      error.name = 'ContatosValidationError';
      error.code = 'CLIENTE_CONTATOS_VALIDATION';
      error.status = 422;
      throw error;
    }
    if (base.contato_b2b_id != null && String(base.contato_b2b_id).trim() !== '') {
      const error = /** @type {Error & { code: string, status: number }} */ (
        new Error('contato_b2b_id sem resolução canônica comprovada — rejeitado.')
      );
      error.name = 'ContatosValidationError';
      error.code = 'CLIENTE_CONTATO_B2B_REVIEW_REQUIRED';
      error.status = 409;
      throw error;
    }
    return out;
  });
}

/**
 * Separa contatos válidos (canais canônicos) dos em quarentena (tipo inválido).
 * @param {unknown} contatos
 * @returns {{ validos: Record<string, unknown>[], quarentena: Record<string, unknown>[] }}
 */
export function partitionContatosByCanal(contatos) {
  /** @type {Record<string, unknown>[]} */
  const validos = [];
  /** @type {Record<string, unknown>[]} */
  const quarentena = [];
  if (!Array.isArray(contatos)) return { validos, quarentena };
  for (const raw of contatos) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      quarentena.push(/** @type {Record<string, unknown>} */ ({ tipo: '', valor: '', _invalid: true }));
      continue;
    }
    const row = /** @type {Record<string, unknown>} */ (raw);
    if (isContatoCanalCanonico(row.tipo)) validos.push(row);
    else quarentena.push(row);
  }
  return { validos, quarentena };
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

    // WhatsApp é canal próprio (≠ celular): não cabe nos escalares MASTER.
    if (channel === 'whatsapp') {
      losses.push(`whatsapp_nao_escalar:${index}`);
      if (nome) losses.push(`nome_perdido:${index}`);
      if (observacao) losses.push(`observacao_perdida:${index}`);
      if (hasId) losses.push(`id_perdido:${index}`);
      if (hasOrdem) losses.push(`ordem_perdida:${index}`);
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
 * Grava `contatos[]` canônico no payload HTTP e espelha escalares best-effort.
 * Omitir a chave = não tocar; `null` = desconhecido (omitir, não comando público);
 * `[]` = limpar; WhatsApp nunca preenche celular.
 * CAS (`expectedVersion`) só na substituição (update). Criação pode enviar contatos
 * sem inventar versão.
 * Não lança CONTATOS_SCALAR_OVERFLOW no caminho jsonb (decisão a).
 *
 * @param {Record<string, unknown>} src
 * @param {Record<string, unknown>} out
 * @param {{ mode?: 'create'|'update' }} [options]
 */
export function applyContatosProjection(src, out, options = {}) {
  if (!Object.prototype.hasOwnProperty.call(src, 'contatos')) return;
  const contatos = src.contatos;
  // null/ausência ≠ [] : não enviar NULL ao schema (rejeição); preservar omissão.
  if (contatos == null) {
    delete out.contatos;
    delete out.expectedVersion;
    delete out.contatos_version;
    return;
  }

  const sanitized = sanitizeContatosForHttp(contatos);
  out.contatos = sanitized;

  const mode = options.mode === 'create' ? 'create' : 'update';
  // Criação: contatos iniciais sem CAS; não inventar expectedVersion.
  if (mode === 'create') {
    delete out.expectedVersion;
    delete out.contatos_version;
    return;
  }

  // CAS: contatos_version (leitura) → expectedVersion (escrita). Omissão ≠ limpar.
  const version = src.expectedVersion ?? src.contatos_version;
  if (version == null || String(version).trim() === '') {
    const error = /** @type {Error & { code: string, status: number }} */ (
      new Error(
        'expectedVersion/contatos_version obrigatório ao substituir contatos[] — snapshot completo inalterado.',
      )
    );
    error.name = 'ContatosValidationError';
    error.code = 'CLIENTE_CONTATOS_VERSION_REQUIRED';
    error.status = 422;
    throw error;
  }
  out.expectedVersion = String(version).trim();
  delete out.contatos_version;

  const blank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  /** @type {Record<'email'|'telefone'|'celular', string[]>} */
  const byChannel = { email: [], telefone: [], celular: [] };
  for (const raw of sanitized) {
    const channel = normalizeContatoTipo(raw.tipo);
    if (channel !== 'email' && channel !== 'telefone' && channel !== 'celular') continue;
    const valor = String(raw.valor ?? '').trim();
    if (!valor) continue;
    byChannel[channel].push(valor);
  }
  for (const key of /** @type {const} */ (['email', 'telefone', 'celular'])) {
    if (!blank(out[key])) continue;
    out[key] = byChannel[key].length > 0 ? byChannel[key][0] : null;
  }
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
  // Cadastral/Fiscal ≠ Entrega — não reescrever finalidade cadastral como entrega.
  let tipo_endereco = '';
  if (codes.includes('COBRANCA')) tipo_endereco = 'Cobrança';
  else if (codes.includes('ENTREGA')) tipo_endereco = 'Entrega';
  else if (codes.includes('CADASTRAL')) tipo_endereco = 'Cadastral';
  else if (codes.includes('FISCAL')) tipo_endereco = 'Fiscal';
  else if (codes.includes('CORRESPONDENCIA')) tipo_endereco = 'Correspondência';
  else if (codes.includes('OUTRO')) tipo_endereco = 'Outro';
  else if (codes.length > 0) tipo_endereco = 'Outro';
  const codigoRaw = row.codigo ?? row.codigo_interno ?? null;
  const codigo = codigoRaw != null && String(codigoRaw).trim() !== ''
    ? String(codigoRaw)
    : undefined;
  return {
    id: row.id,
    ...(codigo !== undefined ? { codigo } : {}),
    apelido: row.nome || '',
    tipo_endereco,
    cep: row.cep || '',
    logradouro: row.logradouro || '',
    numero: row.numero || '',
    complemento: row.complemento || '',
    bairro: row.bairro || '',
    cidade: row.cidade || '',
    estado: row.uf || row.estado || '',
    pais: row.pais ?? '',
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    coordinate_source: row.coordinate_source ?? null,
    observacoes: row.referencia || '',
    principal: fins.some((f) => /** @type {{ finalidade?: unknown, principal?: unknown }} */ (f)?.finalidade === mapTipoEnderecoToFinalidade(tipo_endereco)
      && /** @type {{ principal?: unknown }} */ (f)?.principal === true),
    endereco_incompleto: row.endereco_incompleto === true ? true : (row.endereco_incompleto === false ? false : undefined),
    _fonte: 'cliente_locais',
    _finalidades: codes,
    _tipo_endereco_original: tipo_endereco,
    _finalidades_detalhadas: fins.map(f => ({ finalidade: f.finalidade, principal: f.principal === true })),
  };
}

/** Campos do formulário de endereço que o BFF `cliente_locais` ainda não persiste. */
const CLIENTE_LOCAL_UI_EXTRAS = [
  'horario_inicio',
  'horario_fim',
  'contato_nome',
  'contato_telefone',
  'tipo_descarga',
  'janela_entrega_preferencial',
  'mapa_url',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isClienteLocalCanonicalId(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

/**
 * Mapeia tipo_endereco da UI → finalidade canônica (entrega ≠ cadastral).
 * @param {unknown} tipoEndereco
 * @returns {'CADASTRAL'|'FISCAL'|'COBRANCA'|'ENTREGA'|'CORRESPONDENCIA'|'OUTRO'}
 */
export function mapTipoEnderecoToFinalidade(tipoEndereco) {
  const raw = String(tipoEndereco ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (raw === 'cobranca') return 'COBRANCA';
  if (raw === 'cadastral') return 'CADASTRAL';
  if (raw === 'fiscal') return 'FISCAL';
  if (raw === 'correspondencia') return 'CORRESPONDENCIA';
  if (raw === 'outro') return 'OUTRO';
  if (raw === 'entrega' || raw === 'obra') return 'ENTREGA';
  clienteLocalValidation(['tipo_endereco'], 'Finalidade do endereco nao comprovada. Selecione uma finalidade canonica.');
}

/** @param {string[]} fields @param {string} message @returns {never} */
function clienteLocalValidation(fields, message) {
  const error = Object.assign(new Error(message), { name: 'ClienteLocalValidationError', code: 'VALIDATION_ERROR', status: 422, fields });
  throw error;
}

/** Preserve other purposes when the single-purpose editor changes unrelated fields. */
function finalidadesDoEndereco(row) {
  const finalidade = mapTipoEnderecoToFinalidade(row.tipo_endereco);
  if (!Object.hasOwn(row, '_finalidades_detalhadas')) {
    if (Array.isArray(row._finalidades) && row._finalidades.length > 1)
      clienteLocalValidation(['finalidades'], 'Finalidades completas nao carregadas. Reabra o local antes de editar.');
    return [{ finalidade, principal: row.principal === true }];
  }
  const original = row._finalidades_detalhadas;
  const allowed = new Set(['CADASTRAL','FISCAL','COBRANCA','ENTREGA','CORRESPONDENCIA','OUTRO']);
  if (!Array.isArray(original) || !original.length || original.length > 6
      || original.some(f => !f || !allowed.has(f.finalidade) || typeof f.principal !== 'boolean')
      || new Set(original.map(f => f.finalidade)).size !== original.length)
    clienteLocalValidation(['finalidades'], 'Envelope de finalidades invalido. Rascunho preservado.');
  if (row.tipo_endereco !== row._tipo_endereco_original && original.length > 1)
    clienteLocalValidation(['finalidades'], 'Local com varias finalidades: alteracao exige gerenciamento canonico das finalidades.');
  if (original.length === 1 && row.tipo_endereco !== row._tipo_endereco_original)
    return [{ finalidade, principal: row.principal === true }];
  return original.map(f => ({ finalidade: f.finalidade,
    principal: f.finalidade === finalidade && Object.hasOwn(row, 'principal') ? row.principal === true : f.principal }));
}

/**
 * Extras logísticos significativos ainda sem coluna BFF → fail-closed (sem drop).
 * @param {Record<string, unknown>} row
 */
export function assertClienteLocalUiExtrasWritable(row) {
  /** @type {string[]} */
  const unsupported = [];
  for (const key of CLIENTE_LOCAL_UI_EXTRAS) {
    if (isMeaningfulScalar(row[key])) unsupported.push(key);
  }
  if (unsupported.length === 0) return;
  const error = /** @type {Error & { code: string, status: number, fields: string[] }} */ (
    new Error(
      `Contrato HTTP cliente_locais ainda não persiste: ${unsupported.join(', ')}. `
        + 'Valores originais preservados no rascunho — sem descarte silencioso. '
        + 'Coordene extensão BFF — sem storage paralelo.',
    )
  );
  error.name = 'ClienteHttpUnsupportedFieldsError';
  error.code = CLIENTE_HTTP_UNSUPPORTED_FIELDS;
  error.status = 422;
  error.fields = unsupported;
  throw error;
}

/**
 * UI GerenciarEnderecos → body POST `/clientes/:id/locais`.
 * @param {unknown} endereco
 * @returns {Record<string, unknown>}
 */
export function mapUiEnderecoToClienteLocalCreate(endereco) {
  const row = endereco && typeof endereco === 'object' && !Array.isArray(endereco)
    ? /** @type {Record<string, unknown>} */ (endereco)
    : {};
  assertClienteLocalUiExtrasWritable(row);
  const missing = ['numero','bairro','pais'].filter(key => typeof row[key] !== 'string' || !String(row[key]).trim());
  if (missing.length) clienteLocalValidation(missing, `Componentes nao comprovados: ${missing.join(', ')}. Rascunho preservado.`);
  const limits = { apelido: 160, nome: 160, logradouro: 220, numero: 40, bairro: 160, cidade: 160, pais: 80, complemento: 160, observacoes: 500 };
  const oversized = Object.entries(limits).filter(([key, max]) => String(row[key] ?? '').trim().length > max).map(([key]) => key);
  if (oversized.length) clienteLocalValidation(oversized, 'Campo excede o contrato canonico. Nenhum valor foi truncado.');
  if (!isMeaningfulEndereco(row)) {
    const error = /** @type {Error & { code: string, status: number, fields: string[] }} */ (
      new Error(
        'Endereço incompleto para cliente_locais (CEP/logradouro/cidade). '
          + 'Rascunho preservado — sem gravação parcial silenciosa.',
      )
    );
    error.name = 'ClienteLocalValidationError';
    error.code = 'VALIDATION_ERROR';
    error.status = 422;
    error.fields = ['locais_entrega'];
    throw error;
  }
  const cepDigits = String(row.cep ?? '').replace(/\D/g, '');
  if (cepDigits.length !== 8 || cepDigits === '00000000' || !/^[\d.\-\s]+$/.test(String(row.cep ?? ''))) {
    const error = /** @type {Error & { code: string, status: number, fields: string[] }} */ (
      new Error('CEP inválido para cliente_locais (8 dígitos). Rascunho preservado.')
    );
    error.name = 'ClienteLocalValidationError';
    error.code = 'VALIDATION_ERROR';
    error.status = 422;
    error.fields = ['cep'];
    throw error;
  }
  const uf = String(row.uf || row.estado || '').trim().toUpperCase().slice(0, 2);
  if (uf.length !== 2) {
    const error = /** @type {Error & { code: string, status: number, fields: string[] }} */ (
      new Error('UF inválida para cliente_locais. Rascunho preservado.')
    );
    error.name = 'ClienteLocalValidationError';
    error.code = 'VALIDATION_ERROR';
    error.status = 422;
    error.fields = ['uf'];
    throw error;
  }
  const finalidades = finalidadesDoEndereco(row);
  const nome = String(row.apelido || row.nome || row.logradouro || 'Endereço').trim().slice(0, 160)
    || 'Endereço';
  /** @type {Record<string, unknown>} */
  const body = {
    nome,
    cep: cepDigits,
    logradouro: String(row.logradouro ?? '').trim().slice(0, 220),
    numero: String(row.numero).trim().slice(0, 40),
    bairro: String(row.bairro).trim().slice(0, 160),
    cidade: String(row.cidade ?? '').trim().slice(0, 160),
    uf,
    pais: String(row.pais).trim(),
    origem: 'ERP',
    finalidades,
  };
  const complemento = String(row.complemento ?? '').trim();
  if (complemento) body.complemento = complemento.slice(0, 160);
  const referencia = String(row.observacoes ?? row.referencia ?? '').trim();
  if (referencia) body.referencia = referencia.slice(0, 500);
  const lat = row.latitude == null || row.latitude === '' ? null : Number(row.latitude);
  const lng = row.longitude == null || row.longitude === '' ? null : Number(row.longitude);
  if ((lat == null) !== (lng == null) || (lat != null && (!Number.isFinite(lat) || Math.abs(lat) > 90))
      || (lng != null && (!Number.isFinite(lng) || Math.abs(lng) > 180)))
    clienteLocalValidation(['latitude','longitude'], 'Coordenadas devem formar um par valido. Rascunho preservado.');
  if (lat != null && lng != null) {
    if (row._fonte === 'cliente_locais' && !row.coordinate_source)
      clienteLocalValidation(['coordinate_source'], 'Origem das coordenadas nao comprovada. Nao substituir por MANUAL.');
    body.latitude = lat;
    body.longitude = lng;
    body.coordinate_source = row.coordinate_source ?? 'MANUAL';
  } else if (Object.hasOwn(row, 'latitude') && Object.hasOwn(row, 'longitude')) {
    body.latitude = null; body.longitude = null; body.coordinate_source = null;
  }
  return body;
}

/**
 * UI → PATCH body (sem finalidades; use setFinalidades à parte quando necessário).
 * @param {unknown} endereco
 * @returns {Record<string, unknown>}
 */
export function mapUiEnderecoToClienteLocalUpdate(endereco) {
  const created = mapUiEnderecoToClienteLocalCreate(endereco);
  const {
    finalidades: _finalidades,
    origem: _origem,
    ...update
  } = created;
  return update;
}

/** Sync `/locais` interrompido após operações parciais — não declarar gravação integral. */
export const CLIENTE_LOCAIS_SYNC_PARTIAL = 'CLIENTE_LOCAIS_SYNC_PARTIAL';

/**
 * Após PARTIAL: carimba `id`/`codigo` dos creates já persistidos no rascunho (ordem das ops),
 * preservando edições pendentes sem id. Evita retry que recria e soft-deleta o recém-gravado.
 * @param {unknown} draft
 * @param {unknown} persistedMapped listLocais → UI (baseline); null/ausente = carimba só id do summary
 * @param {{ ops?: Array<{ op?: string, localId?: string, nome?: string }> }|null|undefined} summary
 * @returns {unknown} draft reconciliado (mesmo array se nada a carimbar)
 */
export function reconcileClienteLocaisDraftAfterPartial(draft, persistedMapped, summary) {
  if (!Array.isArray(draft) || draft.length === 0) return draft;
  const ops = Array.isArray(summary?.ops) ? summary.ops : [];
  const createdOps = ops.filter((op) => op?.op === 'create' && isClienteLocalCanonicalId(op.localId));
  if (createdOps.length === 0) return draft;
  const byId = new Map();
  if (Array.isArray(persistedMapped)) {
    for (const row of persistedMapped) {
      const id = row && typeof row === 'object'
        ? String(/** @type {{ id?: unknown }} */ (row).id || '').trim()
        : '';
      if (isClienteLocalCanonicalId(id)) byId.set(id, row);
    }
  }
  const next = draft.map((row) => (row && typeof row === 'object' ? { ...row } : row));
  const pendingIdx = [];
  for (let i = 0; i < next.length; i += 1) {
    const row = next[i];
    const id = row && typeof row === 'object'
      ? String(/** @type {{ id?: unknown }} */ (row).id || '').trim()
      : '';
    if (!isClienteLocalCanonicalId(id)) pendingIdx.push(i);
  }
  let pi = 0;
  for (const op of createdOps) {
    if (pi >= pendingIdx.length) break;
    const idx = pendingIdx[pi];
    pi += 1;
    const prev = /** @type {Record<string, unknown>} */ (next[idx] || {});
    const persist = byId.get(String(op.localId));
    if (persist && typeof persist === 'object') {
      next[idx] = {
        ...persist,
        ...prev,
        id: String(op.localId),
        ...(persist.codigo !== undefined ? { codigo: persist.codigo } : {}),
        _fonte: 'cliente_locais',
        _finalidades: persist._finalidades ?? prev._finalidades,
        _finalidades_detalhadas: persist._finalidades_detalhadas ?? prev._finalidades_detalhadas,
        _tipo_endereco_original: persist._tipo_endereco_original ?? prev._tipo_endereco_original,
      };
    } else {
      next[idx] = { ...prev, id: String(op.localId), _fonte: 'cliente_locais' };
    }
  }
  return next;
}

/**
 * Gate de publicação pós-PARTIAL: não aplicar baseline/view/owned/carimbo do save A
 * no formulário B (mesmo tenant) nem em create vazio após troca de superfície.
 * `stampGateSurfaceKey` deve ser a chave capturada **antes** do MASTER await;
 * `liveSurfaceKey` sobe a cada troca de identidade (inclui A→novo create).
 * @param {{
 *   stampClienteId?: string|null,
 *   liveFormClienteId?: string|null,
 *   catalogClientId?: string|null,
 *   stampGateClienteId?: string|null,
 *   stampGateAllow?: boolean,
 *   stampGateSurfaceKey?: number|null,
 *   liveSurfaceKey?: number|null,
 *   scopeCurrent?: boolean,
 * }} args
 * @returns {boolean}
 */
export function canPublishClienteLocaisPartialReconcile(args = {}) {
  const stamp = String(args.stampClienteId || '').trim();
  if (!stamp) return false;
  if (args.scopeCurrent !== true) return false;
  if (args.stampGateAllow !== true) return false;
  if (String(args.stampGateClienteId || '').trim() !== stamp) return false;
  // Superfície mudou durante MASTER/sync (novo create / outro cliente) — não publicar A em B.
  if (Number(args.stampGateSurfaceKey) !== Number(args.liveSurfaceKey)) return false;
  const live = String(args.liveFormClienteId || '').trim();
  if (live) return live === stamp;
  // Create sem id: catálogo de outro cliente bloqueia; catálogo vazio NÃO implica A —
  // só a igualdade de surfaceKey (já checada) autoriza o create do próprio save.
  const cat = args.catalogClientId == null || args.catalogClientId === ''
    ? ''
    : String(args.catalogClientId).trim();
  if (cat && cat !== stamp) return false;
  return true;
}

/**
 * Path legado (create/update/delete por request): NÃO atômico.
 * Preferir `syncClienteLocaisAtomicViaHttp` → POST `/locais/sync` (`batchAtomic:true`).
 * Este sync legado:
 * 1) pré-valida o lote inteiro (zero writes se inválido);
 * 2) congela clienteId + assertScope entre awaits;
 * 3) em falha remota: relatório preciso + reconcileRequired (reexecução idempotente).
 */
export const CLIENTE_LOCAIS_BATCH_ATOMIC = false;

/**
 * Monta `operations` do POST `/locais/sync` a partir do rascunho UI.
 * update + purposes (se fins mudaram) + inactivate; máx. 50 ops.
 * Overflow (>50) NÃO lança — retorna `overflow:true` para o caller escolher legado
 * antes do MASTER (evitar cliente gravado com locais órfãos).
 * @param {unknown} draft
 * @param {string[]|null|undefined} baselineIds
 * @returns {{ skipped: true, operations: [], overflow?: false }
 *   | { skipped: false, operations: Array<Record<string, unknown>>, overflow: boolean }}
 */
export function buildClienteLocaisSyncOperations(draft, baselineIds) {
  if (draft === undefined) return { skipped: true, operations: [], overflow: false };
  const planned = prepareClienteLocaisHttpDraft(draft);
  /** @type {Array<Record<string, unknown>>} */
  const operations = [];
  const keptIds = new Set();
  const draftRows = Array.isArray(draft) ? draft : [];
  for (const step of planned) {
    if (step.kind === 'create') {
      operations.push({ op: 'create', data: step.body });
      continue;
    }
    operations.push({ op: 'update', id: step.localId, data: step.body });
    keptIds.add(step.localId);
    const original = draftRows.find((row) => String(row?.id || '') === step.localId);
    const previous = original && typeof original === 'object'
      ? /** @type {{ _finalidades_detalhadas?: unknown }} */ (original)._finalidades_detalhadas
      : undefined;
    const next = Array.isArray(step.fins) ? step.fins : [];
    const finsChanged = !Array.isArray(previous)
      || next.length !== previous.length
      || next.some((row) => !previous.some((before) => before.finalidade === row.finalidade && before.principal === row.principal))
      || previous.some((before) => !next.some((row) => row.finalidade === before.finalidade && row.principal === before.principal));
    if (finsChanged) {
      operations.push({ op: 'purposes', id: step.localId, finalidades: next });
    }
  }
  if (Array.isArray(baselineIds)) {
    for (const baselineId of baselineIds) {
      const bid = String(baselineId ?? '').trim();
      if (!isClienteLocalCanonicalId(bid) || keptIds.has(bid)) continue;
      operations.push({ op: 'inactivate', id: bid });
    }
  }
  if (operations.length === 0) return { skipped: true, operations: [], overflow: false };
  if (operations.length > 50) {
    return { skipped: false, operations, overflow: true };
  }
  return { skipped: false, operations, overflow: false };
}

/**
 * Sync atômico via snapshotLocais + syncLocais (BFF `batchAtomic:true`).
 * Conflito de versão / envelope inválido → erro (não cai no path parcial).
 * @param {{
 *   clienteId: string,
 *   draft: unknown,
 *   baselineIds?: string[]|null,
 *   assertScope?: () => void,
 *   api: {
 *     snapshotLocais: (clienteId: string, opts?: object) => Promise<{ version: string }>,
 *     syncLocais: (clienteId: string, body: object) => Promise<{ batchAtomic?: boolean, data?: unknown[] }>,
 *   },
 * }} input
 * @returns {Promise<ClienteLocaisSyncSummary>}
 */
export async function syncClienteLocaisAtomicViaHttp({
  clienteId, draft, baselineIds, assertScope, api,
}) {
  if (draft === undefined) {
    return {
      created: 0, updated: 0, deleted: 0, skipped: true,
      ops: [], reconcileRequired: false, batchAtomic: true,
    };
  }
  const id = String(clienteId ?? '').trim();
  if (!id) {
    const error = /** @type {Error & { code: string, status: number }} */ (
      new Error('clienteId obrigatório para sync atomico cliente_locais')
    );
    error.code = 'VALIDATION_ERROR';
    error.status = 422;
    throw error;
  }
  const frozenClienteId = id;
  const guard = () => {
    if (typeof assertScope === 'function') assertScope();
    if (String(clienteId ?? '').trim() !== frozenClienteId) {
      const error = /** @type {Error & { code: string, status: number }} */ (
        new Error('clienteId mudou durante sync atomico de locais — operação abortada.')
      );
      error.code = 'CONTEXT_CHANGED';
      error.status = 409;
      throw error;
    }
  };
  const built = buildClienteLocaisSyncOperations(draft, baselineIds);
  if (built.skipped) {
    return {
      created: 0, updated: 0, deleted: 0, skipped: true,
      ops: [], reconcileRequired: false, batchAtomic: true,
    };
  }
  if (built.overflow) {
    const error = /** @type {Error & { code: string, status: number }} */ (
      new Error(
        'Lote atomico excede 50 operacoes (update+purposes). Use sync legado — rascunho preservado.',
      )
    );
    error.code = 'CLIENTE_LOCAIS_ATOMIC_OVERFLOW';
    error.status = 422;
    throw error;
  }
  guard();
  const snap = await api.snapshotLocais(frozenClienteId);
  guard();
  const version = typeof snap?.version === 'string' ? snap.version : '';
  if (!/^[a-f0-9]{64}$/.test(version)) {
    const error = /** @type {Error & { code: string, status: number }} */ (
      new Error('Snapshot de locais sem version — sync atomico abortado. Rascunho preservado.')
    );
    error.code = 'CLIENTE_LOCAIS_SNAPSHOT_INVALID';
    error.status = 409;
    throw error;
  }
  const page = await api.syncLocais(frozenClienteId, {
    version,
    operations: built.operations,
  });
  guard();
  if (page?.batchAtomic !== true) {
    const error = /** @type {Error & { code: string, status: number }} */ (
      new Error('Resposta syncLocais sem batchAtomic:true — nao declarar salvamento integral.')
    );
    error.code = 'CLIENTE_LOCAIS_SYNC_INVALID';
    error.status = 409;
    throw error;
  }
  let created = 0;
  let updated = 0;
  let deleted = 0;
  /** @type {Array<{ op: string, localId?: string }>} */
  const ops = [];
  for (const op of built.operations) {
    if (op.op === 'create') {
      created += 1;
      ops.push({ op: 'create' });
    } else if (op.op === 'update') {
      updated += 1;
      ops.push({ op: 'update', localId: String(op.id || '') });
    } else if (op.op === 'inactivate') {
      deleted += 1;
      ops.push({ op: 'delete', localId: String(op.id || '') });
    } else if (op.op === 'purposes') {
      ops.push({ op: 'purposes', localId: String(op.id || '') });
    }
  }
  return {
    created, updated, deleted, skipped: false,
    ops, reconcileRequired: false, batchAtomic: true,
  };
}

/** Complete local preflight, reused before MASTER and before any local write. */
export function prepareClienteLocaisHttpDraft(draft) {
  if (draft === undefined) return [];
  if (!Array.isArray(draft) || draft.length > 50)
    clienteLocalValidation(['locais_entrega'], 'O lote de locais deve ser um array com ate 50 itens. Nenhum item foi truncado.');
  const seen = new Set();
  return draft.map(item => {
    const row = item && typeof item === 'object' ? item : {};
    const localId = isClienteLocalCanonicalId(row.id) ? String(row.id).trim() : '';
    if (row.id != null && row.id !== '' && !localId)
      clienteLocalValidation(['id'], 'Identidade do local invalida. Nao criar substituto automaticamente.');
    if (localId && seen.has(localId)) clienteLocalValidation(['id'], 'Identidade de local repetida no lote.');
    if (localId) seen.add(localId);
    const body = localId ? mapUiEnderecoToClienteLocalUpdate(row) : mapUiEnderecoToClienteLocalCreate(row);
    return { kind: localId ? 'update' : 'create', localId, body,
      fins: localId ? finalidadesDoEndereco(row) : body.finalidades,
      nome: String(body.nome || row.apelido || localId) };
  });
}

/**
 * @typedef {{ created: number, updated: number, deleted: number, skipped: boolean,
 *   ops: Array<{ op: string, localId?: string, nome?: string }>,
 *   reconcileRequired: boolean,
 *   batchAtomic: boolean }} ClienteLocaisSyncSummary
 */

/**
 * Sincroniza rascunho UI com BFF `/locais` canônico.
 * - `draft === undefined`: omissão — NÃO sincroniza (não vira lista vazia).
 * - `baselineIds === null/undefined`: carga prévia ausente/falhou → NÃO soft-delete.
 * - `baselineIds` array: ids canônicos lidos; ausentes no draft = remoção explícita.
 * - `assertScope`: chamado antes de cada await (Grupo/Empresa/sessão/cliente).
 * @param {{
 *   clienteId: string,
 *   draft: unknown,
 *   baselineIds?: string[]|null,
 *   assertScope?: () => void,
 *   api: {
 *     createLocal: (clienteId: string, body: unknown) => Promise<unknown>,
 *     updateLocal: (clienteId: string, localId: string, body: unknown) => Promise<unknown>,
 *     softDeleteLocal: (clienteId: string, localId: string) => Promise<unknown>,
 *     setFinalidades: (clienteId: string, localId: string, finalidades: unknown) => Promise<unknown>,
 *   },
 * }} input
 * @returns {Promise<ClienteLocaisSyncSummary>}
 */
export async function syncClienteLocaisViaHttp({
  clienteId, draft, baselineIds, assertScope, api,
}) {
  // Omissão ≠ remoção: rascunho undefined não sincroniza lista vazia.
  if (draft === undefined) {
    return {
      created: 0, updated: 0, deleted: 0, skipped: true,
      ops: [], reconcileRequired: false, batchAtomic: CLIENTE_LOCAIS_BATCH_ATOMIC,
    };
  }
  const id = String(clienteId ?? '').trim();
  if (!id) {
    const error = /** @type {Error & { code: string, status: number }} */ (
      new Error('clienteId obrigatório para sync cliente_locais')
    );
    error.code = 'VALIDATION_ERROR';
    error.status = 422;
    throw error;
  }
  if (!Array.isArray(draft)) {
    const error = /** @type {Error & { code: string, status: number, fields: string[] }} */ (
      new Error('locais_entrega deve ser array no sync canônico. Rascunho preservado.')
    );
    error.code = 'VALIDATION_ERROR';
    error.status = 422;
    error.fields = ['locais_entrega'];
    throw error;
  }

  const frozenClienteId = id;
  const guard = () => {
    if (typeof assertScope === 'function') assertScope();
    if (String(clienteId ?? '').trim() !== frozenClienteId) {
      const error = /** @type {Error & { code: string, status: number }} */ (
        new Error('clienteId mudou durante sync de locais — operação abortada.')
      );
      error.code = 'CONTEXT_CHANGED';
      error.status = 409;
      throw error;
    }
  };

  const planned = prepareClienteLocaisHttpDraft(draft);

  /** @type {ClienteLocaisSyncSummary} */
  const summary = {
    created: 0,
    updated: 0,
    deleted: 0,
    skipped: false,
    ops: [],
    reconcileRequired: false,
    batchAtomic: CLIENTE_LOCAIS_BATCH_ATOMIC,
  };
  const keptIds = new Set();

  /**
   * @param {unknown} cause
   * @param {string} op
   */
  const failPartial = (cause, op) => {
    if (cause && typeof cause === 'object' && 'code' in cause) {
      const code = /** @type {{ code?: string }} */ (cause).code;
      if (
        code === 'VALIDATION_ERROR'
        || code === CLIENTE_HTTP_UNSUPPORTED_FIELDS
        || code === 'CONTEXT_CHANGED'
      ) {
        throw cause;
      }
    }
    summary.reconcileRequired = true;
    const causeMsg = cause instanceof Error ? cause.message : String(cause ?? 'erro');
    const error = /** @type {Error & {
      code: string,
      status: number,
      fields: string[],
      summary: ClienteLocaisSyncSummary,
      cause?: unknown,
    }} */ (
      new Error(
        `Sincronização de endereços interrompida em ${op} `
          + `(criados=${summary.created}, atualizados=${summary.updated}, removidos=${summary.deleted}). `
          + 'Não é gravação integral nem lote atômico BFF — reconcilie via listLocais e reexecute. '
          + causeMsg,
      )
    );
    error.name = 'ClienteLocaisSyncPartialError';
    error.code = CLIENTE_LOCAIS_SYNC_PARTIAL;
    error.status = 409;
    error.fields = ['locais_entrega'];
    error.summary = {
      ...summary,
      ops: summary.ops.slice(),
      reconcileRequired: true,
    };
    error.cause = cause;
    throw error;
  };

  for (const step of planned) {
    try {
      guard();
      if (step.kind === 'update') {
        await api.updateLocal(frozenClienteId, step.localId, step.body);
        guard();
        await api.setFinalidades(frozenClienteId, step.localId, step.fins);
        keptIds.add(step.localId);
        summary.updated += 1;
        summary.ops.push({ op: 'update', localId: step.localId, nome: step.nome });
      } else {
        const created = await api.createLocal(frozenClienteId, step.body);
        const createdId = created && typeof created === 'object'
          && isClienteLocalCanonicalId(/** @type {{ id?: unknown }} */ (created).id)
          ? String(/** @type {{ id: string }} */ (created).id).trim()
          : '';
        if (createdId) keptIds.add(createdId);
        summary.created += 1;
        summary.ops.push({
          op: 'create',
          ...(createdId ? { localId: createdId } : {}),
          nome: step.nome,
        });
      }
    } catch (cause) {
      failPartial(cause, step.kind === 'update' ? `update:${step.localId}` : `create:${step.nome}`);
    }
  }

  if (Array.isArray(baselineIds)) {
    for (const baselineId of baselineIds) {
      const bid = String(baselineId ?? '').trim();
      if (!isClienteLocalCanonicalId(bid) || keptIds.has(bid)) continue;
      try {
        guard();
        await api.softDeleteLocal(frozenClienteId, bid);
        summary.deleted += 1;
        summary.ops.push({ op: 'delete', localId: bid });
      } catch (cause) {
        failPartial(cause, `delete:${bid}`);
      }
    }
  }
  return summary;
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
 * @param {{ mode?: 'create'|'update' }} [options]
 * @returns {Record<string, unknown>}
 */
export function toClienteMasterHttpPayload(raw, options = {}) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  assertClienteHttpRichFieldsWritable(src);
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of ALLOWED_KEYS) {
    // Empty form defaults are not clear commands; explicit NULL remains a clear command.
    if (CLIENTE_MASTER_EXTRA_KEYS.includes(key) && src[key] === '') continue;
    if (src[key] !== undefined) out[key] = src[key];
  }
  // contatos:null não é comando público — remove antes da projeção CAS.
  if (Object.prototype.hasOwnProperty.call(out, 'contatos') && out.contatos == null) {
    delete out.contatos;
  }

  applyContatosProjection(src, out, options);

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
