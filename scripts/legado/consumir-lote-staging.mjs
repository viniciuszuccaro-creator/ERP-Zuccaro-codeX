#!/usr/bin/env node
/**
 * Consumidor do lote legado em staging — reutiliza mapear-registro-sintetico + migracaoErpPolicy.
 * Nao le HD real. Nao grava Postgres operacional. Nao duplica mapper.
 *
 * Uso tipico (sintetico / ensaio):
 *   node scripts/legado/consumir-lote-staging.mjs
 *
 * Entrada: rows ja tipadas { entidade, ...campos }.
 * Saida: comprovados / quarentena / rejeicoes / reusos / reconciliacao / auditoria.
 */
import {
  buildReconciliacaoMigracao,
  MIGRACAO_DESTINO_STAGING,
  stampMigracaoRecord,
} from '../../src/components/lib/migracaoErpPolicy.js';
import {
  avaliarQuarentenaLegado,
  buildChaveIdempotenteMigracaoLegado,
  LEGADO_MESTRES_COMPARTILHADOS,
  mapLegadoLoteSintetico,
  mapLegadoRowToCanonicalStub,
  resolverEmpresaLegadoCodigo,
} from './mapear-registro-sintetico.mjs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Ordem de dependencia minima para Produtos / Clientes / Fornecedores. */
export const LEGADO_DEPENDENCIA_ORDEM = Object.freeze([
  'empresa',
  'produto',
  'cliente',
  'fornecedor',
  'obra',
  'condicao_pagamento',
]);
const MESTRES_COMPARTILHADOS = new Set(LEGADO_MESTRES_COMPARTILHADOS);

/**
 * Valida dependencias de um registro mapeado (empresa conhecida, codigo, tenant).
 * Fail-closed: sem empresa_id de destino e sem crosswalk autenticado → não comprova.
 * @param {Record<string, unknown>} mapped
 * @param {{
 *   entidadesDisponiveis?: Set<string>,
 *   chavesEmpresa?: Set<string>,
 *   crosswalkEmpresas?: Record<string, string>|Map<string, string>,
 *   requireContratoEntrada?: boolean,
 * }} ctx
 */
export const validarDependenciasLegado = (mapped = {}, ctx = {}) => {
  const rejeicoes = [];
  const entidade = String(mapped.entidade_migracao || '');
  if (!entidade) rejeicoes.push('entidade_ausente');
  if (!mapped.group_id) rejeicoes.push('group_id_obrigatorio');
  if (!mapped.codigo_legado) rejeicoes.push('codigo_legado_obrigatorio');
  // Destino canônico obrigatório (exceto o próprio cadastro de empresa).
  const mestreGrupo = MESTRES_COMPARTILHADOS.has(entidade) && mapped.scopeType === 'group';
  if (entidade && entidade !== 'empresa' && !mestreGrupo && !mapped.empresa_id && !mapped.target_empresa_id) {
    rejeicoes.push('empresa_destino_obrigatoria');
  }
  if (mestreGrupo && mapped.empresa_id) rejeicoes.push('mestre_grupo_com_empresa');
  if (mapped.codigo_empresa_legado != null && mapped.codigo_empresa_legado !== '') {
    const emp = resolverEmpresaLegadoCodigo(mapped.codigo_empresa_legado);
    if (emp.quarentena || emp.conhecido === false) {
      rejeicoes.push('empresa_legado_nao_resolvida');
    }
    if (!mestreGrupo && ctx.chavesEmpresa instanceof Set && emp.conhecido && !ctx.chavesEmpresa.has(String(emp.codigo))) {
      rejeicoes.push('empresa_destino_ausente_no_lote');
    }
    const crosswalk = ctx.crosswalkEmpresas;
    if (crosswalk && !mestreGrupo) {
      const code = String(emp.codigo || mapped.codigo_empresa_legado);
      const target = crosswalk instanceof Map ? crosswalk.get(code) : crosswalk[code];
      if (!target) rejeicoes.push('crosswalk_empresa_ausente');
    }
  }
  if (ctx.requireContratoEntrada !== false && !ctx.contratoEntradaPresente) {
    rejeicoes.push('contrato_entrada_ausente');
  }
  if (!mestreGrupo && ctx.requireContratoEntrada !== false && !ctx.crosswalkEmpresas) {
    rejeicoes.push('crosswalk_empresa_ausente');
  }
  if (ctx.entidadesDisponiveis instanceof Set && entidade && !ctx.entidadesDisponiveis.has(entidade)) {
    rejeicoes.push('entidade_fora_do_lote');
  }
  return { ok: rejeicoes.length === 0, rejeicoes };
};

/**
 * Envelope de auditoria sanitizado (sem PII/documento completo).
 * @param {Record<string, unknown>} mapped
 * @param {{ acao: string, resultado: string, motivos?: string[] }} meta
 */
