#!/usr/bin/env node
/**
 * Mapeia um registro sintético legado → campos canônicos de migração.
 * Não lê HD real. Não grava staging. Reutiliza migracaoErpPolicy (Regra-Mãe).
 */
import {
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
 * @param {Record<string, unknown>} row
 * @param {{ entidade?: 'cliente'|'produto', groupId?: string, empresaId?: string, arquivoNome?: string }} opts
 */
export const mapLegadoRowToCanonicalStub = (row = {}, opts = {}) => {
  const entidade = opts.entidade || 'cliente';
  const aliases = LEGADO_FIELD_ALIASES[entidade];
  if (!aliases) {
    throw new Error(`Entidade de mapeamento nao suportada: ${entidade}`);
  }

  const codigo = pickAlias(row, aliases.codigo);
  const nomeOuDesc = entidade === 'cliente'
    ? pickAlias(row, aliases.nome)
    : pickAlias(row, aliases.descricao);
  const documento = entidade === 'cliente' ? pickAlias(row, aliases.documento) : '';

  if (!codigo && !nomeOuDesc) {
    throw new Error('Registro sintetico sem codigo nem nome/descricao mapeavel.');
  }

  const base = stripSegredosMigracao({
    group_id: first(opts.groupId, row.group_id, row.grupo_id),
    empresa_id: first(opts.empresaId, row.empresa_id),
    codigo_legado: codigo,
    id_antigo: codigo,
    ...(entidade === 'cliente'
      ? { nome: nomeOuDesc, documento: documento || undefined }
      : { descricao: nomeOuDesc }),
    origem: 'erp_antigo',
  });

  return stampMigracaoRecord(base, {
    arquivoNome: opts.arquivoNome || 'sintetico.csv',
    entidade,
    confirmado: false,
    destino: 'staging',
  });
};

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
  || process.argv[1]?.endsWith('mapear-registro-sintetico.mjs');

if (process.argv[1] && process.argv[1].includes('mapear-registro-sintetico')) {
  const sample = {
    cod_cliente: 'C-100',
    razao_social: 'Cliente Sintetico LTDA',
    cnpj: '00000000000191',
    senha: 'NAO_DEVE_SAIR',
    group_id: 'g-sint',
    empresa_id: 'e-sint',
  };
  const out = mapLegadoRowToCanonicalStub(sample, {
    entidade: 'cliente',
    arquivoNome: 'clientes_sintetico.csv',
  });
  if (out.senha) {
    console.error('BLOCKED: segredo vazou no mapeamento');
    process.exit(1);
  }
  console.log(JSON.stringify({
    codigo_legado: out.codigo_legado,
    nome: out.nome,
    destino_migracao: out.destino_migracao,
    origem_migracao: out.origem_migracao,
    importacao_erp: out.importacao_erp,
  }));
}
