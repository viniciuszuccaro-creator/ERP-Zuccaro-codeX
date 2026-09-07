const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

export const MARKETPLACE_ORIGENS = ['Mercado Livre', 'Shopee', 'Amazon'];

export const isMarketplaceOrigem = (value) => {
  const normalized = firstText(value).toLowerCase();
  if (!normalized) return false;
  if (normalized === 'marketplace') return true;
  return MARKETPLACE_ORIGENS.some((nome) => nome.toLowerCase() === normalized);
};

export const resolveMarketplaceNome = (record = {}) => {
  const candidates = [record.marketplace, record.origem, record.origem_pedido];
  const known = candidates.find((value) => isMarketplaceOrigem(value) && firstText(value).toLowerCase() !== 'marketplace');
  return firstText(known, record.marketplace, record.origem, record.origem_pedido);
};

export const stampMarketplacePedido = (record = {}) => {
  const marketplace = resolveMarketplaceNome(record);
  const idExterno = firstText(record.origem_externa_id, record.id_externo, record.numero_pedido_externo);
  return {
    ...record,
    origem: marketplace || record.origem,
    origem_pedido: marketplace || record.origem_pedido,
    marketplace: marketplace || record.marketplace,
    origem_externa_id: idExterno || record.origem_externa_id,
    id_externo: idExterno || record.id_externo,
  };
};

export const findPedidoExternoDuplicado = (record = {}, pedidosExternos = []) => {
  const empresaId = firstText(record.empresa_id);
  const idExterno = firstText(record.id_externo, record.origem_externa_id);
  if (!empresaId || !idExterno) return null;
  return (Array.isArray(pedidosExternos) ? pedidosExternos : []).find((item) => (
    firstText(item.empresa_id) === empresaId
    && firstText(item.id_externo, item.origem_externa_id) === idExterno
  )) || null;
};

export const findPedidoMarketplaceDuplicado = (record = {}, pedidos = []) => {
  const empresaId = firstText(record.empresa_id);
  const idExterno = firstText(record.origem_externa_id, record.id_externo);
  if (!empresaId || !idExterno) return null;
  return (Array.isArray(pedidos) ? pedidos : []).find((item) => (
    firstText(item.empresa_id) === empresaId
    && firstText(item.origem_externa_id, item.id_externo) === idExterno
  )) || null;
};

export const assertPedidoExternoOnCreate = ({ record = {}, pedidosExternos = [] } = {}) => {
  if (!firstText(record.empresa_id)) {
    throw new Error('Empresa obrigatoria para pedido de marketplace.');
  }
  const stamped = stampMarketplacePedido(record);
  if (!firstText(stamped.id_externo, stamped.origem_externa_id)) {
    throw new Error('Identificador externo obrigatorio para pedido de marketplace.');
  }
  if (!firstText(stamped.marketplace, stamped.origem)) {
    throw new Error('Marketplace obrigatorio para pedido externo.');
  }
  const reuse = findPedidoExternoDuplicado(stamped, pedidosExternos);
  if (reuse) return { reuse, record: stamped };
  return { reuse: null, record: stamped };
};

export const assertPedidoMarketplaceOnCreate = ({ record = {}, pedidos = [] } = {}) => {
  const looksMarketplace = isMarketplaceOrigem(record.origem_pedido)
    || isMarketplaceOrigem(record.origem)
    || Boolean(firstText(record.marketplace, record.origem_externa_id, record.id_externo));
  if (!looksMarketplace) return { reuse: null, record };
  if (!firstText(record.empresa_id)) {
    throw new Error('Empresa obrigatoria para pedido de marketplace.');
  }
  const stamped = stampMarketplacePedido(record);
  if (!firstText(stamped.origem_externa_id, stamped.id_externo)) {
    throw new Error('Identificador externo obrigatorio para pedido de marketplace.');
  }
  const reuse = findPedidoMarketplaceDuplicado(stamped, pedidos);
  if (reuse) return { reuse, record: stamped };
  return { reuse: null, record: stamped };
};

export const buildErpPedidoFromExterno = (pedidoExterno = {}) => stampMarketplacePedido({
  cliente_id: pedidoExterno.cliente_erp_id || pedidoExterno.cliente_id,
  cliente_nome: pedidoExterno.cliente_nome,
  cliente_cpf_cnpj: pedidoExterno.cliente_cpf_cnpj,
  data_pedido: pedidoExterno.data_pedido_externo
    ? new Date(pedidoExterno.data_pedido_externo).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0],
  tipo: 'Pedido',
  tipo_pedido: 'Revenda',
  origem: pedidoExterno.origem,
  origem_pedido: pedidoExterno.origem,
  marketplace: pedidoExterno.origem,
  origem_externa_id: pedidoExterno.id_externo,
  id_externo: pedidoExterno.id_externo,
  status: 'Aprovado',
  pode_ver_no_portal: true,
  endereco_entrega_principal: pedidoExterno.endereco_entrega,
  itens_revenda: Array.isArray(pedidoExterno.itens)
    ? pedidoExterno.itens.map((item) => ({
      produto_id: item.produto_id,
      codigo_sku: item.sku_interno || item.sku_externo,
      descricao: item.descricao,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      valor_item: item.valor_total,
      unidade: 'UN',
    }))
    : [],
  valor_produtos: pedidoExterno.valor_produtos,
  valor_frete: pedidoExterno.valor_frete,
  valor_total: pedidoExterno.valor_total,
  comissao_marketplace: pedidoExterno.comissao_marketplace,
  taxa_marketplace: pedidoExterno.taxa_marketplace,
  forma_pagamento: pedidoExterno.forma_pagamento_externa || 'Marketplace',
  observacoes_publicas: `Importado de ${pedidoExterno.origem} - Pedido #${pedidoExterno.numero_pedido_externo || pedidoExterno.id_externo}`,
});

export const applyMarketplaceCreate = (entityName, record, stores = {}) => {
  if (entityName === 'PedidoExterno') {
    return assertPedidoExternoOnCreate({ record, pedidosExternos: stores.pedidosExternos });
  }
  if (entityName === 'Pedido') {
    return assertPedidoMarketplaceOnCreate({ record, pedidos: stores.pedidos });
  }
  return { reuse: null, record };
};
