#!/usr/bin/env node
/**
 * Mapeia um registro sintético legado → campos canônicos de migração.
 * Não lê HD real. Não grava staging. Não prova vínculo jurídico sozinho.
 * Escopo canônico sai do contrato em resolver-escopo-legado.mjs.
 */
import {
  buildReconciliacaoMigracao,
  MIGRACAO_DESTINO_STAGING,
  MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION,
  stampMigracaoRecord,
  stripSegredosMigracao,
} from '../../src/components/lib/migracaoErpPolicy.js';
import {
  avaliarEscopoLegado,
  ehProdutoRevendaLegado,
  LEGADO_EMPRESA_CODIGO_MAP,
  LEGADO_EMPRESA_CODIGOS_VALIDOS,
  LEGADO_ENTIDADES_EXCLUIDAS,
  pickAliasLegado,
  resolverEmpresaLegadoCodigo,
  snapshotLinhaLegado,
} from './resolver-escopo-legado.mjs';

export {
  avaliarEscopoLegado,
  LEGADO_EMPRESA_CODIGO_MAP,
  LEGADO_EMPRESA_CODIGOS_VALIDOS,
  resolverEmpresaLegadoCodigo,
};

/** Aliases comuns de planilhas/ERP antigo → campo canônico (hipótese até inventário). */
export const LEGADO_FIELD_ALIASES = Object.freeze({
  cliente: {
    codigo: ['codigo', 'cod_cliente', 'codigo_cliente', 'id_cliente', 'codigo_legado'],
    nome: ['nome', 'razao_social', 'nome_cliente', 'descricao'],
    documento: ['documento', 'cpf_cnpj', 'cnpj', 'cpf', 'cgc'],
  },
  fornecedor: {
    codigo: ['codigo', 'cod_fornecedor', 'codigo_fornecedor', 'id_fornecedor', 'codigo_legado'],
    nome: ['nome', 'razao_social', 'nome_fornecedor', 'descricao'],
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
  /** Hipótese até inventário HD — destino `tabelas_preco` (migration 013). Sem preços reais no GitHub. */
  tabela_preco: {
    codigo: ['codigo', 'cod_tabela', 'codigo_tabela', 'codigo_tabela_legado', 'tabela_id', 'codigo_legado'],
    nome: ['nome', 'descricao', 'tabela', 'titulo', 'nome_tabela'],
  },
  /** Hipótese até inventário HD — destino agregado Pedido (017). Sem valores monetários reais. */
  pedido: {
    codigo: ['codigo', 'cod_pedido', 'numero_pedido', 'numero', 'pedido_id', 'codigo_legado'],
    nome: ['nome', 'descricao', 'referencia', 'titulo'],
  },
  /** Hipótese até inventário HD — destino agregado Orçamento (016). */
  orcamento: {
    codigo: ['codigo', 'cod_orcamento', 'numero_orcamento', 'numero', 'orcamento_id', 'codigo_legado'],
    nome: ['nome', 'descricao', 'referencia', 'titulo'],
  },
  estoque: {
    codigo: ['codigo', 'cod_estoque', 'codigo_estoque', 'codigo_legado'],
    nome: ['nome', 'descricao', 'referencia', 'titulo'],
  },
  contas_receber: {
    codigo: ['codigo', 'cod_titulo', 'numero_titulo', 'codigo_legado'],
    nome: ['nome', 'descricao', 'referencia', 'titulo'],
  },
  contas_pagar: {
    codigo: ['codigo', 'cod_titulo', 'numero_titulo', 'codigo_legado'],
    nome: ['nome', 'descricao', 'referencia', 'titulo'],
  },
  nota_fiscal: {
    codigo: ['codigo', 'numero_nota', 'numero_nf', 'codigo_legado'],
    nome: ['nome', 'descricao', 'referencia', 'titulo'],
  },
});

const first = (...vals) => {
  for (const v of vals) {
    const t = String(v ?? '').trim();
    if (t) return t;
  }
  return '';
};

const semVazios = (record) => Object.fromEntries(
  Object.entries(record).filter(([, value]) => value !== undefined && value !== ''),
);

/**
 * Chave idempotente. Escopo rejeitado não usa group/empresa canônicos do opts.
 * Mestre aceito: group_id|grupo|origem|entidade|codigo_legado
 * Operação aceita: group_id|empresa_id|origem|entidade|codigo_legado
 * @param {Record<string, unknown>} record
 * @param {{ entidade?: string }} opts
 */
export const buildChaveIdempotenteMigracaoLegado = (record = {}, opts = {}) => {
  const legado = first(record.codigo_legado, record.id_antigo);
  const entidade = first(opts.entidade, record.entidade_migracao, 'registro') || 'registro';
  if (!legado) throw new Error('Chave idempotente exige codigo_legado.');
  if (record.escopo_aceito !== true) {
    return [
      'QX',
      first(record.group_id_contexto, 'sem-contexto'),
      first(record.group_id_payload, 'sem-payload'),
      entidade,
      legado,
    ].join('|');
  }
  const groupId = first(record.group_id, record.grupo_id);
  if (!groupId) throw new Error('Chave idempotente exige group_id e codigo_legado.');
  const empresaId = first(record.empresa_id) || 'grupo';
  const origem = first(record.origem_migracao, record.origem, 'erp_antigo') || 'erp_antigo';
  return [groupId, empresaId, origem, entidade, legado].join('|');
};

/**
 * Avalia quarentena sem importar.
 * @param {Record<string, unknown>} row
 * @param {{ entidade?: string, groupId?: string, empresaId?: string, vinculosComprovados?: object }} opts
 */
export const avaliarQuarentenaLegado = (row = {}, opts = {}) => {
  const entidade = opts.entidade || 'cliente';
  const escopo = avaliarEscopoLegado(snapshotLinhaLegado(row), { ...opts, entidade });
  const motivos = [...escopo.motivos];
  if (entidade === 'empresa') {
    const doc = pickAliasLegado(row, LEGADO_FIELD_ALIASES.empresa.documento);
    if (!doc) motivos.push('empresa_sem_documento');
  }
  return {
    quarentena: motivos.length > 0,
    motivos: [...new Set(motivos)],
    escopo,
  };
};

const classificarExclusao = (entidade, row) => {
  if (LEGADO_ENTIDADES_EXCLUIDAS.includes(entidade)) return 'usuario_legado_excluido';
  if (entidade === 'produto' && !ehProdutoRevendaLegado(row)) return 'produto_nao_revenda';
  return '';
};

/**
 * @param {Record<string, unknown>} row
 * @param {{ entidade?: keyof typeof LEGADO_FIELD_ALIASES, groupId?: string, empresaId?: string, arquivoNome?: string, codigoEntidade?: string, vinculosComprovados?: object }} opts
 */
export const mapLegadoRowToCanonicalStub = (row = {}, opts = {}) => {
  const entidade = opts.entidade || 'cliente';
  const linha = snapshotLinhaLegado(row);
  const exclusao = classificarExclusao(entidade, linha);
  if (exclusao) throw new Error(exclusao);

  const aliases = LEGADO_FIELD_ALIASES[entidade];
  if (!aliases) throw new Error(`Entidade de mapeamento nao suportada: ${entidade}`);

  const codigo = String(pickAliasLegado(linha, aliases.codigo) ?? '').trim();
  const nomeOuDesc = String(entidade === 'produto'
    ? pickAliasLegado(linha, aliases.descricao)
    : pickAliasLegado(linha, aliases.nome) ?? '').trim();
  const documento = (entidade === 'cliente' || entidade === 'empresa' || entidade === 'fornecedor')
    ? String(pickAliasLegado(linha, aliases.documento) ?? '').trim()
    : '';

  if (!codigo && !nomeOuDesc) {
    throw new Error('Registro sintetico sem codigo nem nome/descricao mapeavel.');
  }

  const q = avaliarQuarentenaLegado(linha, {
    ...opts,
    entidade,
    codigoEntidade: codigo,
  });
  const escopo = q.escopo;
  const classificado = resolverEmpresaLegadoCodigo(
    escopo.codigo_empresa_legado || (escopo.grupo_no_campo_empresa ? '003' : ''),
  );

  const base = stripSegredosMigracao(semVazios({
    group_id: escopo.aceito ? escopo.group_id : '',
    empresa_id: escopo.aceito ? escopo.empresa_id : '',
    group_id_contexto: escopo.group_id_contexto,
    group_id_payload: escopo.group_id_payload,
    empresa_id_contexto: escopo.empresa_id_contexto,
    empresa_id_payload: escopo.empresa_id_payload,
    codigo_legado: codigo,
    id_antigo: codigo,
    codigo_empresa_legado: escopo.codigo_empresa_legado,
    codigo_grupo_legado: escopo.codigo_grupo_legado,
    codigo_tipo_nota_legado: escopo.codigo_tipo_nota_legado,
    empresa_legado_label: classificado.label,
    empresa_legado_papel: classificado.papel,
    empresa_legado_conhecida: classificado.conhecido === true,
    comprovado_juridico: escopo.comprovado_juridico === true,
    escopo_aceito: escopo.aceito === true,
    escopo_mestre: escopo.escopo_mestre,
    visivel_consolidado_grupo: escopo.visivel_consolidado_grupo === true,
    duplicacao_fisica: false,
    ...(entidade === 'produto' ? { descricao: nomeOuDesc } : { nome: nomeOuDesc }),
    ...(documento ? { documento } : {}),
    origem: 'erp_antigo',
    ...(q.quarentena
      ? {
        status_migracao: MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION,
        requer_conciliacao_manual: true,
        quarentena_motivos: q.motivos,
      }
      : {}),
  }));

  const stamped = stampMigracaoRecord(base, {
    arquivoNome: opts.arquivoNome || 'sintetico.csv',
    entidade,
    confirmado: false,
    destino: MIGRACAO_DESTINO_STAGING,
  });

  return {
    ...stamped,
    entidade_migracao: entidade,
    escopo_aceito: escopo.aceito === true,
    quarentena: q.quarentena,
    quarentena_motivos: q.motivos,
    duplicacao_fisica: false,
    chave_idempotente_migracao: buildChaveIdempotenteMigracaoLegado(stamped, { entidade }),
  };
};

const mesmaChave = (record, records) => {
  const chave = first(record.chave_idempotente_migracao);
  if (!chave) return null;
  return (Array.isArray(records) ? records : []).find((item) => (
    first(item?.chave_idempotente_migracao) === chave
  )) || null;
};

/**
 * Mapeia lote sintético. Retry contra indiceStaging reusa a chave; não republica.
 * Não grava. Não lê HD.
 * @param {Array<Record<string, unknown>>} rows
 * @param {{ entidade?: keyof typeof LEGADO_FIELD_ALIASES, groupId?: string, empresaId?: string, arquivoNome?: string, vinculosComprovados?: object, indiceStaging?: Array<Record<string, unknown>> }} opts
 */
export const mapLegadoLoteSintetico = (rows = [], opts = {}) => {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) throw new Error('Lote sintetico vazio.');

  const mapped = [];
  const reusos = [];
  const erros = [];
  const quarentenas = [];
  const excluidos = [];
  const indice = Array.isArray(opts.indiceStaging) ? opts.indiceStaging : [];

  for (let i = 0; i < list.length; i += 1) {
    try {
      const out = mapLegadoRowToCanonicalStub(list[i], opts);
      const dup = mesmaChave(out, indice) || mesmaChave(out, mapped);
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
      const message = String(err?.message || err);
      if (message === 'usuario_legado_excluido' || message === 'produto_nao_revenda') {
        excluidos.push({ indice: i, motivo: message });
        continue;
      }
      erros.push({ indice: i, erro: message });
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
    excluidos,
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
      codigo_empresa: '001',
    },
    {
      cod_cliente: 'C-100',
      razao_social: 'Cliente Sintetico LTDA (dup)',
      group_id: 'g-sint',
      codigo_empresa: '002',
    },
    {
      cod_cliente: 'C-0',
      nome: 'Quarentena',
      group_id: 'g-sint',
      codigo_empresa: '0',
    },
  ];
  const lote = mapLegadoLoteSintetico(sampleRows, {
    entidade: 'cliente',
    groupId: 'g-sint',
    arquivoNome: 'clientes_sintetico.csv',
  });
  if (lote.gravados.some((r) => r.senha || r.empresa_id)) {
    console.error('BLOCKED: segredo ou empresa proprietaria no mestre');
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
