#!/usr/bin/env node
/**
 * Resolve vínculos por identidade jurídica comprovada (CODEX LEGADO — item 2).
 *
 * Regras soberanas (aprovação humana Gate 18, sem dados reais no Git):
 * - CPA Ferro e Aço e 3Z LTDA = empresas operacionais (emissoras)
 * - Grupo CPA = agrupamento (NÃO empresa emissora)
 * - Proibido inferir empresa por pasta, EMP03, TID_EMP03 ou código seletor 003
 *
 * Não edita o mapper Cursor #48. Não lê HD. Não importa. Não autoriza carga.
 *
 * Uso:
 *   node scripts/legado/resolver-vinculo-juridico-legado.mjs \
 *     --contrato fixtures/legado/vinculos-juridicos-sinteticos/contrato-aliases-aprovados.json \
 *     --candidatos fixtures/legado/vinculos-juridicos-sinteticos/candidatos-sinteticos.json
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RESOLVER_VINCULO_VERSION = '1.0.0';

/** Destinos canônicos públicos (rótulos). Sem UUID/CNPJ reais. */
export const DESTINO_CANONICO = Object.freeze({
  GRUPO_CPA: Object.freeze({
    destinoKey: 'DEST_GRUPO_CPA',
    label: 'Grupo CPA',
    scopeType: 'group',
    papel: 'agrupamento',
    emissor: false,
  }),
  CPA_FERRO_E_ACO: Object.freeze({
    destinoKey: 'DEST_CPA_FERRO_E_ACO',
    label: 'CPA Ferro e Aço',
    scopeType: 'empresa',
    papel: 'empresa_operacional',
    emissor: true,
  }),
  EMPRESA_3Z_LTDA: Object.freeze({
    destinoKey: 'DEST_3Z_LTDA',
    label: '3Z LTDA',
    scopeType: 'empresa',
    papel: 'empresa_operacional',
    emissor: true,
  }),
});

/** Indícios de pasta/arquivo que NUNCA provam empresa sozinhos. */
export const PISTAS_PROIBIDAS = Object.freeze([
  'EMP03',
  'EMP01',
  'EMP02',
  'EMP04',
  'EMP05',
  'TID_EMP03',
  'LEGACY_TID_EMP03',
  'GRUPO003',
  'GRUPO_003',
]);

const SHA256_RE = /^[a-f0-9]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const EVIDENCIA_TIPOS = new Set(['cnpj', 'documento_fiscal', 'aprovacao_humana']);

function fail(code, detail = '') {
  const err = new Error(detail ? `${code}:${detail}` : code);
  err.code = code;
  throw err;
}

function text(value) {
  return String(value ?? '').trim();
}

/** Preserva zeros à esquerda. `1` → `001`. */
export function normalizarCodigoLegado(codigo) {
  const raw = text(codigo);
  if (!raw) return '';
  if (!/^\d+$/.test(raw)) return raw.toUpperCase();
  if (/^0+$/.test(raw)) return '0';
  return raw.padStart(3, '0');
}

function loadJson(path, code) {
  if (!path || !existsSync(path)) fail(code, basename(path || 'missing'));
  try {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    fail(code, basename(path));
  }
}

function evidenciaValida(evidencia) {
  if (!evidencia || typeof evidencia !== 'object' || Array.isArray(evidencia)) return false;
  const data = text(evidencia.aprovadoEm);
  const dataOk = ISO_RE.test(data)
    && Number.isFinite(Date.parse(data))
    && new Date(data).toISOString() === (data.includes('.') ? data : data.replace('Z', '.000Z'));
  return EVIDENCIA_TIPOS.has(text(evidencia.tipo))
    && SHA256_RE.test(text(evidencia.sha256))
    && !/^0{64}$/i.test(text(evidencia.sha256))
    && UUID_RE.test(text(evidencia.aprovadoPor))
    && dataOk;
}

/**
 * Detecta tentativa de inferir empresa por pasta/EMP03/nome de arquivo.
 * @param {Record<string, unknown>} candidato
 */