export const buildAuditoriaConsumoLegado = (mapped = {}, meta = { acao: 'consumir', resultado: 'ok' }) => ({
  acao: meta.acao,
  resultado: meta.resultado,
  motivos: meta.motivos || [],
  entidade: mapped.entidade_migracao || null,
  group_id: mapped.group_id || null,
  empresa_id: mapped.empresa_id || null,
  codigo_legado: mapped.codigo_legado || null,
  chave_idempotente_migracao: mapped.chave_idempotente_migracao || null,
  destino_migracao: mapped.destino_migracao || MIGRACAO_DESTINO_STAGING,
  importacao_erp: true,
  timestamp: new Date().toISOString(),
});

/**
 * Consome lote sintetico/staging tipado: mapeia, valida deps, separa quarentena/rejeicao,
 * deduplica (idempotencia) e monta reconciliacao + auditoria.
 *
 * @param {Array<Record<string, unknown>>} rows
 * @param {{
 *   entidade?: string,
 *   groupId?: string,
 *   empresaId?: string,
 *   arquivoNome?: string,
 *   chavesJaGravadas?: Array<string|{chave:string,fingerprint:string}>,
 *   contratoEntrada?: { coorte?: string, crosswalkEmpresas?: Record<string, string>, linhagemHash?: string },
 *   produtoClassUnitMap?: Record<string, {tipo_produto:string,unidade_medida_id:string}>,
 *   requireContratoEntrada?: boolean,
 * }} opts
 */
export const consumirLoteStagingLegado = (rows = [], opts = {}) => {
  const entidade = opts.entidade || 'cliente';
  const lote = mapLegadoLoteSintetico(rows, {
    entidade,
    groupId: opts.groupId,
    empresaId: opts.empresaId,
    arquivoNome: opts.arquivoNome || `staging_${entidade}.csv`,
    produtoClassUnitMap: opts.produtoClassUnitMap,
  });

  const chavesPrevias = new Map(
    (opts.chavesJaGravadas || []).map((c) => typeof c === 'string'
      ? [c, ''] : [String(c?.chave || ''), String(c?.fingerprint || '')]).filter(([chave]) => chave),
  );
  const entidadesDisponiveis = new Set(LEGADO_DEPENDENCIA_ORDEM);
  // Codigos legados CPA/3Z conhecidos — crosswalk de IDs de destino vem do contrato.
  const chavesEmpresa = new Set(
    opts.contratoEntrada?.crosswalkEmpresas
      ? Object.keys(opts.contratoEntrada.crosswalkEmpresas)
      : ['1', '2', '3', '5'],
  );
  const crosswalkEmpresas = opts.contratoEntrada?.crosswalkEmpresas || null;
  const requireContratoEntrada = opts.requireContratoEntrada !== false;

  const comprovados = [];
  const quarentena = [];
  const rejeicoes = [...lote.erros, ...lote.conflitos];
  const reusos = [];
  const chavesValidadas = new Set();
  const auditoria = [];

  for (const mapped of lote.gravados) {
    if (mapped.quarentena) {
      quarentena.push({
        codigo_legado: mapped.codigo_legado,
        motivos: mapped.quarentena_motivos,
        chave_idempotente_migracao: mapped.chave_idempotente_migracao,
      });
      auditoria.push(buildAuditoriaConsumoLegado(mapped, {
        acao: 'consumir',
        resultado: 'quarentena',
        motivos: mapped.quarentena_motivos || [],
      }));
      continue;
    }

    const deps = validarDependenciasLegado(mapped, {
      entidadesDisponiveis,
      chavesEmpresa,
      crosswalkEmpresas,
      requireContratoEntrada,
      contratoEntradaPresente: Boolean(opts.contratoEntrada?.coorte),
    });
    if (!deps.ok) {
      const soContrato = deps.rejeicoes.every((r) => r === 'contrato_entrada_ausente' || r === 'crosswalk_empresa_ausente');
      if (soContrato || deps.rejeicoes.includes('contrato_entrada_ausente')) {
        quarentena.push({
          codigo_legado: mapped.codigo_legado,
          motivos: deps.rejeicoes,
          chave_idempotente_migracao: mapped.chave_idempotente_migracao,
        });
        auditoria.push(buildAuditoriaConsumoLegado(mapped, {
          acao: 'consumir',
          resultado: 'quarentena_contrato',
          motivos: deps.rejeicoes,
        }));
        continue;
      }
      rejeicoes.push({
        codigo_legado: mapped.codigo_legado,
        rejeicoes: deps.rejeicoes,
        chave_idempotente_migracao: mapped.chave_idempotente_migracao,
      });
      auditoria.push(buildAuditoriaConsumoLegado(mapped, {
        acao: 'consumir',
        resultado: 'rejeitado',
        motivos: deps.rejeicoes,
      }));
      continue;
    }

    if (chavesPrevias.has(mapped.chave_idempotente_migracao)) {
      const anterior = chavesPrevias.get(mapped.chave_idempotente_migracao);
      if (!anterior || anterior !== mapped.fingerprint_migracao) {
        quarentena.push({ codigo_legado: mapped.codigo_legado,
          motivos: ['reuso_sem_fingerprint_igual'],
          chave_idempotente_migracao: mapped.chave_idempotente_migracao });
        auditoria.push(buildAuditoriaConsumoLegado(mapped, {
          acao: 'consumir', resultado: 'conflito_reuso', motivos: ['reuso_sem_fingerprint_igual'],
        }));
        continue;
      }
      reusos.push({
        codigo_legado: mapped.codigo_legado,
        chave_idempotente_migracao: mapped.chave_idempotente_migracao,
        motivo: 'idempotente_ja_consumido',
      });
      chavesValidadas.add(mapped.chave_idempotente_migracao);
      auditoria.push(buildAuditoriaConsumoLegado(mapped, {
        acao: 'consumir',
        resultado: 'reuso_idempotente',
        motivos: ['chave_ja_presente'],
      }));
      continue;
    }

    comprovados.push(mapped);
    chavesValidadas.add(mapped.chave_idempotente_migracao);
    chavesPrevias.set(mapped.chave_idempotente_migracao, mapped.fingerprint_migracao);
    auditoria.push(buildAuditoriaConsumoLegado(mapped, {
      acao: 'consumir',
      resultado: 'comprovado_staging',
    }));
  }

  // Duplicata so e reuso quando sua raiz passou pelos mesmos gates de entrada.
  for (const dup of lote.reusos) {
    if (chavesValidadas.has(dup.chave_idempotente_migracao)) reusos.push(dup);
    else quarentena.push({ codigo_legado: dup.codigo_legado,
      chave_idempotente_migracao: dup.chave_idempotente_migracao,
      motivos: ['reuso_origem_nao_validada'] });
  }

  const reconciliacao = buildReconciliacaoMigracao({
    origem: rows,
    gravados: comprovados,
    reusos,
    campoValor: 'valor',
  });

  return {
    entidade,
    destino_migracao: MIGRACAO_DESTINO_STAGING,
    importacao_erp: true,
    importado_operacional: false,
    contrato_entrada: Boolean(opts.contratoEntrada?.coorte),
    coorte: opts.contratoEntrada?.coorte || null,
    comprovados,
    quarentena,
    rejeicoes,
    reusos,
    reconciliacao,
    auditoria,
    totais: {
      origem: rows.length,
      comprovados: comprovados.length,
      quarentena: quarentena.length,
      rejeicoes: rejeicoes.length,
      reusos: reusos.length,
    },
  };
};

