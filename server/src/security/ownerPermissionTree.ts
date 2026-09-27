/**
 * Árvore explícita de permissões do proprietário (sem wildcard `*`).
 * Cobre o catálogo existente da UI e os contratos HTTP canônicos.
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
  'apontar',
  'rejeitar',
  'liquidar',
  'entregar',
  'conferir',
  'expedir',
  'ocorrencia',
  'converter',
  'mover_etapa',
] as const;

const A = [...OWNER_ERP_PERMISSION_ACTIONS];


// Explicit sections/tabs of the existing access editor, not a role bypass.
const OWNER_UI_PERMISSION_TREE = {
  "Contratos": { "contratos": { _acoes: [...A, 'assinar', 'renovar'] } },
  "Dashboard": {
    "principal": { _acoes: A, "kpis": A, "graficos": A, "alertas": A },
    "corporativo": { _acoes: A, "multiempresa": A, "consolidado": A },
  },
  "Comercial": {
    "clientes": { _acoes: A, "lista": A, "detalhes": A, "historico": A, "crm": A },
    "pedidos": { _acoes: A, "lista": A, "novo": A, "aprovacao": A, "faturamento": A },
    "orcamentos": { _acoes: A, "lista": A, "novo": A, "conversao": A },
    "tabelas_preco": { _acoes: A, "lista": A, "itens": A },
    "comissoes": { _acoes: A, "lista": A, "calculo": A, "pagamento": A },
    "notas_fiscais": { _acoes: A, "emissao": A, "lista": A, "cancelamento": A },
  },
  "Financeiro": {
    "contas_receber": { _acoes: A, "lista": A, "baixa": A, "cobranca": A, "boletos": A },
    "contas_pagar": { _acoes: A, "lista": A, "baixa": A, "aprovacao": A, "pagamento": A },
    "caixa": { _acoes: A, "movimentos": A, "fechamento": A, "transferencias": A },
    "conciliacao": { _acoes: A, "importar": A, "conciliar": A, "historico": A },
    "relatorios": { _acoes: A, "dre": A, "fluxo_caixa": A, "inadimplencia": A },
  },
  "Estoque": {
    "produtos": { _acoes: A, "lista": A, "novo": A, "lotes": A, "validade": A },
    "movimentacoes": { _acoes: A, "entrada": A, "saida": A, "transferencia": A, "ajuste": A },
    "inventario": { _acoes: A, "contagem": A, "acerto": A, "historico": A },
    "requisicoes": { _acoes: A, "lista": A, "aprovacao": A, "atendimento": A },
  },
  "Compras": {
    "fornecedores": { _acoes: A, "lista": A, "avaliacao": A, "historico": A },
    "solicitacoes": { _acoes: A, "lista": A, "nova": A, "aprovacao": A },
    "cotacoes": { _acoes: A, "lista": A, "nova": A, "comparativo": A },
    "ordens_compra": { _acoes: A, "lista": A, "nova": A, "recebimento": A },
  },
  "Expedição": {
    "entregas": { _acoes: A, "lista": A, "separacao": A, "despacho": A, "rastreamento": A },
    "romaneios": { _acoes: A, "lista": A, "novo": A, "impressao": A },
    "roteirizacao": { _acoes: A, "mapa": A, "otimizacao": A, "motoristas": A },
    "transportadoras": { _acoes: A, "lista": A, "tabelas_frete": A },
  },
  "Produção": {
    "ordens_producao": { _acoes: A, "lista": A, "nova": A, "programacao": A, "kanban": A },
    "apontamentos": { _acoes: A, "producao": A, "paradas": A, "refugo": A },
    "qualidade": { _acoes: A, "inspecao": A, "nao_conformidades": A, "acoes": A },
  },
  "RH": {
    "colaboradores": { _acoes: A, "lista": A, "documentos": A, "historico": A },
    "ponto": { _acoes: A, "registros": A, "ajustes": A, "relatorios": A },
    "ferias": { _acoes: A, "programacao": A, "solicitacoes": A, "aprovacao": A },
    "folha": { _acoes: A, "calculo": A, "holerites": A, "encargos": A },
  },
  "Fiscal": {
    "nfe": { _acoes: A, "emissao": A, "entrada": A, "manifestacao": A, "inutilizacao": A },
    "tabelas_fiscais": { _acoes: A, "cfop": A, "cst": A, "ncm": A, "aliquotas": A },
    "sped": { _acoes: A, "fiscal": A, "contribuicoes": A, "contabil": A },
    "obrigacoes": { _acoes: A, "calendario": A, "guias": A, "declaracoes": A },
  },
  "Cadastros": {
    "pessoas": { _acoes: A, "clientes": A, "fornecedores": A, "transportadoras": A, "colaboradores": A },
    "produtos": { _acoes: A, "produtos": A, "servicos": A, "grupos": A, "marcas": A },
    "financeiro": { _acoes: A, "bancos": A, "formas_pagamento": A, "centros_custo": A },
    "logistica": { _acoes: A, "veiculos": A, "motoristas": A, "rotas": A },
    "organizacional": { _acoes: A, "empresas": A, "departamentos": A, "cargos": A, "usuarios": A },
    "integracoes": { _acoes: A, "apis": A, "webhooks": A, "chatbot": A, "jobs_ia": A },
  },
  "CRM": {
    "oportunidades": { _acoes: A, "funil": A, "lista": A, "conversao": A },
    "interacoes": { _acoes: A, "historico": A, "nova": A, "follow_up": A },
    "campanhas": { _acoes: A, "lista": A, "nova": A, "resultados": A },
  },
  "Agenda": {
    "eventos": { _acoes: A, "calendario": A, "lista": A, "notificacoes": A },
    "tarefas": { _acoes: A, "kanban": A, "lista": A, "atribuicao": A },
  },
  "Relatórios": {
    "dashboards": { _acoes: A, "executivo": A, "operacional": A, "financeiro": A },
    "relatorios": { _acoes: A, "vendas": A, "estoque": A, "financeiro": A, "rh": A },
    "exportacao": { _acoes: A, "excel": A, "pdf": A, "api": A },
  },
  "Sistema": {
    "configuracoes": { _acoes: A, "geral": A, "notificacoes": A, "backup": A },
    "integracoes": { _acoes: A, "nfe": A, "boletos": A, "whatsapp": A, "marketplaces": A },
    "acessos": { _acoes: A, "perfis": A, "usuarios": A, "grupos": A },
    "ia": { _acoes: A, "modelos": A, "limites": A, "logs": A },
  },
} as const;

/** Owner-only explicit catalog; all tenant/domain barriers remain mandatory. */
export const OWNER_ERP_PERMISSION_TREE = {
  ...OWNER_UI_PERMISSION_TREE,
  Cadastros: {
    ...OWNER_UI_PERMISSION_TREE.Cadastros,
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
    ...OWNER_UI_PERMISSION_TREE.Comercial,
    orcamento: A,
    pedido: A,
  },
  Sistema: {
    ...OWNER_UI_PERMISSION_TREE.Sistema,
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