export function detectarInferenciaProibida(candidato = {}) {
  const motivos = [];
  const blob = [
    candidato.pasta,
    candidato.folder,
    candidato.arquivo,
    candidato.fileName,
    candidato.sourcePath,
    candidato.pista,
    candidato.hint,
  ].map(text).filter(Boolean).join('|').toUpperCase();

  for (const pista of PISTAS_PROIBIDAS) {
    if (blob.includes(pista)) {
      motivos.push(`inferencia_proibida_pista:${pista}`);
    }
  }

  const onlyFolder = Boolean(text(candidato.pasta) || text(candidato.folder) || text(candidato.pista))
    && !text(candidato.codigoEmpresaLegado)
    && !text(candidato.codigo_empresa_legado)
    && !text(candidato.codigoSeletor)
    && !text(candidato.aliasId);
  if (onlyFolder) motivos.push('inferencia_somente_pasta');

  return [...new Set(motivos)];
}

/**
 * Indexa o contrato sintético de aliases aprovados.
 * @param {object} contrato
 */
export function indexarContratoAliases(contrato) {
  if (!contrato || contrato.schemaVersion !== 1) fail('LEGACY_VINCULO_CONTRATO_SCHEMA');
  if (contrato.synthetic !== true) fail('LEGACY_VINCULO_CONTRATO_NOT_SYNTHETIC');
  if (contrato.importAuthorized === true) fail('LEGACY_VINCULO_CONTRATO_IMPORT_FLAG');
  if (!Array.isArray(contrato.aliases) || contrato.aliases.length === 0) {
    fail('LEGACY_VINCULO_CONTRATO_ALIASES_EMPTY');
  }

  const byCodigo = new Map();
  const byAliasId = new Map();
  let empresas = 0;
  let grupos = 0;

  for (const alias of contrato.aliases) {
    if (!alias || typeof alias !== 'object') fail('LEGACY_VINCULO_ALIAS_INVALID');
    const codigo = normalizarCodigoLegado(alias.codigoSeletorLegado);
    const aliasId = text(alias.aliasId);
    const destinoKey = text(alias.destinoKey);
    const scopeType = text(alias.scopeType);
    const papel = text(alias.papel);
    const humanApproved = alias.humanApproved === true;

    if (!codigo || !aliasId || !destinoKey) fail('LEGACY_VINCULO_ALIAS_FIELDS');
    if (!humanApproved) fail('LEGACY_VINCULO_ALIAS_NOT_APPROVED', aliasId);
    if (!evidenciaValida(alias.evidencia)) fail('LEGACY_VINCULO_EVIDENCIA_INVALID', aliasId);

    const destino = Object.values(DESTINO_CANONICO).find((d) => d.destinoKey === destinoKey);
    if (!destino) fail('LEGACY_VINCULO_DESTINO_UNKNOWN', destinoKey);
    if (destino.scopeType !== scopeType) fail('LEGACY_VINCULO_SCOPE_MISMATCH', aliasId);
    if (destino.papel !== papel) fail('LEGACY_VINCULO_PAPEL_MISMATCH', aliasId);

    // 003 / Grupo nunca pode ser marcado como empresa operacional.
    if (codigo === '003' || destinoKey === DESTINO_CANONICO.GRUPO_CPA.destinoKey) {
      if (scopeType !== 'group' || destino.emissor === true || papel === 'empresa_operacional') {
        fail('LEGACY_VINCULO_GRUPO_COMO_EMPRESA', aliasId);
      }
      grupos += 1;
    } else {
      if (scopeType !== 'empresa' || destino.emissor !== true) {
        fail('LEGACY_VINCULO_EMPRESA_SEM_EMISSOR', aliasId);
      }
      empresas += 1;
    }

    if (byCodigo.has(codigo)) fail('LEGACY_VINCULO_CODIGO_DUP', codigo);
    if (byAliasId.has(aliasId)) fail('LEGACY_VINCULO_ALIAS_DUP', aliasId);
    byCodigo.set(codigo, { ...alias, codigoSeletorLegado: codigo, destino });
    byAliasId.set(aliasId, { ...alias, codigoSeletorLegado: codigo, destino });
  }

  if (empresas < 2 || grupos < 1) fail('LEGACY_VINCULO_TOPOLOGIA_INCOMPLETA', `e=${empresas},g=${grupos}`);

  return {
    synthetic: true,
    importAuthorized: false,
    humanAttested: contrato.humanAttested === true,
    digitalSignatureConfigured: contrato.digitalSignatureConfigured === false
      ? false
      : Boolean(contrato.digitalSignatureConfigured),
    byCodigo,
    byAliasId,
    empresas,
    grupos,
    contratoLeaf: text(contrato.contratoId) || 'contrato',
  };
}

