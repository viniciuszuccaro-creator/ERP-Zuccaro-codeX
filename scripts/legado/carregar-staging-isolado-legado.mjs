#!/usr/bin/env node
/**
 * ETL sintético → staging isolado (CODEX LEGADO — item 3).
 *
 * Para registros com vínculo jurídico comprovado:
 * - extrai/transforma em memória
 * - carrega em staging isolado (Map), nunca no operacional
 * - deduplica por (group, empresaDestino, entidade, codigoLegado)
 * - ordena/valida dependências
 * - reconcilia totais monetários por empresa em centavos
 * - quarentena sem prova / EMP03 / Grupo-como-emissor
 *
 * `importAuthorized` e carga operacional permanecem false sem gate.
 * Não lê HD. Não edita mapper Cursor #48. Reutiliza migracaoErpPolicy + resolver jurídico.
 *
 * Uso:
 *   node scripts/legado/carregar-staging-isolado-legado.mjs \
 *     --contrato fixtures/legado/vinculos-juridicos-sinteticos/contrato-aliases-aprovados.json \
 *     --lote fixtures/legado/staging-isolado-sintetico/lote-staging.json
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MIGRACAO_DESTINO_STAGING,
  stampMigracaoRecord,
  stripSegredosMigracao,
} from '../../src/components/lib/migracaoErpPolicy.js';
import {
  detectarInferenciaProibida,
  indexarContratoAliases,
  normalizarCodigoLegado,
  resolverVinculoJuridico,
  RESOLVER_VINCULO_VERSION,
} from './resolver-vinculo-juridico-legado.mjs';

export const STAGING_LOADER_VERSION = '1.0.0';

const MESTRES_GRUPO = new Set(['cliente', 'fornecedor', 'produto', 'produto_revenda']);
const OPERACOES = new Set(['pedido', 'estoque', 'conta_receber', 'conta_pagar', 'nota_fiscal', 'orcamento']);
const SHA256_RE = /^[a-f0-9]{64}$/i;

function fail(code, detail = '') {
  const err = new Error(detail ? `${code}:${detail}` : code);
  err.code = code;
  throw err;
}

function text(value) {
  return String(value ?? '').trim();
}

function loadJson(path, code) {
  if (!path || !existsSync(path)) fail(code, basename(path || 'missing'));
  try {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    fail(code, basename(path));
  }
}

/** Converte valor monetário sintético (string/number) em centavos inteiros seguros. */
export function toCentavos(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 100);
  }
  const raw = text(value).replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) return null;
  const [reais, frac = ''] = raw.replace(/^-/, '').split('.');
  const sign = raw.startsWith('-') ? -1 : 1;
  const cents = Number(reais) * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isSafeInteger(cents)) return null;
  return sign * cents;
}

function chaveStaging(groupId, empresaDestinoKey, entidade, codigoLegado) {
  return JSON.stringify([groupId, empresaDestinoKey, entidade, codigoLegado]);
}

/**
 * Avalia se a linha pode entrar no staging isolado via vínculo jurídico.
 */
export function avaliarLinhaStaging({ linha, index, groupId }) {
  const motivos = [];
  const entidade = text(linha?.entidade);
  const codigoLegado = text(linha?.codigoLegado);
  const assinatura = text(linha?.assinaturaOrigem);
  const grupo = text(groupId || linha?.groupId);

  if (!grupo) motivos.push('grupo_nao_informado');
  if (!entidade || (!MESTRES_GRUPO.has(entidade) && !OPERACOES.has(entidade))) {
    motivos.push('entidade_nao_suportada');
  }
  if (!codigoLegado) motivos.push('codigo_legado_ausente');
  if (!SHA256_RE.test(assinatura)) motivos.push('assinatura_origem_ausente');

  let vinculo = null;
  let empresaDestinoKey = '';
  let scopeType = '';

  if (MESTRES_GRUPO.has(entidade)) {
    if (text(linha?.empresaId)) motivos.push('mestre_grupo_nao_pode_ter_empresa');
    const inferencias = detectarInferenciaProibida(linha);
    if (linha?.inferirPorPasta === true || linha?.useFolderAsCompany === true) {
      motivos.push('politica_proibe_inferir_por_pasta');
    }
    if (inferencias.includes('inferencia_somente_pasta')) {
      motivos.push('inferencia_somente_pasta');
    }
    for (const m of inferencias) {
      if (m.startsWith('inferencia_proibida_pista') && !text(linha?.codigoLegado)) {
        motivos.push(m);
      }
    }
    if (index.humanAttested !== true) motivos.push('contrato_sem_atestacao_humana');
    empresaDestinoKey = '';
    scopeType = 'group';
  } else if (OPERACOES.has(entidade)) {
    vinculo = resolverVinculoJuridico({
      ...linha,
      entidade,
      requerEmissor: true,
    }, index);
    if (!vinculo.comprovado) {
      motivos.push(...(vinculo.motivos.length ? vinculo.motivos : ['vinculo_juridico_nao_comprovado']));
    } else {
      empresaDestinoKey = vinculo.destinoKey;
      scopeType = 'empresa';
    }
  }

  const centavos = toCentavos(linha?.valorTotal ?? linha?.valor_total ?? linha?.total);
  if ((linha?.valorTotal != null || linha?.valor_total != null || linha?.total != null) && centavos == null) {
    motivos.push('valor_monetario_invalido');
  }

  return {
    apto: motivos.length === 0,
    motivos: [...new Set(motivos)],
    entidade,
    codigoLegado,
    assinatura,
    groupId: grupo,
    empresaDestinoKey,
    scopeType,
    codigoSeletorLegado: vinculo?.codigoSeletorLegado || normalizarCodigoLegado(linha?.codigoEmpresaLegado),
    label: vinculo?.label || (scopeType === 'group' ? 'Grupo CPA' : ''),
    centavos,
  };
}

