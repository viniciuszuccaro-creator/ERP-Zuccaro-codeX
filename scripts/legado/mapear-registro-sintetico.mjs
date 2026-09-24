#!/usr/bin/env node
/**
 * Mapeia um registro sintético legado → campos canônicos de migração.
 * Não lê HD real. Não grava staging. Reutiliza migracaoErpPolicy (Regra-Mãe).
 */
import {
  buildReconciliacaoMigracao,
  findRegistroMigracaoDuplicado,
  MIGRACAO_DESTINO_STAGING,
  MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION,
  stampMigracaoRecord,
  stripSegredosMigracao,
} from '../../src/components/lib/migracaoErpPolicy.js';

/** Aliases comuns de planilhas/ERP antigo → campo canônico (hipótese até inventário). */
export const LEGADO_FIELD_ALIASES = Object.freeze({
  cliente: {
    codigo: ['codigo', 'cod_cliente', 'codigo_cliente', 'id_cliente', 'codigo_legado'],
    nome: ['nome', 'razao_social', 'nome_cliente', 'descricao'],
    documento: ['documento', 'cpf_cnpj', 'cnpj', 'cpf', 'cgc'],
  },
  produto: {
    codigo: ['codigo', 'cod_produto', 'sku', 'codigo_legado'],
    descricao: ['descricao', 'nome', 'produto'],
  },
  empresa: {
    codigo: ['codigo', 'cod_empresa', 'codigo_empresa', 'codigoempresa', 'codigo_legado'],
    nome: ['nome', 'razao_social', 'nome_empresa', 'descricao'],
    documento: ['documento', 'cnpj', 'cgc', 'cpf_cnpj'],
  },
  obra: {
    codigo: ['codigo', 'cod_obra', 'codigo_obra', 'obra_id', 'codigo_legado'],
    nome: ['nome', 'nome_obra', 'descricao', 'titulo'],
  },
  condicao_pagamento: {
    codigo: ['codigo', 'cod_condicao', 'codigo_condicao', 'condicao_id', 'codigo_legado'],
    nome: ['nome', 'descricao', 'condicao', 'titulo'],
  },
});

/** Códigos empresariais legados válidos conhecidos (Gate 18); `0` = quarentena. */
export const LEGADO_EMPRESA_CODIGOS_VALIDOS = Object.freeze(['1', '2', '3', '4', '5']);

/**
 * Rótulos públicos já documentados no STATUS (Gate 18) — sem CNPJ/PII.
 * Uso: staging sintético / conciliação; não autoriza importação.
 */
export const LEGADO_EMPRESA_CODIGO_MAP = Object.freeze({
  1: { label: 'CPA_Central_Paulista', ativo: true },
  2: { label: '3Z_Armacao', ativo: true },
  3: { label: 'Grupo_CPA', ativo: true },
  4: { label: 'Belgo_Cercas', ativo: false },
  5: { label: 'Zuccaro_Comercio_Ferragens', ativo: true },
});

/**
 * @param {unknown} codigo
 * @returns {{ codigo: string, label?: string, ativo?: boolean, conhecido: boolean } | { codigo: string, conhecido: false, quarentena: true }}
 */
export const resolverEmpresaLegadoCodigo = (codigo) => {
  const c = String(codigo ?? '').trim();
  if (!c) return { codigo: '', conhecido: false };
  if (c === '0') return { codigo: '0', conhecido: false, quarentena: true };
  const hit = LEGADO_EMPRESA_CODIGO_MAP[c];
  if (!hit) return { codigo: c, conhecido: false };
  return { codigo: c, label: hit.label, ativo: hit.ativo, conhecido: true };
};
const first = (...vals) => {
  for (const v of vals) {
    const t = String(v ?? '').trim();
    if (t) return t;
  }
  return '';
};

const pickAlias = (row, aliases = []) => {
  const lower = Object.fromEntries(
    Object.entries(row || {}).map(([k, v]) => [String(k).toLowerCase(), v]),
  );
  for (const key of aliases) {
    if (lower[key] != null && String(lower[key]).trim() !== '') {
      return lower[key];
    }
  }
  return '';
};

