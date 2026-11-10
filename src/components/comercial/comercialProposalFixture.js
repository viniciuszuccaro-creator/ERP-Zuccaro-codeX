// Somente a proposta visual DEV consome estes objetos em memória.
// Não são cadastros, não entram no store/cache operacional nem reservam IDs/códigos.
export function createComercialProposalFixture() {
  return {
    clientesEmpresa: [
      {
        id: 'preview-vinculo',
        cliente_id: 'preview-cliente',
        codigo: '000001',
        ativo: true,
        habilitado_operacao: true,
      },
      {
        id: 'preview-vinculo-2',
        cliente_id: 'preview-cliente-2',
        codigo: '000002',
        ativo: true,
        habilitado_operacao: true,
      },
    ],
    clientes: [
      {
        id: 'preview-cliente',
        codigo: '000001',
        razao_social: 'Cliente SINTÉTICO da proposta',
        ativo: true,
      },
      {
        id: 'preview-cliente-2',
        codigo: '000002',
        razao_social: 'Cliente SINTÉTICO B da proposta',
        ativo: true,
      },
    ],
    condicoes: [
      {
        id: 'preview-condicao',
        codigo: '001',
        nome: 'Condição ilustrativa',
        ativo: true,
      },
    ],
    produtos: [
      {
        id: 'preview-produto',
        codigo: '000001',
        descricao: 'Produto SINTÉTICO da proposta',
        ativo: true,
        unidade_medida_id: 'preview-unidade',
        preco_venda: '10.00',
      },
    ],
    unidades: [{ id: 'preview-unidade', sigla: 'UN', ativo: true }],
    tabelas: [
      {
        id: 'preview-tabela',
        codigo: '001',
        nome: 'Tabela ilustrativa',
        ativo: true,
      },
    ],
    historicoIlustrativo: [
      {
        id: 'preview-hist-1',
        titulo: 'Atendimento ilustrativo — consulta de preço',
        data: '2026-10-01',
        status: 'Exemplo visual',
      },
      {
        id: 'preview-hist-2',
        titulo: 'Orçamento ilustrativo anterior',
        data: '2026-09-15',
        status: 'Não recuperado',
      },
    ],
    formasPagamentoIlustrativas: [
      { id: 'preview-pag-1', codigo: '001', nome: 'À vista ilustrativo' },
      { id: 'preview-pag-2', codigo: '002', nome: 'Boleto ilustrativo' },
    ],
    // Etapa A — lista sintética de negociações (não é GET operacional).
    negociacoes: [
      {
        id: 'preview-orc-1',
        numero: 'ORC-SINT-001',
        cliente_empresa_id: 'preview-vinculo',
        created_at: '2026-10-01T12:00:00.000Z',
        validade_em: '2026-10-15',
        status: 'EM_ABERTO',
        subtotal: '100.00',
        desconto: '0.00',
        total: '100.00',
        itens: [
          {
            id: 'preview-item-1',
            produto_id: 'preview-produto',
            descricao: 'Produto SINTÉTICO da proposta',
            unidade_sigla: 'UN',
            quantidade: '10',
            preco_unitario: '10.00',
            desconto: '0',
            total: '100.00',
          },
        ],
      },
      {
        id: 'preview-orc-2',
        numero: 'ORC-SINT-002',
        cliente_empresa_id: 'preview-vinculo',
        created_at: '2026-09-20T12:00:00.000Z',
        validade_em: '2026-09-30',
        status: 'EM_ABERTO',
        subtotal: '50.00',
        desconto: '5.00',
        total: '45.00',
        itens: [
          {
            id: 'preview-item-2',
            produto_id: 'preview-produto',
            descricao: 'Produto SINTÉTICO da proposta',
            unidade_sigla: 'UN',
            quantidade: '5',
            preco_unitario: '10.00',
            desconto: '5',
            total: '45.00',
          },
        ],
      },
      {
        id: 'preview-orc-3',
        numero: 'ORC-SINT-003',
        cliente_empresa_id: 'preview-vinculo-2',
        created_at: '2026-08-10T12:00:00.000Z',
        validade_em: '2026-08-20',
        status: 'CANCELADO',
        subtotal: '80.00',
        desconto: '0.00',
        total: '80.00',
        itens: [
          {
            id: 'preview-item-3',
            produto_id: 'preview-produto',
            descricao: 'Produto SINTÉTICO da proposta',
            unidade_sigla: 'UN',
            quantidade: '8',
            preco_unitario: '10.00',
            desconto: '0',
            total: '80.00',
          },
        ],
      },
    ],
    // Etapa C — acompanhamento ilustrativo (não é pedido real / sem convert).
    acompanhamentoPedido: {
      numero_pedido: 'PED-SINT-001',
      status: 'Ilustrativo — não gravado',
      origem_orcamento: 'ORC-SINT-001',
      credito: 'Parcial (owner: validação crédito pedido)',
      estoque: 'Parcial (owner: ValidadorEstoquePedido)',
      producao: 'Parcial (owner: GerarOpModal)',
      entrega: 'Parcial (owner: PedidosEntregaTab + MapaRoteirizacaoIA)',
      nota: 'Futuro (emissão só na empresa)',
      cobranca: 'Parcial (owner: GerarCobrancaModal)',
    },
  };
}