/**
 * Resolve um candidato sintético contra o contrato indexado.
 * @param {Record<string, unknown>} candidato
 * @param {ReturnType<typeof indexarContratoAliases>} index
 */
export function resolverVinculoJuridico(candidato = {}, index) {
  if (!index?.byCodigo) fail('LEGACY_VINCULO_INDEX_REQUIRED');

  const motivos = [];
  const inferencias = detectarInferenciaProibida(candidato);
  motivos.push(...inferencias);

  const codigo = normalizarCodigoLegado(
    candidato.codigoEmpresaLegado
      ?? candidato.codigo_empresa_legado
      ?? candidato.codigoSeletor
      ?? candidato.codigo,
  );

  // Pedido explícito de usar pasta/EMP03 como empresa.
  if (candidato.inferirPorPasta === true || candidato.useFolderAsCompany === true) {
    motivos.push('politica_proibe_inferir_por_pasta');
  }

  if (!codigo) {
    motivos.push('codigo_seletor_ausente');
    return buildResultado({
      status: 'QUARENTENA',
      motivos,
      codigoSeletorLegado: '',
      candidatoId: text(candidato.id) || text(candidato.candidatoId),
    });
  }

  if (codigo === '0') {
    motivos.push('codigo_empresa_legado_0');
    return buildResultado({
      status: 'QUARENTENA',
      motivos,
      codigoSeletorLegado: codigo,
      candidatoId: text(candidato.id) || text(candidato.candidatoId),
    });
  }

  const alias = index.byCodigo.get(codigo);
  if (!alias) {
    motivos.push('codigo_sem_alias_aprovado');
    return buildResultado({
      status: 'QUARENTENA',
      motivos,
      codigoSeletorLegado: codigo,
      candidatoId: text(candidato.id) || text(candidato.candidatoId),
    });
  }

  // Mesmo com alias de Grupo, operação emissora fica bloqueada.
  const requerEmissor = candidato.requerEmissor === true
    || ['pedido', 'nota_fiscal', 'estoque', 'conta_receber', 'conta_pagar'].includes(text(candidato.entidade));

  if (requerEmissor && alias.destino.emissor !== true) {
    motivos.push('codigo_grupo_nao_e_emissor');
  }

  if (inferencias.length > 0) {
    // Pista de pasta presente: mesmo com código válido, a resolução por pasta é recusada.
    // Se o código veio explicitamente, ainda assim registramos a pista; só bloqueamos se
    // a única prova era a pasta ou se pediram inferência por pasta.
    if (motivos.includes('inferencia_somente_pasta') || motivos.includes('politica_proibe_inferir_por_pasta')) {
      return buildResultado({
        status: 'QUARENTENA',
        motivos,
        codigoSeletorLegado: codigo,
        candidatoId: text(candidato.id) || text(candidato.candidatoId),
        aliasId: alias.aliasId,
      });
    }
  }

  if (motivos.includes('codigo_grupo_nao_e_emissor')) {
    return buildResultado({
      status: 'QUARENTENA',
      motivos,
      codigoSeletorLegado: codigo,
      candidatoId: text(candidato.id) || text(candidato.candidatoId),
      aliasId: alias.aliasId,
      destinoKey: alias.destino.destinoKey,
      scopeType: alias.destino.scopeType,
      papel: alias.destino.papel,
      label: alias.destino.label,
    });
  }

  return buildResultado({
    status: 'VINCULO_COMPROVADO',
    motivos,
    codigoSeletorLegado: codigo,
    candidatoId: text(candidato.id) || text(candidato.candidatoId),
    aliasId: alias.aliasId,
    destinoKey: alias.destino.destinoKey,
    scopeType: alias.destino.scopeType,
    papel: alias.destino.papel,
    label: alias.destino.label,
    emissor: alias.destino.emissor,
    humanApproved: true,
  });
}