/**
 * Chave idempotente canônica (Gate 18 / rascunho legado):
 * group_id|empresa_id|origem|entidade|codigo_legado
 * @param {Record<string, unknown>} record
 * @param {{ entidade?: string }} opts
 */
export const buildChaveIdempotenteMigracaoLegado = (record = {}, opts = {}) => {
  const groupId = first(record.group_id, record.grupo_id);
  const empresaId = first(record.empresa_id);
  const origem = first(record.origem_migracao, record.origem, 'erp_antigo') || 'erp_antigo';
  const entidade = first(opts.entidade, record.entidade_migracao, 'registro') || 'registro';
  const legado = first(record.codigo_legado, record.id_antigo);
  if (!groupId || !legado) {
    throw new Error('Chave idempotente exige group_id e codigo_legado.');
  }
  return [groupId, empresaId || 'grupo', origem, entidade, legado].join('|');
};

/**
 * Avalia quarentena sem importar (código empresa 0, entidade sem nome, etc.).
 * @param {Record<string, unknown>} row
 * @param {{ entidade?: string }} opts
 * @returns {{ quarentena: boolean, motivos: string[] }}
 */
export const avaliarQuarentenaLegado = (row = {}, opts = {}) => {
  const motivos = [];
  const entidade = opts.entidade || 'cliente';
  const codigoEmpresa = first(
    row.codigo_empresa,
    row.codigoempresa,
    row.cod_empresa,
    row.empresa_codigo,
  );
  if (codigoEmpresa === '0') {
    motivos.push('codigo_empresa_legado_0');
  }
  if (codigoEmpresa && !LEGADO_EMPRESA_CODIGOS_VALIDOS.includes(codigoEmpresa) && codigoEmpresa !== '0') {
    motivos.push('codigo_empresa_legado_desconhecido');
  }
  if (codigoEmpresa && LEGADO_EMPRESA_CODIGO_MAP[codigoEmpresa]?.ativo === false) {
    motivos.push('codigo_empresa_legado_inativa');
  }
  if (entidade === 'empresa') {
    const aliases = LEGADO_FIELD_ALIASES.empresa;
    const doc = pickAlias(row, aliases.documento);
    if (!doc) motivos.push('empresa_sem_documento');
  }
  return { quarentena: motivos.length > 0, motivos };
};

/**
 * @param {Record<string, unknown>} row
 * @param {{ entidade?: keyof typeof LEGADO_FIELD_ALIASES, groupId?: string, empresaId?: string, arquivoNome?: string }} opts
 */
export const mapLegadoRowToCanonicalStub = (row = {}, opts = {}) => {
  const entidade = opts.entidade || 'cliente';
  const aliases = LEGADO_FIELD_ALIASES[entidade];
  if (!aliases) {
    throw new Error(`Entidade de mapeamento nao suportada: ${entidade}`);
  }

  const codigo = pickAlias(row, aliases.codigo);
  const nomeOuDesc = entidade === 'produto'
    ? pickAlias(row, aliases.descricao)
    : pickAlias(row, aliases.nome);
  const documento = (entidade === 'cliente' || entidade === 'empresa')
    ? pickAlias(row, aliases.documento)
    : '';

  if (!codigo && !nomeOuDesc) {
    throw new Error('Registro sintetico sem codigo nem nome/descricao mapeavel.');
  }

  const q = avaliarQuarentenaLegado(row, { entidade });
  const codigoEmpresaLegado = first(
    row.codigo_empresa,
    row.codigoempresa,
    row.cod_empresa,
    row.empresa_codigo,
  );
  const empresaLegado = codigoEmpresaLegado
    ? resolverEmpresaLegadoCodigo(codigoEmpresaLegado)
    : null;

  const base = stripSegredosMigracao({
    group_id: first(opts.groupId, row.group_id, row.grupo_id),
    empresa_id: first(opts.empresaId, row.empresa_id),
    codigo_legado: codigo,
    id_antigo: codigo,
    ...(empresaLegado
      ? {
        codigo_empresa_legado: empresaLegado.codigo,
        empresa_legado_label: empresaLegado.label,
        empresa_legado_conhecida: empresaLegado.conhecido === true,
      }
      : {}),
    ...(entidade === 'produto'
      ? { descricao: nomeOuDesc }
      : { nome: nomeOuDesc, ...(documento ? { documento } : {}) }),
    origem: 'erp_antigo',
    ...(q.quarentena
      ? {
        status_migracao: MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION,
        requer_conciliacao_manual: true,
        quarentena_motivos: q.motivos,
      }
      : {}),
  });

  const stamped = stampMigracaoRecord(base, {
    arquivoNome: opts.arquivoNome || 'sintetico.csv',
    entidade,
    confirmado: false,
    destino: MIGRACAO_DESTINO_STAGING,
  });

  return {
    ...stamped,
    entidade_migracao: entidade,
    quarentena: q.quarentena,
    quarentena_motivos: q.motivos,
    chave_idempotente_migracao: buildChaveIdempotenteMigracaoLegado(stamped, { entidade }),
  };
};

