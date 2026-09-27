/**
 * Árvore explícita de permissões do proprietário (sem wildcard `*`).
 * Cobre os módulos HTTP canônicos atuais + Sistema para configurar o ERP.
 */
export const OWNER_ERP_PERMISSION_ACTIONS = [
  'visualizar',
  'criar',
  'editar',
  'excluir',
  'inativar',
  'restaurar',
  'aprovar',
  'cancelar',
  'importar',
  'exportar',
  'configurar',
  'executar',
  'bloquear',
  'principal',
  'vincular-empresa',
  'vincular-local',
  'gerenciar-itens',
  'gerenciar-parcelas',
  'definir-padrao',
  'converter-pedido',
  'alterar-status',
  'aprovar-conteudo',
  'publicar',
  'dados-sensiveis.visualizar',
  'receber',
  'pagar',
  'baixar',
  'conciliar',
  'estornar',
  'emitir',
] as const;

const A = [...OWNER_ERP_PERMISSION_ACTIONS];

/** Contrato canônico: Cadastros + Comercial + Sistema (sem chave `*`). */
export const OWNER_ERP_PERMISSION_TREE = {
  Cadastros: {
    produto: A,
    cliente: A,
    cliente_empresa: A,
    cliente_local: A,
    obra: A,
    tabela_preco: A,
    condicao_pagamento: A,
    marca: A,
    unidade_medida: A,
    grupo_produto: A,
    setor_atividade: A,
  },
  Comercial: {
    orcamento: A,
    pedido: A,
  },
  Sistema: {
    'Controle de Acesso': A,
    configuracao: A,
    auditoria: ['visualizar', 'exportar'],
    perfis: A,
    usuarios: A,
  },
} as const;

export type OwnerErpPermissionTree = typeof OWNER_ERP_PERMISSION_TREE;

export function ownerPermissionTreeHasWildcard(tree: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(tree, '*');
}

export function assertOwnerPermissionTreeShape(tree: unknown): asserts tree is OwnerErpPermissionTree {
  if (!tree || typeof tree !== 'object' || Array.isArray(tree)) {
    throw new Error('OWNER_PERMISSION_TREE_INVALID');
  }
  const obj = tree as Record<string, unknown>;
  if (ownerPermissionTreeHasWildcard(obj)) {
    throw new Error('OWNER_PERMISSION_TREE_HAS_WILDCARD');
  }
  for (const mod of ['Cadastros', 'Comercial', 'Sistema'] as const) {
    if (!obj[mod] || typeof obj[mod] !== 'object') {
      throw new Error(`OWNER_PERMISSION_TREE_MISSING_MODULE_${mod}`);
    }
  }
}
