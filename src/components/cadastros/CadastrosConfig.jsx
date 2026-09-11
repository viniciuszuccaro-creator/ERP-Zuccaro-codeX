/**
 * Configuração centralizada de todas as entidades de Cadastro Gerais
 * Cada entidade define: nome, colunas, ações, icon, grupo
 */

import { Users, Package, DollarSign, Truck, Building2, Zap } from "lucide-react";

export const CADASTROS_ENTITIES = {
  // Pessoas & Parceiros
  Cliente: {
    label: "Clientes",
    group: "Pessoas & Parceiros",
    icon: Users,
    columns: [
      { field: "nome", label: "Nome", searchable: true, sortable: true },
      { field: "tipo", label: "Tipo", searchable: false },
      { field: "cpf", label: "CPF/CNPJ", searchable: true },
      { field: "status", label: "Status", searchable: false },
    ],
  },
  Fornecedor: {
    label: "Fornecedores",
    group: "Pessoas & Parceiros",
    icon: Users,
    columns: [
      { field: "nome", label: "Nome", searchable: true, sortable: true },
      { field: "cnpj", label: "CNPJ", searchable: true },
      { field: "tipo_pessoa", label: "Tipo", searchable: false },
      { field: "status_fornecedor", label: "Status", searchable: false },
    ],
  },
  Transportadora: {
    label: "Transportadoras",
    group: "Pessoas & Parceiros",
    icon: Truck,
    columns: [
      { field: "razao_social", label: "Razão Social", searchable: true, sortable: true },
      { field: "cnpj", label: "CNPJ", searchable: true },
      { field: "status", label: "Status", searchable: false },
    ],
  },
  Colaborador: {
    label: "Colaboradores",
    group: "Pessoas & Parceiros",
    icon: Users,
    columns: [
      { field: "nome_completo", label: "Nome", searchable: true, sortable: true },
      { field: "cpf", label: "CPF", searchable: true },
      { field: "cargo", label: "Cargo", searchable: false },
      { field: "status", label: "Status", searchable: false },
    ],
  },
  Representante: {
    label: "Representantes",
    group: "Pessoas & Parceiros",
    icon: Users,
    columns: [
      { field: "nome", label: "Nome", searchable: true, sortable: true },
      { field: "cpf", label: "CPF", searchable: true },
      { field: "tipo_representante", label: "Tipo", searchable: false },
      { field: "status", label: "Status", searchable: false },
    ],
  },

  // Produtos & Serviços
  Produto: {
    label: "Produtos",
    group: "Produtos & Serviços",
    icon: Package,
    columns: [
      { field: "descricao", label: "Descrição", searchable: true, sortable: true },
      { field: "codigo", label: "Código", searchable: true },
      { field: "marca_nome", label: "Marca", searchable: false },
      { field: "status", label: "Status", searchable: false },
    ],
  },
  GrupoProduto: {
    label: "Grupos de Produtos",
    group: "Produtos & Serviços",
    icon: Package,
    columns: [
      { field: "nome", label: "Nome", searchable: true, sortable: true },
      { field: "descricao", label: "Descrição", searchable: false },
    ],
  },
  Marca: {
    label: "Marcas",
    group: "Produtos & Serviços",
    icon: Package,
    columns: [
      { field: "nome", label: "Nome", searchable: true, sortable: true },
      { field: "descricao", label: "Descrição", searchable: false },
    ],
  },

  // Financeiro & Fiscal
  ContaPagar: {
    label: "Contas a Pagar",
    group: "Financeiro & Fiscal",
    icon: DollarSign,
    columns: [
      { field: "descricao", label: "Descrição", searchable: true, sortable: true },
      { field: "fornecedor", label: "Fornecedor", searchable: true },
      { field: "valor", label: "Valor", type: "number", searchable: false },
      { field: "status", label: "Status", searchable: false },
    ],
  },
  ContaReceber: {
    label: "Contas a Receber",
    group: "Financeiro & Fiscal",
    icon: DollarSign,
    columns: [
      { field: "descricao", label: "Descrição", searchable: true, sortable: true },
      { field: "cliente", label: "Cliente", searchable: true },
      { field: "valor", label: "Valor", type: "number", searchable: false },
      { field: "status", label: "Status", searchable: false },
    ],
  },
  FormaPagamento: {
    label: "Formas de Pagamento",
    group: "Financeiro & Fiscal",
    icon: DollarSign,
    columns: [
      { field: "nome", label: "Nome", searchable: true, sortable: true },
      { field: "tipo", label: "Tipo", searchable: false },
      { field: "ativa", label: "Ativa", type: "boolean" },
    ],
  },
  PlanoDeContas: {
    label: "Plano de Contas",
    group: "Financeiro & Fiscal",
    icon: DollarSign,
    columns: [
      { field: "codigo", label: "Código", searchable: true, sortable: true },
      { field: "nome", label: "Nome", searchable: true },
      { field: "tipo", label: "Tipo", searchable: false },
    ],
  },

  // Logística
  Entrega: {
    label: "Entregas",
    group: "Logística, Frotas & Almoxarifado",
    icon: Truck,
    columns: [
      { field: "numero_pedido", label: "Pedido", searchable: true, sortable: true },
      { field: "cliente_nome", label: "Cliente", searchable: true },
      { field: "status", label: "Status", searchable: false },
    ],
  },
  Veiculo: {
    label: "Veículos",
    group: "Logística, Frotas & Almoxarifado",
    icon: Truck,
    columns: [
      { field: "placa", label: "Placa", searchable: true, sortable: true },
      { field: "marca", label: "Marca", searchable: false },
      { field: "status", label: "Status", searchable: false },
    ],
  },

  // Estrutura Organizacional
  Empresa: {
    label: "Empresas",
    group: "Estrutura Organizacional",
    icon: Building2,
    columns: [
      { field: "razao_social", label: "Razão Social", searchable: true, sortable: true },
      { field: "cnpj", label: "CNPJ", searchable: true },
      { field: "status", label: "Status", searchable: false },
    ],
  },
  Departamento: {
    label: "Departamentos",
    group: "Estrutura Organizacional",
    icon: Building2,
    columns: [
      { field: "nome", label: "Nome", searchable: true, sortable: true },
      { field: "descricao", label: "Descrição", searchable: false },
    ],
  },
  Cargo: {
    label: "Cargos",
    group: "Estrutura Organizacional",
    icon: Building2,
    columns: [
      { field: "nome", label: "Nome", searchable: true, sortable: true },
      { field: "descricao", label: "Descrição", searchable: false },
    ],
  },
  Turno: {
    label: "Turnos",
    group: "Estrutura Organizacional",
    icon: Building2,
    columns: [
      { field: "nome", label: "Nome", searchable: true, sortable: true },
      { field: "horario_inicio", label: "Início", searchable: false },
      { field: "horario_fim", label: "Fim", searchable: false },
    ],
  },
  CentroCusto: {
    label: "Centros de Custo",
    group: "Estrutura Organizacional",
    icon: Building2,
    columns: [
      { field: "codigo", label: "Código", searchable: true, sortable: true },
      { field: "descricao", label: "Descrição", searchable: true },
      { field: "tipo", label: "Tipo", searchable: false },
    ],
  },

  // Tecnologia
  ConfiguracaoSistema: {
    label: "Configurações",
    group: "Tecnologia, IA & Parâmetros",
    icon: Zap,
    columns: [
      { field: "chave", label: "Chave", searchable: true, sortable: true },
      { field: "descricao", label: "Descrição", searchable: false },
    ],
  },
};

// Mapa de grupos
export const CADASTROS_GROUPS = [
  {
    name: "Pessoas & Parceiros",
    icon: Users,
    description: "Clientes, fornecedores, colaboradores e partes relacionadas",
  },
  {
    name: "Produtos & Serviços",
    icon: Package,
    description: "Catálogo de produtos, serviços e variações",
  },
  {
    name: "Financeiro & Fiscal",
    icon: DollarSign,
    description: "Contas, formas de pagamento, plano de contas",
  },
  {
    name: "Logística, Frotas & Almoxarifado",
    icon: Truck,
    description: "Entregas, veículos e controle de estoque",
  },
  {
    name: "Estrutura Organizacional",
    icon: Building2,
    description: "Empresas, departamentos, cargos e turnos",
  },
  {
    name: "Tecnologia, IA & Parâmetros",
    icon: Zap,
    description: "Configurações do sistema e integrações",
  },
];

export function getCadastroConfig(entityName) {
  return CADASTROS_ENTITIES[entityName] || null;
}

export function getGroupEntities(groupName) {
  return Object.entries(CADASTROS_ENTITIES)
    .filter(([_, config]) => config.group === groupName)
    .map(([name]) => name);
}
