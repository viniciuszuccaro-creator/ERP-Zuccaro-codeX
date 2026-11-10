/**
 * Layout canônico Central de Vendas360° (versão 6 aprovada).
 * Extração pura — sem entidade/tela paralela; só composição do Comercial existente.
 */

export const CENTRAL_VENDAS360_TITLE = 'Central de Vendas360°';

/** Situações da faixa — visão inicial = orçamentos em aberto. */
export const CENTRAL_VENDAS360_SITUACOES = Object.freeze([
  { id: 'ORCAMENTOS_ABERTOS', label: 'Orçamentos em Aberto', kind: 'orcamento', statusHint: 'EM_ABERTO' },
  { id: 'PRODUCAO', label: 'Produção', kind: 'pedido', statusHint: 'EM_PRODUCAO' },
  { id: 'ENTREGA', label: 'Entrega', kind: 'pedido', statusHint: 'EM_ENTREGA', tipoOperacao: 'ENTREGA' },
  { id: 'RETIRA', label: 'Retira', kind: 'pedido', statusHint: 'PRONTO_RETIRADA', tipoOperacao: 'RETIRADA' },
  { id: 'ENTREGUES', label: 'Entregues', kind: 'pedido', statusHint: 'ENTREGUE' },
  { id: 'FINALIZADOS', label: 'Finalizados', kind: 'pedido', statusHint: 'FINALIZADO' },
  { id: 'CANCELADOS', label: 'Cancelados', kind: 'pedido', statusHint: 'CANCELADO' },
  { id: 'VENCIDOS', label: 'Vencidos/Encerrados', kind: 'orcamento', statusHint: 'VENCIDO' },
]);

export const CENTRAL_VENDAS360_DEFAULT_SITUACAO = 'ORCAMENTOS_ABERTOS';

/** 12 colunas na ordem aprovada (versão 6 / decisão 10/11). */
export const CENTRAL_VENDAS360_COLUMNS = Object.freeze([
  { key: 'numero', label: 'Nº Orçamento', sticky: true },
  { key: 'data', label: 'Data' },
  { key: 'cod_cliente', label: 'Cod Cliente', sticky: true },
  { key: 'nome_cliente', label: 'Nome Cliente', sticky: true },
  { key: 'origem', label: 'Origem' },
  { key: 'vendedor', label: 'Nome Vendedor' },
  { key: 'peso', label: 'Peso' },
  { key: 'valor', label: 'Valor' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'condicao', label: 'Condição Pagamento' },
  { key: 'situacao', label: 'Situação' },
  { key: 'prazo', label: 'Prazo' },
]);

/** Tile liberado na proposta visual = Central (hospeda orçamentos). */
export function isCentralVendas360Module(module) {
  const title = String(module?.title || '');
  const section = String(module?.sectionKey || '');
  return /central\s*de\s*vendas|vendas360/i.test(title)
    || /vendas360|central_vendas/i.test(section)
    || /or[cç]amento/i.test(title)
    || /or[cç]amento/i.test(section);
}

/**
 * Particiona itens oficiais em grades simultâneas (sem abas).
 * Produção/corte/armado → grade esquerda; demais → revenda.
 * Não inventa tipo: usa flags/campos já persistidos.
 */
export function partitionCentralItens(itens) {
  const corte = [];
  const revenda = [];
  for (const item of Array.isArray(itens) ? itens : []) {
    const tipo = String(item?.tipo || item?.tipo_item || item?.tipo_comercial || '').toLowerCase();
    const producao = item?.requer_producao === true
      || /corte|dobra|armado|montagem|produ[cç]/.test(tipo);
    if (producao) corte.push(item);
    else revenda.push(item);
  }
  return { corte, revenda };
}

/**
 * Peso oficial: soma pesos dos produtos/itens quando o campo existe.
 * Sem fator inventado — ausência → null (UI mostra "—").
 */
export function sumCentralPesoKg(itens) {
  let total = 0;
  let found = false;
  for (const item of Array.isArray(itens) ? itens : []) {
    const raw = item?.peso_kg ?? item?.peso ?? item?.peso_total;
    if (raw === null || raw === undefined || raw === '') continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    total += n;
    found = true;
  }
  return found ? total : null;
}

/** Validade de orçamento ≠ prazo de entrega de pedido. */
export function resolveCentralPrazoLabel(row, kind) {
  if (!row) return '—';
  if (kind === 'orcamento') {
    return row.validade_em || row.validade || null;
  }
  return row.data_entrega_solicitada || row.prazo_entrega || row.data_entrega || null;
}

export function situacaoById(id) {
  return CENTRAL_VENDAS360_SITUACOES.find((s) => s.id === id) || CENTRAL_VENDAS360_SITUACOES[0];
}
