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
  mapLegadoLoteSintetico,
  mapLegadoRowToCanonicalStub,
  resolverEmpresaLegadoCodigo,
} from './mapear-registro-sintetico.mjs';

/** Ordem de dependencia minima para Produtos / Clientes / Fornecedores. */
export const LEGADO_DEPENDENCIA_ORDEM = Object.freeze([
  'empresa',
  'produto',
  'cliente',
  'fornecedor',
  'obra',
  'condicao_pagamento',
]);

/**
 * Valida dependencias de um registro mapeado (empresa conhecida, codigo, tenant).
 * @param {Record<string, unknown>} mapped
 * @param {{ entidadesDisponiveis?: Set<string>, chavesEmpresa?: Set<string> }} ctx
 */
export const validarDependenciasLegado = (mapped = {}, ctx = {}) => {
  const rejeicoes = [];
  const entidade = String(mapped.entidade_migracao || '');
  if (!entidade) rejeicoes.push('entidade_ausente');
  if (!mapped.group_id) rejeicoes.push('group_id_obrigatorio');
  if (!mapped.codigo_legado) rejeicoes.push('codigo_legado_obrigatorio');
  if (mapped.codigo_empresa_legado != null && mapped.codigo_empresa_legado !== '') {
    const emp = resolverEmpresaLegadoCodigo(mapped.codigo_empresa_legado);
    if (emp.quarentena || emp.conhecido === false) {
      rejeicoes.push('empresa_legado_nao_resolvida');
    }
    if (ctx.chavesEmpresa instanceof Set && emp.conhecido && !ctx.chavesEmpresa.has(String(emp.codigo))) {
      rejeicoes.push('empresa_destino_ausente_no_lote');
    }
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
 *   chavesJaGravadas?: string[],
 * }} opts
 */
export const consumirLoteStagingLegado = (rows = [], opts = {}) => {
  const entidade = opts.entidade || 'cliente';
  const lote = mapLegadoLoteSintetico(rows, {
    entidade,
    groupId: opts.groupId,
    empresaId: opts.empresaId,
    arquivoNome: opts.arquivoNome || `staging_${entidade}.csv`,
  });

  const chavesPrevias = new Set(
    (opts.chavesJaGravadas || []).map((c) => String(c)).filter(Boolean),
  );
  const entidadesDisponiveis = new Set(LEGADO_DEPENDENCIA_ORDEM);
  const chavesEmpresa = new Set(['1', '2', '3', '5']);

  const comprovados = [];
  const quarentena = [];
  const rejeicoes = [...lote.erros];
  const reusos = [...lote.reusos];
  const auditoria = [];

  for (const mapped of lote.gravados) {
    if (chavesPrevias.has(mapped.chave_idempotente_migracao)) {
      reusos.push({
        codigo_legado: mapped.codigo_legado,
        chave_idempotente_migracao: mapped.chave_idempotente_migracao,
        motivo: 'idempotente_ja_consumido',
      });
      auditoria.push(buildAuditoriaConsumoLegado(mapped, {
        acao: 'consumir',
        resultado: 'reuso_idempotente',
        motivos: ['chave_ja_presente'],
      }));
      continue;
    }

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

    const deps = validarDependenciasLegado(mapped, { entidadesDisponiveis, chavesEmpresa });
    if (!deps.ok) {
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

    comprovados.push(mapped);
    chavesPrevias.add(mapped.chave_idempotente_migracao);
    auditoria.push(buildAuditoriaConsumoLegado(mapped, {
      acao: 'consumir',
      resultado: 'comprovado_staging',
    }));
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
    chavesJaGravadas: primeiro.comprovados.map((r) => r.chave_idempotente_migracao),
  });
  return { primeiro, segundo };
};

export {
  avaliarQuarentenaLegado,
  buildChaveIdempotenteMigracaoLegado,
  mapLegadoRowToCanonicalStub,
  stampMigracaoRecord,
};

if (process.argv[1] && process.argv[1].includes('consumir-lote-staging')) {
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
