/**
 * @typedef {'coluna'|'viga'|'estaca'|'bloco'} TipoPeca
 * @typedef {{id: string, bitola_diametro_mm?: number, tipo_aco?: string}} Bitola
 * @typedef {{
 *   id?: string,
 *   tipo_peca?: TipoPeca,
 *   identificador?: string,
 *   quantidade?: number,
 *   etapa_obra_id?: string,
 *   etapa_obra_nome?: string,
 *   comprimento?: number,
 *   altura?: number,
 *   largura?: number,
 *   espacamento?: number,
 *   quantidade_ferros_principais?: number,
 *   bitola_principal?: string,
 *   reforco_bitola?: string,
 *   reforco_quantidade?: number,
 *   reforco_descricao?: string,
 *   dobra_l1?: boolean|'indeterminate',
 *   dobra_l2?: boolean|'indeterminate',
 *   dobra_lado1?: number,
 *   dobra_lado2?: number,
 *   estribo_bitola?: string,
 *   estribo_largura?: number,
 *   estribo_altura?: number,
 *   estribo_diametro?: number,
 *   distancia_estribo?: number,
 *   lado_sem_estribo?: string,
 *   metragem_sem_estribo?: number,
 *   estribo_quantidade?: number,
 *   quantidade_estribos?: number,
 *   ferros_lado1?: number,
 *   ferros_lado2?: number,
 *   costelas_quantidade?: number,
 *   bitola_costela?: string,
 *   descricao_automatica?: string,
 *   peso_total_kg?: number,
 *   preco_venda_total?: number
 * }} ArmadoItem
 */

export const TIPOS_PECA = [
  { id: 'coluna', label: 'Coluna', icon: '🏛️', descricao: 'Coluna retangular com estribos' },
  { id: 'viga', label: 'Viga', icon: '📏', descricao: 'Viga retangular com estribos' },
  { id: 'estaca', label: 'Estaca/Broca', icon: '🔩', descricao: 'Estaca com estribo circular' },
  { id: 'bloco', label: 'Bloco', icon: '🧱', descricao: 'Bloco de coroamento/fundação' }
];

export const ETAPAS_OBRA = [
  { id: 'fundacao', nome: 'Fundação' },
  { id: 'estrutura', nome: 'Estrutura' },
  { id: 'cobertura', nome: 'Cobertura' },
  { id: 'acabamento', nome: 'Acabamento' }
];

/** @param {ArmadoItem} peca */
export function gerarDescricaoTecnica(peca) {
  const etapaTexto = peca.etapa_obra_nome ? ` [${peca.etapa_obra_nome}]` : '';

  if (peca.tipo_peca === 'coluna' || peca.tipo_peca === 'viga') {
    return `${peca.quantidade} ${peca.tipo_peca.toUpperCase()}${etapaTexto} de ${peca.comprimento}m — ` +
      `${peca.quantidade_ferros_principais || 0} ferros ${peca.bitola_principal}` +
      `${peca.reforco_descricao || ''} — ` +
      `Estribo ${peca.estribo_largura}x${peca.estribo_altura}cm (${peca.estribo_bitola}) a cada ${peca.distancia_estribo}cm`;
  }
  if (peca.tipo_peca === 'estaca') {
    return `${peca.quantidade} ESTACA${etapaTexto} de ${peca.comprimento}m — ` +
      `${peca.quantidade_ferros_principais || 0} ferros ${peca.bitola_principal}mm — ` +
      `Estribo Ø${peca.estribo_diametro}cm (${peca.estribo_bitola}mm) a cada ${peca.distancia_estribo}cm`;
  }
  if (peca.tipo_peca === 'bloco') {
    return `${peca.quantidade} BLOCO${etapaTexto} ${peca.comprimento}x${peca.largura}x${peca.altura}cm — ` +
      `${peca.ferros_lado1} ferros lado 1 + ${peca.ferros_lado2} ferros lado 2 — ` +
      `Bitola ${peca.bitola_principal}mm`;
  }
  return peca.identificador || '';
}

/** @param {ArmadoItem} peca */
export function estimarPeso(peca) {
  const pesoMedioPorMetro = 1.5;
  let pesoTotal = 0;
  if (peca.tipo_peca === 'coluna' || peca.tipo_peca === 'viga' || peca.tipo_peca === 'estaca') {
    const comprimento = peca.comprimento || 0;
    const qtdePecas = peca.quantidade || 1;
    pesoTotal += comprimento * (peca.quantidade_ferros_principais || 4) * qtdePecas * pesoMedioPorMetro;
    if (peca.reforco_bitola && peca.reforco_quantidade) {
      pesoTotal += comprimento * peca.reforco_quantidade * qtdePecas * pesoMedioPorMetro;
    }
    const perimetroEstribo = peca.tipo_peca === 'estaca'
      ? Math.PI * (peca.estribo_diametro || 30) / 100
      : 2 * ((peca.estribo_largura || 15) + (peca.estribo_altura || 25)) / 100;
    pesoTotal += perimetroEstribo * (peca.quantidade_estribos || 0) * 0.5;
  }
  if (peca.tipo_peca === 'bloco') {
    const comprimentoM = (peca.comprimento || 0) / 100;
    const larguraM = (peca.largura || 0) / 100;
    const ferrosTotal = (peca.ferros_lado1 || 0) + (peca.ferros_lado2 || 0) + (peca.costelas_quantidade || 0);
    pesoTotal += (comprimentoM + larguraM) * ferrosTotal * (peca.quantidade || 1) * pesoMedioPorMetro;
  }
  return pesoTotal;
}