/**
 * Segunda passagem idempotente: mesmos rows nao duplicam comprovados.
 */
export const consumirLoteStagingIdempotente = (rows = [], opts = {}) => {
  const primeiro = consumirLoteStagingLegado(rows, opts);
  const segundo = consumirLoteStagingLegado(rows, {
    ...opts,
    chavesJaGravadas: primeiro.comprovados.map((r) => ({
      chave: r.chave_idempotente_migracao, fingerprint: r.fingerprint_migracao,
    })),
  });
  return { primeiro, segundo };
};

export {
  avaliarQuarentenaLegado,
  buildChaveIdempotenteMigracaoLegado,
  mapLegadoRowToCanonicalStub,
  stampMigracaoRecord,
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sample = [
    {
      cod_cliente: 'C-OK',
      razao_social: 'Cliente Sintetico OK',
      cnpj: '00000000000191',
      group_id: 'g1',
      empresa_id: 'e1',
      codigo_empresa: '1',
      valor: 10,
    },
    {
      cod_cliente: 'C-OK',
      razao_social: 'Cliente Sintetico OK dup',
      group_id: 'g1',
      empresa_id: 'e1',
      codigo_empresa: '1',
      valor: 10,
    },
    {
      cod_cliente: 'C-0',
      nome: 'Quarentena',
      group_id: 'g1',
      empresa_id: 'e1',
      codigo_empresa: '0',
      valor: 1,
    },
  ];
  const { primeiro, segundo } = consumirLoteStagingIdempotente(sample, {
    entidade: 'cliente',
    arquivoNome: 'demo_consumo.csv',
    contratoEntrada: {
      coorte: 'sintetico-demo',
      crosswalkEmpresas: { 1: 'e1', 2: 'e1', 3: 'e1', 5: 'e1' },
    },
  });
  const out = {
    importado_operacional: false,
    primeiro: primeiro.totais,
    segundo: segundo.totais,
    auditoria_primeiro: primeiro.auditoria.length,
    reconciliacao: primeiro.reconciliacao,
  };
  console.log(JSON.stringify(out, null, 2));
  if (segundo.comprovados.length !== 0) {
    console.error('BLOCKED: segunda passagem gerou comprovados novos');
    process.exit(1);
  }
}
