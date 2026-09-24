#!/usr/bin/env node
/**
 * Mapeia um registro sintético legado → campos canônicos de migração.
 * Não lê HD real. Não grava staging. Reutiliza migracaoErpPolicy (Regra-Mãe).
 */
import {
  buildReconciliacaoMigracao,
  findRegistroMigracaoDuplicado,
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
});

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
 * @param {Record<string, unknown>} row
 * @param {{ entidade?: 'cliente'|'produto'|'empresa', groupId?: string, empresaId?: string, arquivoNome?: string }} opts
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

  const base = stripSegredosMigracao({
    group_id: first(opts.groupId, row.group_id, row.grupo_id),
    empresa_id: first(opts.empresaId, row.empresa_id),
    codigo_legado: codigo,
    id_antigo: codigo,
    ...(entidade === 'produto'
      ? { descricao: nomeOuDesc }
      : { nome: nomeOuDesc, documento: documento || undefined }),
    origem: 'erp_antigo',
  });

  const stamped = stampMigracaoRecord(base, {
    arquivoNome: opts.arquivoNome || 'sintetico.csv',
    entidade,
    confirmado: false,
    destino: 'staging',
  });

  return {
    ...stamped,
    entidade_migracao: entidade,
    chave_idempotente_migracao: buildChaveIdempotenteMigracaoLegado(stamped, { entidade }),
  };
};

/**
 * Mapeia lote sintético: carimba staging, detecta duplicata e monta reconciliação.
 * Não grava. Não lê HD.
 * @param {Array<Record<string, unknown>>} rows
 * @param {{ entidade?: 'cliente'|'produto'|'empresa', groupId?: string, empresaId?: string, arquivoNome?: string }} opts
 */
export const mapLegadoLoteSintetico = (rows = [], opts = {}) => {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) {
    throw new Error('Lote sintetico vazio.');
  }

  const mapped = [];
  const reusos = [];
  const erros = [];

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
    destino_migracao: 'staging',
    importacao_erp: true,
    gravados: mapped,
    reusos,
    erros,
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
    },
    {
      cod_cliente: 'C-100',
      razao_social: 'Cliente Sintetico LTDA (dup)',
      group_id: 'g-sint',
      empresa_id: 'e-sint',
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
    divergencia: lote.reconciliacao.divergencia_quantidade,
    chave: lote.chaves[0],
    destino_migracao: lote.destino_migracao,
  }));
}
