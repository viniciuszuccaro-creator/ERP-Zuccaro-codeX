const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

export const MARKETPLACE_ORIGENS = ['Mercado Livre', 'Shopee', 'Amazon'];
export const MARKETPLACE_STATUS_PENDENTES = ['A Validar', 'Em Revisão'];

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

export const isMarketplaceAtivo = (configs = [], origem) => {
  const nome = firstText(origem).toLowerCase();
  if (!nome) return false;
  const list = Array.isArray(configs) ? configs : [];
  if (!list.length) return true;
  const match = list.find((item) => {
    const candidatos = [item.nome, item.marketplace, item.marketplace_id, item.chave]
      .map((value) => firstText(value).toLowerCase());
    return candidatos.some((value) => value && (value === nome || nome.includes(value) || value.includes(nome)));
  });
  if (!match) return true;
  return match.ativo !== false && match.ativo !== 'false' && match.ativo !== 0;
};

export const assertMarketplaceAtivo = ({ configs = [], origem } = {}) => {
  if (!isMarketplaceAtivo(configs, origem)) {
    throw new Error(`Marketplace ${firstText(origem) || 'desconhecido'} inativo na configuracao.`);
  }
  return true;
};

export const filtrarPedidosSimuladosAtivos = (pedidos = [], configs = []) => (
  (Array.isArray(pedidos) ? pedidos : []).filter((pedido) => isMarketplaceAtivo(configs, pedido.origem || pedido.marketplace))
);

export const resolveSkuMarketplace = (item = {}, produtos = []) => {
  const sku = firstText(item.sku_interno, item.sku_externo, item.codigo_sku, item.codigo);
  if (!sku) return { ...item, produto_id: item.produto_id || null, sku_resolvido: false };
  const list = Array.isArray(produtos) ? produtos : [];
  const found = list.find((produto) => {
    const codes = [
      produto.codigo,
      produto.sku,
      produto.sku_interno,
      produto.codigo_sku,
      produto.codigo_barras,
    ].map((value) => firstText(value).toLowerCase());
    return codes.includes(sku.toLowerCase()) || firstText(produto.id) === firstText(item.produto_id);
  });
  return {
    ...item,
    sku_interno: firstText(item.sku_interno, found?.codigo, found?.sku, sku),
    produto_id: firstText(item.produto_id, found?.id) || undefined,
    sku_resolvido: Boolean(found || item.produto_id),
  };
};

export const mapItensMarketplaceComSku = (itens = [], produtos = []) => (
  (Array.isArray(itens) ? itens : []).map((item) => resolveSkuMarketplace(item, produtos))
);

export const buildConciliacaoResumo = (pedido = {}) => {
  const produtos = Number(pedido.valor_produtos || 0) || 0;
  const frete = Number(pedido.valor_frete || 0) || 0;
  const total = Number(pedido.valor_total || produtos + frete) || 0;
  const comissao = Number(pedido.comissao_marketplace || 0) || 0;
  const taxa = Number(pedido.taxa_marketplace || 0) || 0;
  const liquido = total - comissao - taxa;
  return {
    valor_bruto: total,
    comissao_marketplace: comissao,
    taxa_marketplace: taxa,
    valor_liquido_estimado: Number(liquido.toFixed(2)),
    conciliado: Boolean(pedido.conciliado),
    referencia_conciliacao: [
      'mkt',
      firstText(pedido.origem, pedido.marketplace, 'mp'),
      firstText(pedido.id_externo, pedido.origem_externa_id, pedido.id),
    ].join('|'),
  };
};

export const applyStatusExternoMarketplace = ({
  pedidoExterno = {},
  acao = '',
  motivo = '',
} = {}) => {
  if (!pedidoExterno?.id && !firstText(pedidoExterno.id_externo)) {
    throw new Error('Pedido externo obrigatorio.');
  }
  const action = firstText(acao).toLowerCase();
  const when = new Date().toISOString();
  if (action.includes('cancel')) {
    if (String(pedidoExterno.status_externo || '').toLowerCase().includes('cancel')) {
      return { reuse: true, patch: pedidoExterno };
    }
    return {
      reuse: false,
      patch: {
        status_externo: 'cancelled',
        status_importacao: 'Cancelado',
        cancelado_em: when,
        motivo_cancelamento: firstText(motivo) || 'Cancelamento marketplace',
        portal_marketplace_status_key: `cancel|${firstText(pedidoExterno.id, pedidoExterno.id_externo)}`,
      },
    };
  }
  if (action.includes('devolv') || action.includes('return')) {
    if (String(pedidoExterno.status_externo || '').toLowerCase().includes('return')) {
      return { reuse: true, patch: pedidoExterno };
    }
    return {
      reuse: false,
      patch: {
        status_externo: 'returned',
        status_importacao: 'Devolvido',
        devolvido_em: when,
        motivo_devolucao: firstText(motivo) || 'Devolucao marketplace',
        portal_marketplace_status_key: `return|${firstText(pedidoExterno.id, pedidoExterno.id_externo)}`,
      },
    };
  }
  throw new Error('Acao de status marketplace invalida.');
};

export const buildErpPedidoFromExterno = (pedidoExterno = {}, { produtos = [] } = {}) => {
  const itensMapeados = mapItensMarketplaceComSku(pedidoExterno.itens, produtos);
  return stampMarketplacePedido({
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
    itens_revenda: itensMapeados.map((item) => ({
      produto_id: item.produto_id,
      codigo_sku: item.sku_interno || item.sku_externo,
      descricao: item.descricao,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      valor_item: item.valor_total,
      unidade: 'UN',
    })),
    valor_produtos: pedidoExterno.valor_produtos,
    valor_frete: pedidoExterno.valor_frete,
    valor_total: pedidoExterno.valor_total,
    comissao_marketplace: pedidoExterno.comissao_marketplace,
    taxa_marketplace: pedidoExterno.taxa_marketplace,
    forma_pagamento: pedidoExterno.forma_pagamento_externa || 'Marketplace',
    observacoes_publicas: `Importado de ${pedidoExterno.origem} - Pedido #${pedidoExterno.numero_pedido_externo || pedidoExterno.id_externo}`,
    ...buildConciliacaoResumo(pedidoExterno),
  });
};

export const applyMarketplaceCreate = (entityName, record, stores = {}) => {
  if (entityName === 'PedidoExterno') {
    return assertPedidoExternoOnCreate({ record, pedidosExternos: stores.pedidosExternos });
  }
  if (entityName === 'Pedido') {
    return assertPedidoMarketplaceOnCreate({ record, pedidos: stores.pedidos });
  }
  return { reuse: null, record };
};