function buildResultado(partial) {
  const status = partial.status;
  return {
    status,
    comprovado: status === 'VINCULO_COMPROVADO',
    importAuthorized: false,
    quarentena: status !== 'VINCULO_COMPROVADO',
    codigoSeletorLegado: partial.codigoSeletorLegado || '',
    candidatoId: partial.candidatoId || '',
    aliasId: partial.aliasId || '',
    destinoKey: partial.destinoKey || '',
    scopeType: partial.scopeType || '',
    papel: partial.papel || '',
    label: partial.label || '',
    emissor: partial.emissor === true,
    humanApproved: partial.humanApproved === true,
    motivos: [...new Set(partial.motivos || [])],
  };
}

/**
 * Lote: resolve candidatos e emite relatório agregado sem PII.
 * @param {object} contrato
 * @param {Array<Record<string, unknown>>} candidatos
 */
export function resolverLoteVinculosJuridicos(contrato, candidatos = []) {
  const index = indexarContratoAliases(contrato);
  if (!Array.isArray(candidatos)) fail('LEGACY_VINCULO_CANDIDATOS_INVALID');

  const resultados = candidatos.map((c) => resolverVinculoJuridico(c, index));
  const comprovados = resultados.filter((r) => r.comprovado);
  const quarentena = resultados.filter((r) => r.quarentena);
  const porDestino = {};
  const porMotivo = {};
  for (const r of comprovados) {
    const key = `${r.scopeType}|${r.destinoKey}`;
    porDestino[key] = (porDestino[key] || 0) + 1;
  }
  for (const r of quarentena) {
    for (const m of r.motivos) {
      const motivo = m.includes(':') ? m.split(':')[0] : m;
      porMotivo[motivo] = (porMotivo[motivo] || 0) + 1;
    }
  }

  const empresasOperacionais = comprovados.filter((r) => r.papel === 'empresa_operacional');
  const grupos = comprovados.filter((r) => r.papel === 'agrupamento');

  // Integridade do lote: hash só de status/códigos/destinos (sem nomes livres).
  const selo = createHash('sha256')
    .update(JSON.stringify(resultados.map((r) => ([
      r.status, r.codigoSeletorLegado, r.destinoKey, r.scopeType, r.motivos,
    ]))))
    .digest('hex');

  return {
    schemaVersion: 1,
    resolverVersion: RESOLVER_VINCULO_VERSION,
    mode: 'READ_ONLY_NO_IMPORT',
    synthetic: true,
    importAuthorized: false,
    humanAttested: index.humanAttested,
    digitalSignatureConfigured: index.digitalSignatureConfigured,
    contrato: index.contratoLeaf,
    origem: candidatos.length,
    comprovados: comprovados.length,
    quarentena: quarentena.length,
    empresasOperacionais: empresasOperacionais.length,
    agrupamentos: grupos.length,
    porDestino,
    porMotivo,
    seloSha256: selo,
    resultados,
    note: 'Vinculos sinteticos. Sem CNPJ/UUID reais. Grupo CPA nao e emissor. EMP03/pasta nao prova empresa.',
    blockedRealHdMap: true,
  };
}

function parseArgs(argv) {
  const out = { contrato: '', candidatos: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--contrato') out.contrato = argv[++i] || '';
    else if (a === '--candidatos') out.candidatos = argv[++i] || '';
    else if (a === '--help' || a === '-h') out.help = true;
    else fail('LEGACY_VINCULO_ARG_UNKNOWN', a);
  }
  return out;
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(`Uso: resolver-vinculo-juridico-legado.mjs --contrato FILE --candidatos FILE\n`);
      process.exitCode = 0;
    } else {
      const contrato = loadJson(args.contrato, 'LEGACY_VINCULO_CONTRATO_MISSING');
      const payload = loadJson(args.candidatos, 'LEGACY_VINCULO_CANDIDATOS_MISSING');
      const candidatos = Array.isArray(payload) ? payload : payload.candidatos;
      const report = resolverLoteVinculosJuridicos(contrato, candidatos);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      process.exitCode = 0;
    }
  } catch (error) {
    const msg = String(error?.message || 'LEGACY_VINCULO_FAILED');
    process.stderr.write(`${msg.startsWith('LEGACY_') ? msg : 'LEGACY_VINCULO_FAILED'}\n`);
    process.exitCode = 1;
  }
}
