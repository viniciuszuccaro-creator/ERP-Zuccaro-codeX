export function createMarketplaceSimulationOrders() {
  return [{
    origem: 'Mercado Livre',
    id_externo: `ML-${Date.now()}`,
    numero_pedido_externo: `${Math.floor(Math.random() * 100000)}`,
    data_pedido_externo: new Date().toISOString(),
    cliente_nome: 'Joao Silva Marketplace',
    cliente_cpf_cnpj: '123.456.789-00',
    cliente_email: 'joao@email.com',
    cliente_telefone: '(11) 98765-4321',
    endereco_entrega: {
      cep: '01310-100',
      logradouro: 'Av Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      cidade: 'Sao Paulo',
      estado: 'SP'
    },
    itens: [{
      descricao: 'Viga V1 - 300cm',
      sku_externo: 'VIGA-300',
      quantidade: 10,
      preco_unitario: 150,
      valor_total: 1500
    }],
    valor_produtos: 1500,
    valor_frete: 50,
    valor_total: 1550,
    status_externo: 'payment_approved'
  }];
}