/**
 * Carrega lote sintético em staging isolado (memória).
 * @param {object} opts
 * @param {object} opts.contrato
 * @param {Array} opts.itens
 * @param {string} opts.groupId
 * @param {Array} [opts.existentes]
 * @param {Record<string, number>} [opts.totaisEsperadosCentavos] mapa destinoKey → centavos
 * @param {boolean} [opts.stagingPrepAuthorized] autoriza preparar staging isolado (≠ import operacional)
 */
export function carregarStagingIsoladoLegado({
  contrato,
  itens = [],
  groupId,
  existentes = [],
  totaisEsperadosCentavos = {},
  stagingPrepAuthorized = false,
} = {}) {
  if (stagingPrepAuthorized !== true) {
    fail('LEGACY_STAGING_PREP_UNAUTHORIZED');
  }
  const grupo = text(groupId);
  if (!grupo) fail('LEGACY_STAGING_GROUP_REQUIRED');
  if (!Array.isArray(itens) || itens.length === 0) fail('LEGACY_STAGING_LOTE_EMPTY');
  if (!Array.isArray(existentes)) fail('LEGACY_STAGING_INDEX_INVALID');
  if (contrato?.importAuthorized === true) fail('LEGACY_STAGING_CONTRATO_IMPORT_FLAG');

  const index = indexarContratoAliases(contrato);
  const store = new Map(); // chave → registro staging sanitizado
  const signatures = new Map();

  for (const ant of existentes) {
    const g = text(ant?.groupId);
    const entidade = text(ant?.entidade);
    const codigoLegado = text(ant?.codigoLegado);
    const empresaDestinoKey = text(ant?.empresaDestinoKey);
    const assinatura = text(ant?.assinaturaOrigem);
    if (g !== grupo || !entidade || !codigoLegado || !SHA256_RE.test(assinatura)) {
      fail('LEGACY_STAGING_INDEX_CORRUPT');
    }
    if (OPERACOES.has(entidade) && !empresaDestinoKey) fail('LEGACY_STAGING_INDEX_CORRUPT');
    if (MESTRES_GRUPO.has(entidade) && empresaDestinoKey) fail('LEGACY_STAGING_INDEX_CORRUPT');
    const key = chaveStaging(g, empresaDestinoKey, entidade, codigoLegado);
    if (signatures.has(key) && signatures.get(key) !== assinatura) {
      fail('LEGACY_STAGING_INDEX_CONFLICT');
    }
    signatures.set(key, assinatura);
    store.set(key, stripSegredosMigracao(ant));
  }

  const relatorio = {
    origem: itens.length,
    carregados: 0,
    rejeitados: 0,
    quarentena: 0,
    reusos: 0,
    conflitos: 0,
    porMotivo: {},
    porEmpresa: {},
    monetary: {
      porEmpresaCentavos: {},
      esperadosCentavos: { ...totaisEsperadosCentavos },
      diferencasCentavos: {},
      totalDiffCentavos: 0,
      reconciliado: true,
    },
  };
  const contar = (bag, key) => { bag[key] = (bag[key] || 0) + 1; };

  const avaliados = [];
  for (const linha of itens) {
    if (text(linha?.groupId) && text(linha.groupId) !== grupo) {
      relatorio.rejeitados += 1;
      contar(relatorio.porMotivo, 'grupo_divergente');
      continue;
    }
    const av = avaliarLinhaStaging({ linha, index, groupId: grupo });
    if (!av.apto) {
      relatorio.quarentena += 1;
      for (const m of av.motivos) contar(relatorio.porMotivo, m.includes(':') ? m.split(':')[0] : m);
      continue;
    }
    avaliados.push({ linha, av });
  }

  // Dependências: mestres do grupo ou operações da mesma empresaDestinoKey.
  const idsLote = new Set(avaliados.map(({ av }) => chaveStaging(grupo, av.empresaDestinoKey, av.entidade, av.codigoLegado)));
  const conhecidos = new Set([...store.keys(), ...idsLote]);
  const graus = new Map([...idsLote].map((id) => [id, 0]));
  const dependentes = new Map([...idsLote].map((id) => [id, new Set()]));
  let dependenciasPendentes = 0;

  for (const { linha, av } of avaliados) {
    const itemKey = chaveStaging(grupo, av.empresaDestinoKey, av.entidade, av.codigoLegado);
    const deps = Array.isArray(linha.dependencias) ? linha.dependencias : [];
    for (const dep of deps) {
      if (!dep || typeof dep !== 'object' || Array.isArray(dep)) {
        fail('LEGACY_STAGING_DEP_INVALID');
      }
      const extra = Object.keys(dep).filter((k) => !['entidade', 'codigoLegado', 'escopo'].includes(k));
      if (extra.length) fail('LEGACY_STAGING_DEP_FIELDS');
      const depEntidade = text(dep.entidade);
      const depCodigo = text(dep.codigoLegado);
      const escopo = text(dep.escopo);
      const depEmpresa = escopo === 'empresa' ? av.empresaDestinoKey : '';
      const tipoOk = (escopo === 'grupo' && MESTRES_GRUPO.has(depEntidade))
        || (escopo === 'empresa' && OPERACOES.has(depEntidade));
      const depKey = chaveStaging(grupo, depEmpresa, depEntidade, depCodigo);
      if (!tipoOk || !depCodigo || (escopo === 'empresa' && !depEmpresa) || !conhecidos.has(depKey)) {
        dependenciasPendentes += 1;
        contar(relatorio.porMotivo, 'dependencia_nao_comprovada');
      } else if (idsLote.has(depKey) && !dependentes.get(depKey).has(itemKey)) {
        dependentes.get(depKey).add(itemKey);
        graus.set(itemKey, graus.get(itemKey) + 1);
      }
    }
  }

  const fila = [...graus].filter(([, g]) => g === 0).map(([id]) => id);
  let ordenados = 0;
  while (fila.length) {
    const id = fila.pop();
    ordenados += 1;
    for (const dep of dependentes.get(id) || []) {
      const g = graus.get(dep) - 1;
      graus.set(dep, g);
      if (g === 0) fila.push(dep);
    }
  }
  const ciclicas = idsLote.size - ordenados;
  if (ciclicas > 0) contar(relatorio.porMotivo, 'dependencia_ciclica');

  const depsOk = dependenciasPendentes === 0 && ciclicas === 0;
  const carregadosPrivados = [];

  if (depsOk) {
    for (const { linha, av } of avaliados) {
      const key = chaveStaging(grupo, av.empresaDestinoKey, av.entidade, av.codigoLegado);
      const anterior = signatures.get(key);
      if (anterior) {
        if (anterior === av.assinatura) {
          relatorio.reusos += 1;
        } else {
          relatorio.conflitos += 1;
          contar(relatorio.porMotivo, 'codigo_legado_conflitante');
        }
        continue;
      }
      signatures.set(key, av.assinatura);
      const stamped = stampMigracaoRecord(stripSegredosMigracao({
        groupId: grupo,
        group_id: grupo,
        empresaDestinoKey: av.empresaDestinoKey || undefined,
        empresa_id: undefined, // nunca promove UUID operacional aqui
        entidade: av.entidade,
        codigoLegado: av.codigoLegado,
        codigo_legado: av.codigoLegado,
        codigoEmpresaLegado: av.codigoSeletorLegado || undefined,
        assinaturaOrigem: av.assinatura,
        valor_total_centavos: av.centavos,
        destinoKey: av.empresaDestinoKey || 'DEST_GRUPO_CPA',
        scopeType: av.scopeType,
        label_destino: av.label,
        dependencias: Array.isArray(linha.dependencias) ? linha.dependencias : [],
      }), {
        arquivoNome: 'staging-isolado-sintetico.json',
        entidade: av.entidade,
        confirmado: false,
        destino: MIGRACAO_DESTINO_STAGING,
      });
      const privado = stripSegredosMigracao({
        ...stamped,
        importAuthorized: false,
        stagingIsolado: true,
      });
      store.set(key, privado);
      carregadosPrivados.push(privado);
      relatorio.carregados += 1;
      const bucket = av.empresaDestinoKey || 'DEST_GRUPO_CPA';
      contar(relatorio.porEmpresa, bucket);
      if (av.centavos != null) {
        relatorio.monetary.porEmpresaCentavos[bucket] = (
          relatorio.monetary.porEmpresaCentavos[bucket] || 0
        ) + av.centavos;
      }
    }
  } else {
    // Dependências inválidas: nada carregado; linhas aptas contam como rejeitadas de carga.
    relatorio.rejeitados += avaliados.length;
    contar(relatorio.porMotivo, 'lote_bloqueado_por_dependencias');
  }

  // Reconciliação monetária por empresa (centavos).
  const destinos = new Set([
    ...Object.keys(relatorio.monetary.porEmpresaCentavos),
    ...Object.keys(totaisEsperadosCentavos || {}),
  ]);
  let totalDiff = 0;
  for (const dest of destinos) {
    const observado = relatorio.monetary.porEmpresaCentavos[dest] || 0;
    const esperado = Number.isSafeInteger(totaisEsperadosCentavos?.[dest])
      ? totaisEsperadosCentavos[dest]
      : observado; // se não informado, espera igualdade consigo (diff 0)
    const diff = observado - esperado;
    relatorio.monetary.diferencasCentavos[dest] = diff;
    totalDiff += Math.abs(diff);
    if (diff !== 0) relatorio.monetary.reconciliado = false;
  }
  relatorio.monetary.totalDiffCentavos = totalDiff;

  // Se havia expectativa explícita e divergiu, marcar rejeição agregada sem derrubar store já carregado
  // — o relatório sinaliza; import continua negado.
  if (!relatorio.monetary.reconciliado) {
    contar(relatorio.porMotivo, 'diferenca_monetaria_centavos');
  }

  const selo = createHash('sha256')
    .update(JSON.stringify({
      carregados: relatorio.carregados,
      quarentena: relatorio.quarentena,
      rejeitados: relatorio.rejeitados,
      conflitos: relatorio.conflitos,
      reusos: relatorio.reusos,
      porEmpresa: relatorio.porEmpresa,
      monetary: relatorio.monetary,
      porMotivo: relatorio.porMotivo,
    }))
    .digest('hex');

  return {
    schemaVersion: 1,
    loaderVersion: STAGING_LOADER_VERSION,
    resolverVersion: RESOLVER_VINCULO_VERSION,
    mode: 'STAGING_ISOLADO_NO_IMPORT',
    synthetic: true,
    importAuthorized: false,
    operationalLoadAuthorized: false,
    blockedRealHdExtract: true,
    destino: MIGRACAO_DESTINO_STAGING,
    groupId: grupo,
    storeSize: store.size,
    dependenciasPendentes,
    dependenciasCiclicas: ciclicas,
    relatorio,
    // Em lote com quarentena/conflito parcial ainda devolvemos carregados comprovados
    // (diferente do gate antigo all-or-nothing) — import operacional continua false.
    privados: carregadosPrivados.map((p) => ({
      entidade: p.entidade,
      codigo_legado: p.codigo_legado,
      empresaDestinoKey: p.empresaDestinoKey || '',
      scopeType: p.scopeType,
      valor_total_centavos: p.valor_total_centavos ?? null,
      destino_migracao: p.destino_migracao,
      importAuthorized: false,
    })),
    seloSha256: selo,
    note: 'Staging isolado em memoria. Sem PII. Sem carga operacional. Backup original nao alterado.',
  };
}

