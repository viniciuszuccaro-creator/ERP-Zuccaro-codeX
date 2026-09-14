/**
 * Politicas puras do formulario de entrega.
 * Extraidas do componente existente para permitir validacao isolada sem criar fluxo paralelo.
 */

/** @typedef {{id?: string, group_id?: string, grupo_id?: string}} EmpresaContexto */
/** @typedef {{id?: string}} GrupoContexto */
/** @typedef {{id?: string, group_id?: string, grupo_id?: string}} EmpresaEntrega */

/**
 * @typedef {Object} EnderecoEntrega
 * @property {string} [cep]
 * @property {string} [logradouro]
 * @property {string} [numero]
 * @property {string} [complemento]
 * @property {string} [bairro]
 * @property {string} [cidade]
 * @property {string} [estado]
 * @property {number|null} [latitude]
 * @property {number|null} [longitude]
 * @property {string} [referencia]
 * @property {string} [link_google_maps]
 */

/**
 * @typedef {Object} ContatoEntrega
 * @property {string} [nome]
 * @property {string} [telefone]
 * @property {string} [whatsapp]
 * @property {string} [email]
 * @property {string} [instrucoes_especiais]
 */

/**
 * @typedef {Object} EntregaFormData
 * @property {string} [id]
 * @property {string} [group_id]
 * @property {string} [grupo_id]
 * @property {string} [empresa_id]
 * @property {string} [pedido_id]
 * @property {string} [numero_pedido]
 * @property {string} [cliente_id]
 * @property {string} [cliente_nome]
 * @property {string} [data_previsao]
 * @property {string} [prioridade]
 * @property {string} [status]
 * @property {EnderecoEntrega} endereco_entrega_completo
 * @property {ContatoEntrega} contato_entrega
 * @property {boolean} [salvar_endereco_no_cliente]
 * @property {boolean} [salvar_contato_no_cliente]
 * @property {string} [tipo_frete]
 * @property {string} [transportadora]
 * @property {string} [motorista]
 * @property {string} [motorista_telefone]
 * @property {string} [placa]
 * @property {number} [volumes]
 * @property {number} [peso_total_kg]
 * @property {number} [valor_frete]
 * @property {number} [valor_mercadoria]
 * @property {string} [codigo_rastreamento]
 * @property {string} [observacoes]
 * @property {string} [usuario_responsavel]
 * @property {string} [usuario_responsavel_id]
 */

/**
 * @param {Partial<EntregaFormData>|null|undefined} dados
 * @returns {EntregaFormData}
 */
export function normalizeEntregaFormData(dados = {}) {
  return {
    ...(dados || {}),
    endereco_entrega_completo: { ...(dados?.endereco_entrega_completo || {}) },
    contato_entrega: { ...(dados?.contato_entrega || {}) },
  };
}

/** @param {unknown} value */
export function sanitizePromptValue(value) {
  return String(value || '').replace(/[<>]/g, '').replace(/javascript:/gi, '').trim();
}

/** @param {unknown} value @returns {unknown} */
export function sanitizeEntregaPayload(value) {
  if (Array.isArray(value)) return value.map(sanitizeEntregaPayload);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeEntregaPayload(item)]));
  }
  return typeof value === 'string' ? sanitizePromptValue(value) : value;
}

/**
 * Resolve o contexto apenas a partir da sessao visual e confirma a empresa selecionada.
 * IDs persistidos no registro nunca promovem o escopo autorizado da operacao.
 *
 * @param {{
 *   grupoAtual?: GrupoContexto|null,
 *   empresaAtual?: EmpresaContexto|null,
 *   empresaSelecionadaId?: string|null,
 *   empresasDoGrupo?: EmpresaEntrega[],
 *   estaNoGrupo?: boolean
 * }} input
 */
export function resolveEntregaContext({
  grupoAtual,
  empresaAtual,
  empresaSelecionadaId,
  empresasDoGrupo = [],
  estaNoGrupo = false,
}) {
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = estaNoGrupo ? (empresaSelecionadaId || null) : (empresaAtual?.id || null);
  const empresaPertence = Boolean(
    empresaId && (!estaNoGrupo || empresasDoGrupo.some((empresa) => empresa.id === empresaId)),
  );

  return {
    groupId,
    empresaId,
    empresaPertence,
    contextoValido: Boolean(groupId && empresaId && empresaPertence),
  };
}

/**
 * @param {unknown} resultado
 * @returns {{sugestao_recebida: boolean, confianca_faixa: string}}
 */
export function summarizePredictionAudit(resultado) {
  const dados = /** @type {Record<string, any>} */ (resultado && typeof resultado === 'object' ? resultado : {});
  const confianca = Number(dados.confianca_percentual || 0);
  return {
    sugestao_recebida: Boolean(dados.data_prevista),
    confianca_faixa: confianca >= 80 ? 'alta' : confianca >= 50 ? 'media' : 'baixa',
  };
}

/**
 * @param {unknown} resultado
 * @returns {{coordenadas_recebidas: boolean, link_recebido: boolean}}
 */
export function summarizeGeolocationAudit(resultado) {
  const dados = /** @type {Record<string, any>} */ (resultado && typeof resultado === 'object' ? resultado : {});
  return {
    coordenadas_recebidas: Number.isFinite(Number(dados.latitude)) && Number.isFinite(Number(dados.longitude)),
    link_recebido: Boolean(dados.link_google_maps),
  };
}
