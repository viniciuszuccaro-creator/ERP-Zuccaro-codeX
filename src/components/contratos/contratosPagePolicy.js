/**
 * @typedef {{tipo?: string, data_envio?: string, destinatario?: string, enviado?: boolean}} AlertaContrato
 * @typedef {{data_renovacao?: string, valor_anterior?: number, valor_novo?: number, percentual_reajuste?: number, indice_utilizado?: string, usuario?: string, observacao?: string}} RenovacaoContrato
 * @typedef {{nome_completo?: string, ip_address?: string, dispositivo?: string, navegador?: string}} AssinaturaContrato
 * @typedef {{
 *   id?: string, group_id?: string, empresa_id?: string, numero_contrato?: string, tipo?: string,
 *   parte_contratante?: string, objeto?: string, titulo?: string, descricao?: string,
 *   valor_mensal?: number, valor_total?: number, data_inicio?: string, data_fim?: string,
 *   data_assinatura?: string, vigencia_meses?: number, renovacao_automatica?: boolean,
 *   prazo_aviso_renovacao?: number, indice_reajuste?: string, percentual_reajuste?: number,
 *   forma_pagamento?: string, dia_vencimento?: number, responsavel_empresa?: string,
 *   status?: string, observacoes?: string, gerar_cobranca_automatica?: boolean,
 *   ultima_cobranca_gerada?: string|null, proxima_cobranca?: string|null,
 *   data_proximo_reajuste?: string, proximo_alerta_vencimento?: string|null,
 *   proximo_alerta_reajuste?: string|null, contas_geradas_ids?: string[],
 *   alertas_enviados?: AlertaContrato[], historico_renovacoes?: RenovacaoContrato[],
 *   assinado?: boolean, assinatura_digital?: AssinaturaContrato
 * }} Contrato
 * @typedef {{id?: string, nome?: string, razao_social?: string}} ParteContrato
 * @typedef {{id?: string, email?: string, full_name?: string}} UsuarioContrato
 */

/** @type {Record<string, string>} */
export const STATUS_COLORS = {
  Rascunho: 'bg-gray-100 text-gray-700',
  'Aguardando Assinatura': 'bg-yellow-100 text-yellow-700',
  Vigente: 'bg-green-100 text-green-700',
  Vencido: 'bg-red-100 text-red-700',
  Rescindido: 'bg-orange-100 text-orange-700',
  Renovado: 'bg-blue-100 text-blue-700'
};

/** @type {Record<string, string>} */
export const TIPO_COLORS = {
  Cliente: 'bg-blue-50 text-blue-700',
  Fornecedor: 'bg-purple-50 text-purple-700',
  'Prestação de Serviço': 'bg-indigo-50 text-indigo-700',
  Locação: 'bg-orange-50 text-orange-700',
  Parceria: 'bg-green-50 text-green-700',
  Outro: 'bg-gray-50 text-gray-700'
};

/** @param {string} dataFim @param {Date} [agora] */
export function calcularDiasParaVencimento(dataFim, agora = new Date()) {
  return Math.floor((new Date(dataFim).getTime() - agora.getTime()) / (1000 * 60 * 60 * 24));
}

/** @param {Contrato[]} contratos @param {string} searchTerm @param {string} activeTab */
export function filtrarContratos(contratos, searchTerm, activeTab) {
  const termo = searchTerm.toLowerCase();
  return contratos.filter((contrato) => {
    const campos = [
      contrato.numero_contrato, contrato.parte_contratante, contrato.objeto, contrato.titulo,
      contrato.descricao, contrato.tipo, contrato.status, contrato.responsavel_empresa,
      contrato.forma_pagamento, contrato.indice_reajuste, contrato.observacoes
    ];
    if (!campos.some((campo) => campo?.toLowerCase().includes(termo))) return false;
    if (activeTab === 'todos') return true;
    if (activeTab === 'proximos') {
      const dias = contrato.data_fim ? calcularDiasParaVencimento(contrato.data_fim) : -1;
      return dias > 0 && dias <= 60 && contrato.status === 'Vigente';
    }
    return contrato.status === activeTab;
  });
}

/** @param {Contrato[]} contratos */
export function resumirContratos(contratos) {
  const vigentes = contratos.filter((contrato) => contrato.status === 'Vigente');
  return {
    vigentes,
    aguardando: contratos.filter((contrato) => contrato.status === 'Aguardando Assinatura'),
    vencidos: contratos.filter((contrato) => contrato.status === 'Vencido'),
    proximosVencer: vigentes.filter((contrato) => {
      if (!contrato.data_fim) return false;
      const dias = calcularDiasParaVencimento(contrato.data_fim);
      return dias > 0 && dias <= 60;
    }),
    valorMensalVigente: vigentes.reduce((total, contrato) => total + (contrato.valor_mensal || 0), 0)
  };
}

/** @param {unknown} value */
export function mensagemErro(value) {
  return value instanceof Error ? value.message : 'Erro inesperado na operação de contrato.';
}

/** @param {Contrato} contrato */
export function requireContratoId(contrato) {
  if (!contrato.id) throw new Error('Contrato sem identificador válido.');
  return contrato.id;
}
