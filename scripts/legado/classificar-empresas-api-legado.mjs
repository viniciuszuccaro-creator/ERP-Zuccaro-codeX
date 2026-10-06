#!/usr/bin/env node
/**
 * Classifica export sanitizado de groups/empresas do banco da API
 * (CODEX LEGADO — sem apagar a terceira linha).
 *
 * Reusa comprovantes CADESP / Gate 18 já confrontados — não pede documentos
 * de novo. CPA Ferro e Aço e 3Z LTDA = operacionais; Grupo CPA = agrupamento.
 * Linhas extras → quarentena/investigação; neverDelete=true.
 * importAuthorized permanece false. Não toca mapper Cursor #48.
 *
 * Uso:
 *   node scripts/legado/classificar-empresas-api-legado.mjs \
 *     --export fixtures/legado/empresas-api-sinteticas/export-sanitizado.json
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESTINO_CANONICO } from './resolver-vinculo-juridico-legado.mjs';

export const CLASSIFICADOR_EMPRESAS_API_VERSION = '1.0.0';

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

export function normalizarRotulo(value) {
  return text(value)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function ehCpaFerro(row) {
  const n = `${normalizarRotulo(row.nome_fantasia)} ${normalizarRotulo(row.razao_social)}`;
  return n.includes('cpa') && (n.includes('ferro') || n.includes('aco'));
}

function eh3z(row) {
  const n = `${normalizarRotulo(row.nome_fantasia)} ${normalizarRotulo(row.razao_social)}`;
  return /\b3z\b/.test(n) || n.includes('3z ltda');
}

function ehGrupoCpaNome(nome) {
  const n = normalizarRotulo(nome);
  return n.includes('grupo cpa') || n === 'grupo cpa';
}

/**
 * @param {object} exportacao
 */
export function classificarEmpresasApiLegado(exportacao) {
  if (!exportacao || typeof exportacao !== 'object' || Array.isArray(exportacao)) {
    fail('LEGACY_API_EXPORT_INVALID');
  }
  if (exportacao.importAuthorized === true) fail('LEGACY_API_EXPORT_IMPORT_FLAG');

  const groups = Array.isArray(exportacao.groups) ? exportacao.groups : [];
  const empresas = Array.isArray(exportacao.empresas) ? exportacao.empresas : [];
  const linhas = [];
  const porPapel = {
    empresa_operacional: 0,
    agrupamento: 0,
    quarentena: 0,
  };

  for (const g of groups) {
    const agrupamento = ehGrupoCpaNome(g.nome_do_grupo);
    const papel = agrupamento ? 'agrupamento' : 'quarentena';
    porPapel[papel] += 1;
    linhas.push({
      kind: 'group',
      id: text(g.id),
      label: text(g.nome_do_grupo),
      status: text(g.status),
      papel,
      destinoKey: agrupamento ? DESTINO_CANONICO.GRUPO_CPA.destinoKey : null,
      neverDelete: true,
      motivo: agrupamento
        ? 'cadesp_gate18_reusado_grupo_cpa_agrupamento'
        : 'grupo_nao_reconhecido_quarentena',
      cadespRedocumentRequested: false,
    });
  }

  let terceiraInvestigada = false;
  for (const e of empresas) {
    const nomeEmpresaGrupo = ehGrupoCpaNome(e.nome_fantasia) || ehGrupoCpaNome(e.razao_social);
    let papel = 'quarentena';
    let destinoKey = null;
    let motivo = 'empresa_nao_reconhecida_quarentena_sem_apagar';
    if (ehCpaFerro(e)) {
      papel = 'empresa_operacional';
      destinoKey = DESTINO_CANONICO.CPA_FERRO_E_ACO.destinoKey;
      motivo = 'cadesp_gate18_reusado_cpa_ferro_e_aco';
    } else if (eh3z(e)) {
      papel = 'empresa_operacional';
      destinoKey = DESTINO_CANONICO.EMPRESA_3Z_LTDA.destinoKey;
      motivo = 'cadesp_gate18_reusado_3z_ltda';
    } else if (nomeEmpresaGrupo) {
      papel = 'agrupamento';
      destinoKey = DESTINO_CANONICO.GRUPO_CPA.destinoKey;
      motivo = 'terceira_linha_grupo_cpa_agrupamento_nao_apagar';
      terceiraInvestigada = true;
    }
    porPapel[papel] += 1;
    linhas.push({
      kind: 'empresa',
      id: text(e.id),
      group_id: text(e.group_id),
      label: text(e.nome_fantasia) || text(e.razao_social),
      status: text(e.status),
      papel,
      destinoKey,
      neverDelete: true,
      motivo,
      refs: {
        cliente_empresas: Number(e.refs_cliente_empresas) || 0,
        profiles: Number(e.refs_profiles) || 0,
        obra_empresas: Number(e.refs_obra_empresas) || 0,
      },
      cadespRedocumentRequested: false,
    });
  }

  const operacionais = linhas.filter((l) => l.papel === 'empresa_operacional');
  const destinosOp = new Set(operacionais.map((l) => l.destinoKey));
  const duasOperacionais =
    destinosOp.has(DESTINO_CANONICO.CPA_FERRO_E_ACO.destinoKey)
    && destinosOp.has(DESTINO_CANONICO.EMPRESA_3Z_LTDA.destinoKey)
    && operacionais.length >= 2;

  const relatorio = {
    classificadorVersion: CLASSIFICADOR_EMPRESAS_API_VERSION,
    importAuthorized: false,
    operationalLoadAuthorized: false,
    neverDelete: true,
    cadespReused: true,
    cadespRedocumentRequested: false,
    blockedRealApiExport: exportacao.synthetic === true,
    coordenacaoComercial: {
      pr216: true,
      pr217: true,
      ausenciaTelaNaoEImportacao: true,
    },
    counts: {
      groups: groups.length,
      empresas: empresas.length,
      ...porPapel,
      empresasOperacionaisComprovadas: destinosOp.size,
    },
    duasEmpresasOperacionaisIdentificadas: duasOperacionais,
    terceiraLinhaInvestigadaSemApagar: terceiraInvestigada || groups.some((g) => ehGrupoCpaNome(g.nome_do_grupo)),
    linhas,
  };

  relatorio.seloSha256 = createHash('sha256')
    .update(JSON.stringify({
      counts: relatorio.counts,
      papéis: linhas.map((l) => [l.kind, l.papel, l.destinoKey, l.neverDelete]),
    }))
    .digest('hex');

  return relatorio;
}

function parseArgs(argv) {
  const out = { exportPath: '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--export') out.exportPath = argv[++i];
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const exportPath = resolve(text(args.exportPath));
  const exportacao = loadJson(exportPath, 'LEGACY_API_EXPORT_MISSING');
  const relatorio = classificarEmpresasApiLegado(exportacao);
  process.stdout.write(`${JSON.stringify(relatorio, null, 2)}\n`);
  if (!relatorio.duasEmpresasOperacionaisIdentificadas) {
    process.exitCode = 4;
  }
}

const self = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === self) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`${err.code || 'LEGACY_API_CLASSIFY_ERROR'}:${err.message}\n`);
    process.exit(1);
  }
}