function parseArgs(argv) {
  const out = { contrato: '', lote: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--contrato') out.contrato = argv[++i] || '';
    else if (a === '--lote') out.lote = argv[++i] || '';
    else if (a === '--help' || a === '-h') out.help = true;
    else fail('LEGACY_STAGING_ARG_UNKNOWN', a);
  }
  return out;
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write('Uso: carregar-staging-isolado-legado.mjs --contrato FILE --lote FILE\n');
      process.exitCode = 0;
    } else {
      const contrato = loadJson(args.contrato, 'LEGACY_STAGING_CONTRATO_MISSING');
      const lote = loadJson(args.lote, 'LEGACY_STAGING_LOTE_MISSING');
      const report = carregarStagingIsoladoLegado({
        contrato,
        itens: lote.itens,
        groupId: lote.groupId,
        existentes: lote.existentes || [],
        totaisEsperadosCentavos: lote.totaisEsperadosCentavos || {},
        stagingPrepAuthorized: lote.stagingPrepAuthorized === true,
      });
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      process.exitCode = 0;
    }
  } catch (error) {
    const msg = String(error?.message || 'LEGACY_STAGING_FAILED');
    process.stderr.write(`${msg.startsWith('LEGACY_') ? msg : 'LEGACY_STAGING_FAILED'}\n`);
    process.exitCode = 1;
  }
}