/**
 * Mapeia lote sintético: carimba staging, detecta duplicata e monta reconciliação.
 * Não grava. Não lê HD.
 * @param {Array<Record<string, unknown>>} rows
 * @param {{ entidade?: keyof typeof LEGADO_FIELD_ALIASES, groupId?: string, empresaId?: string, arquivoNome?: string }} opts
 */
export const mapLegadoLoteSintetico = (rows = [], opts = {}) => {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) {
    throw new Error('Lote sintetico vazio.');
  }

  const mapped = [];
  const reusos = [];
  const erros = [];
  const quarentenas = [];

  for (let i = 0; i < list.length; i += 1) {
    try {
      const out = mapLegadoRowToCanonicalStub(list[i], opts);
      const dup = findRegistroMigracaoDuplicado(out, mapped);
      if (dup) {
        reusos.push({
          indice: i,
          codigo_legado: out.codigo_legado,
          chave_idempotente_migracao: out.chave_idempotente_migracao,
          reuso_de: dup.chave_idempotente_migracao,
        });
        continue;
      }
      if (out.quarentena) {
        quarentenas.push({
          indice: i,
          codigo_legado: out.codigo_legado,
          motivos: out.quarentena_motivos,
          chave_idempotente_migracao: out.chave_idempotente_migracao,
        });
      }
      mapped.push(out);
    } catch (err) {
      erros.push({ indice: i, erro: String(err?.message || err) });
    }
  }

  const reconciliacao = buildReconciliacaoMigracao({
    origem: list,
    gravados: mapped,
    reusos,
    campoValor: 'valor',
  });

  return {
    entidade: opts.entidade || 'cliente',
    destino_migracao: MIGRACAO_DESTINO_STAGING,
    importacao_erp: true,
    gravados: mapped,
    reusos,
    erros,
    quarentenas,
    reconciliacao,
    chaves: mapped.map((r) => r.chave_idempotente_migracao),
  };
};

if (process.argv[1] && process.argv[1].includes('mapear-registro-sintetico')) {
  const sampleRows = [
    {
      cod_cliente: 'C-100',
      razao_social: 'Cliente Sintetico LTDA',
      cnpj: '00000000000191',
      senha: 'NAO_DEVE_SAIR',
      group_id: 'g-sint',
      empresa_id: 'e-sint',
      codigo_empresa: '1',
    },
    {
      cod_cliente: 'C-100',
      razao_social: 'Cliente Sintetico LTDA (dup)',
      group_id: 'g-sint',
      empresa_id: 'e-sint',
      codigo_empresa: '1',
    },
    {
      cod_cliente: 'C-0',
      nome: 'Quarentena',
      group_id: 'g-sint',
      empresa_id: 'e-sint',
      codigo_empresa: '0',
    },
  ];
  const lote = mapLegadoLoteSintetico(sampleRows, {
    entidade: 'cliente',
    arquivoNome: 'clientes_sintetico.csv',
  });
  if (lote.gravados.some((r) => r.senha)) {
    console.error('BLOCKED: segredo vazou no mapeamento');
    process.exit(1);
  }
  console.log(JSON.stringify({
    gravados: lote.gravados.length,
    reusos: lote.reusos.length,
    quarentenas: lote.quarentenas.length,
    divergencia: lote.reconciliacao.divergencia_quantidade,
    chave: lote.chaves[0],
    destino_migracao: lote.destino_migracao,
  }));
}