/** @param {TipoPeca} tipoPeca @param {ArmadoItem} dadosPeca */
export function calcularPeca(tipoPeca, dadosPeca) {
  /** @type {ArmadoItem} */
  const resultado = {
    ...dadosPeca,
    tipo_peca: tipoPeca,
    identificador: dadosPeca.identificador || `${tipoPeca.toUpperCase()}-${Date.now()}`,
    quantidade: dadosPeca.quantidade || 1,
    etapa_obra_id: dadosPeca.etapa_obra_id || '',
    etapa_obra_nome: dadosPeca.etapa_obra_nome || '',
    quantidade_ferros_principais: dadosPeca.quantidade_ferros_principais || 4,
    bitola_principal: dadosPeca.bitola_principal || '',
    reforco_bitola: dadosPeca.reforco_bitola || '',
    reforco_quantidade: dadosPeca.reforco_quantidade || 0,
    estribo_bitola: dadosPeca.estribo_bitola || '',
    estribo_largura: dadosPeca.estribo_largura || 0,
    estribo_altura: dadosPeca.estribo_altura || 0,
    distancia_estribo: dadosPeca.distancia_estribo || 20
  };
  if (tipoPeca === 'coluna' || tipoPeca === 'viga' || tipoPeca === 'estaca') {
    const qtdeEstribos = Math.ceil(((dadosPeca.comprimento || 0) * 100) / (dadosPeca.distancia_estribo || 20));
    resultado.estribo_quantidade = qtdeEstribos;
    resultado.quantidade_estribos = qtdeEstribos * (resultado.quantidade || 1);
    if (tipoPeca !== 'estaca') {
      resultado.reforco_descricao = dadosPeca.reforco_bitola
        ? ` + ${dadosPeca.reforco_quantidade || 0} ferros ${dadosPeca.reforco_bitola}`
        : '';
    }
  }
  if (tipoPeca === 'bloco') {
    resultado.ferros_lado1 = Math.ceil((dadosPeca.comprimento || 0) / (dadosPeca.espacamento || 15)) + 1;
    resultado.ferros_lado2 = Math.ceil((dadosPeca.largura || 0) / (dadosPeca.espacamento || 15)) + 1;
    resultado.costelas_quantidade = Math.floor((dadosPeca.largura || 0) / 30) || 0;
    resultado.bitola_costela = dadosPeca.bitola_principal;
  }
  resultado.descricao_automatica = gerarDescricaoTecnica(resultado);
  resultado.peso_total_kg = estimarPeso(resultado);
  resultado.preco_venda_total = resultado.peso_total_kg * 8.5;
  return resultado;
}

/** @param {ArmadoItem[]} itens */
export function consolidarItensPorEtapa(itens) {
  /** @type {Record<string, {etapa_obra_id: string, etapa_obra_nome: string, pecas: ArmadoItem[], peso_total_kg: number, valor_total: number}>} */
  const etapas = {};
  itens.filter((peca) => peca.etapa_obra_id).forEach((peca) => {
    const etapaId = peca.etapa_obra_id || '';
    etapas[etapaId] ||= { etapa_obra_id: etapaId, etapa_obra_nome: peca.etapa_obra_nome || '', pecas: [], peso_total_kg: 0, valor_total: 0 };
    etapas[etapaId].pecas.push(peca);
    etapas[etapaId].peso_total_kg += peca.peso_total_kg || 0;
    etapas[etapaId].valor_total += peca.preco_venda_total || 0;
  });
  return Object.values(etapas);
}

/** @param {ArmadoItem[]} itens */
export function gerarItensRevenda(itens) {
  return itens.map((peca) => ({
    produto_id: null,
    codigo_sku: peca.identificador,
    descricao: peca.descricao_automatica,
    unidade_medida: 'UN',
    quantidade: peca.quantidade,
    quantidade_kg: peca.peso_total_kg,
    preco_unitario: (peca.preco_venda_total || 0) / (peca.quantidade || 1),
    valor_item: peca.preco_venda_total,
    peso_unitario: (peca.peso_total_kg || 0) / (peca.quantidade || 1),
    origem_armado: true,
    item_producao_id: peca.id
  }));
}
