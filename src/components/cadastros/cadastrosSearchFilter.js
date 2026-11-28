/**
 * Helpers puros de busca universal e navegação por teclado em Cadastros Gerais.
 * Sem side-effects e sem chamadas de API — preserva abertura vazia e leitura sob demanda.
 */

export const normalizeCadastroSearch = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

export const matchesCadastroSearch = (searchTerm, ...fields) => {
  const q = normalizeCadastroSearch(searchTerm);
  if (!q) return true;
  const haystack = normalizeCadastroSearch(fields.filter(Boolean).join(" "));
  return q.split(" ").every((token) => haystack.includes(token));
};

/** Catálogo estático dos 6 blocos para contagem/expansão instantânea de busca sem fetch. */
export const CADASTROS_BLOCO_CATALOG = {
  bloco1: [
    { key: "Cliente", label: "Clientes", keywords: "pessoa cpf cnpj comprador" },
    { key: "Fornecedor", label: "Fornecedores", keywords: "parceiro compra" },
    { key: "Transportadora", label: "Transportadoras", keywords: "frete logistica" },
    { key: "Colaborador", label: "Colaboradores", keywords: "funcionario vendedor rh" },
    { key: "Representante", label: "Representantes & Indicadores", keywords: "comissao vendas" },
    { key: "ContatoB2B", label: "Contatos B2B", keywords: "crm empresa" },
    { key: "SegmentoCliente", label: "Segmentos de Cliente", keywords: "classificacao" },
    { key: "RegiaoAtendimento", label: "Regiões de Atendimento", keywords: "zona rota comercial" },
  ],
  bloco2: [
    { key: "Produto", label: "Produtos", keywords: "catalogo sku item estoque" },
    { key: "Servico", label: "Serviços", keywords: "mao de obra os" },
    { key: "SetorAtividade", label: "Setores de Atividade", keywords: "fabrica revenda" },
    { key: "GrupoProduto", label: "Grupos/Linhas de Produto", keywords: "categoria familia" },
    { key: "Marca", label: "Marcas", keywords: "fabricante" },
    { key: "TabelaPreco", label: "Tabelas de Preço", keywords: "lista preco comercial" },
    { key: "KitProduto", label: "Kits de Produto", keywords: "combo composicao" },
    { key: "CatalogoWeb", label: "Catálogo Web", keywords: "ecommerce site" },
    { key: "UnidadeMedida", label: "Unidades de Medida", keywords: "un kg mt m2" },
  ],
  bloco3: [
    { key: "Banco", label: "Bancos", keywords: "conta agencia" },
    { key: "FormaPagamento", label: "Formas de Pagamento", keywords: "pix boleto cartao dinheiro" },
    { key: "PlanoDeContas", label: "Plano de Contas", keywords: "contabil dre receita despesa" },
    { key: "CentroCusto", label: "Centros de Custo", keywords: "rateio" },
    { key: "CentroResultado", label: "Centros de Resultado", keywords: "margem dre" },
    { key: "TipoDespesa", label: "Tipos de Despesa", keywords: "contas pagar" },
    { key: "MoedaIndice", label: "Moedas & Índices", keywords: "cambio igpm ipca" },
    { key: "OperadorCaixa", label: "Operadores de Caixa", keywords: "pdv caixa" },
    { key: "ConfiguracaoDespesaRecorrente", label: "Despesas Recorrentes", keywords: "fixa mensal" },
    { key: "TabelaFiscal", label: "Tabelas Fiscais", keywords: "cfop ncm tributacao icms" },
    { key: "CondicaoComercial", label: "Condições Comerciais", keywords: "prazo parcelamento" },
  ],
  bloco4: [
    { key: "Veiculo", label: "Veículos", keywords: "caminhao frota placa" },
    { key: "Motorista", label: "Motoristas", keywords: "cnh entrega app" },
    { key: "TipoFrete", label: "Tipos de Frete", keywords: "cif fob entrega" },
    { key: "LocalEstoque", label: "Locais de Estoque", keywords: "almoxarifado deposito" },
    { key: "RotaPadrao", label: "Rotas Padrão", keywords: "roteirizacao entrega" },
    { key: "ModeloDocumento", label: "Modelos de Documento Logístico", keywords: "romaneio comprovante" },
  ],
  bloco5: [
    { key: "GrupoEmpresarial", label: "Grupos Empresariais", keywords: "holding multiempresa" },
    { key: "Empresa", label: "Empresas", keywords: "filial matriz cnpj" },
    { key: "Departamento", label: "Departamentos", keywords: "setor area rh" },
    { key: "Cargo", label: "Cargos", keywords: "funcao rh" },
    { key: "Turno", label: "Turnos", keywords: "horario escala" },
    { key: "PerfilAcesso", label: "Perfis de Acesso", keywords: "rbac permissao seguranca" },
  ],
  bloco6: [
    { key: "ApiExterna", label: "APIs Externas", keywords: "integracao rest" },
    { key: "ChatbotCanal", label: "Canais Chatbot", keywords: "whatsapp atendimento" },
    { key: "ChatbotIntent", label: "Intents Chatbot", keywords: "ia bot" },
    { key: "GatewayPagamento", label: "Gateways de Pagamento", keywords: "asaas stripe cobranca" },
    { key: "JobAgendado", label: "Jobs Agendados", keywords: "cron automacao" },
    { key: "Webhook", label: "Webhooks", keywords: "evento callback" },
    { key: "ConfiguracaoNFe", label: "Configurações NF-e", keywords: "sefaz certificado fiscal" },
    { key: "EventoNotificacao", label: "Eventos & Notificações", keywords: "alerta aviso" },
  ],
};

export function matchCadastrosCatalog(searchTerm) {
  const normalized = normalizeCadastroSearch(searchTerm);
  if (!normalized) {
    return { active: false, matchingBlocks: [], matchCount: 0, matchesByBlock: {} };
  }
  const matchingBlocks = [];
  const matchesByBlock = {};
  let matchCount = 0;

  for (const [blocoId, items] of Object.entries(CADASTROS_BLOCO_CATALOG)) {
    const matched = items.filter((item) =>
      matchesCadastroSearch(normalized, item.key, item.label, item.keywords),
    );
    matchesByBlock[blocoId] = matched.length;
    if (matched.length > 0) {
      matchingBlocks.push(blocoId);
      matchCount += matched.length;
    }
  }
  return { active: true, matchingBlocks, matchCount, matchesByBlock };
}

/**
 * Navegação por teclado entre cards de cadastro (Enter/Space abre, setas/Home/End movem foco).
 */
export function handleCadastroTileKeyDown(event, onOpen) {
  if (!event) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (typeof onOpen === "function") onOpen();
    return;
  }

  const navKeys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"];
  if (!navKeys.includes(event.key)) return;

  const current = event.currentTarget;
  const container = current?.closest?.("[data-cadastros-grid]");
  if (!container) return;

  const tiles = Array.from(container.querySelectorAll('[data-cadastros-tile="true"]'));
  const idx = tiles.indexOf(current);
  if (idx === -1 || tiles.length <= 1) return;

  event.preventDefault();
  let nextIdx = idx;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIdx = (idx + 1) % tiles.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIdx = (idx - 1 + tiles.length) % tiles.length;
  } else if (event.key === "Home") {
    nextIdx = 0;
  } else if (event.key === "End") {
    nextIdx = tiles.length - 1;
  }

  const target = tiles[nextIdx];
  if (target && typeof target.focus === "function") {
    target.focus();
  }
}
