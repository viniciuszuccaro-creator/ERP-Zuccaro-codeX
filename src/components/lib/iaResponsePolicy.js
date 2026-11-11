import { z } from 'zod';

const corteDobraId = z.union([z.string().min(1).max(2000), z.number().int().safe().nonnegative()]);
const corteDobraMedida = z.number().finite().nonnegative();
const corteDobraRespostaSchema = z.object({
  posicoes: z.array(z.object({
    codigo: z.string().min(1).max(2000),
    bitola: z.string().max(100).regex(/^\d+(?:\.\d+)?$/).refine(value => Number.isFinite(Number(value)) && Number(value) > 0),
    formato: z.enum(['reto', 'L', 'U', 'Z', 'gancho', 'estribo']),
    quantidade: z.number().finite().positive(),
    medidas: z.object({ A: corteDobraMedida, B: corteDobraMedida.optional(), C: corteDobraMedida.optional(), D: corteDobraMedida.optional() }).strict(),
    etapa: z.enum(['fundacao', 'estrutura', 'cobertura', 'acabamento']).optional(),
    id: corteDobraId.optional(), produto_id: corteDobraId.optional(), codigo_legado: z.string().max(2000).optional(),
  }).strict()).max(500),
  confianca: z.number().finite().min(0).max(100).optional(),
  observacoes: z.string().max(4000).optional(),
}).strict();

/** @param {unknown} response @param {number} limit @param {string} message */
function parseResponse(response, limit, message) {
  if (typeof response !== 'string') return response;
  if (response.length > limit) throw new Error(message);
  try { return JSON.parse(response); }
  catch { throw new Error(message); }
}

/** @param {unknown} response */
export function validarPosicoesCorteDobraIA(response) {
  const message = 'Resposta de corte e dobra IA invalida.';
  const result = corteDobraRespostaSchema.safeParse(parseResponse(response, 1000000, message));
  if (!result.success) throw new Error(message);
  return result.data;
}

const fiscalSuggestionSchema = z.object({
  valido: z.boolean(), cfop_sugerido: z.string().max(100).optional(), impostos_validados: z.boolean().optional(),
  alertas: z.array(z.object({
    tipo: z.string().max(200).optional(), severidade: z.string().max(200).optional(),
    descricao: z.string().max(4000).optional(), sugestao: z.string().max(4000).optional(),
  }).passthrough()).max(100).optional(),
}).passthrough();

/** @param {unknown} response */
export function validarRespostaFiscalIA(response) {
  const message = 'Resposta fiscal IA invalida.';
  const result = fiscalSuggestionSchema.safeParse(parseResponse(response, 100000, message));
  if (!result.success) throw new Error(message);
  return result.data;
}

const text = z.string().max(4000);
const confidence = z.number().finite().min(0).max(100);
const productSchema = z.object({
  confianca: confidence,
  eh_bitola: z.boolean().optional(), peso_teorico_kg_m: z.number().finite().nonnegative().optional(),
  bitola_diametro_mm: z.number().finite().nonnegative().optional(), tipo_aco: text.optional(),
  ncm: text.optional(), grupo_produto: text.optional(), comprimento_barra_m: z.number().finite().nonnegative().optional(),
  unidade_principal: text.optional(), unidades_secundarias: z.array(text).max(100).optional(), explicacao: text.optional(),
}).passthrough();

/** @param {unknown} response */
export function validarClassificacaoProdutoIA(response) {
  const message = 'Resposta de classificacao IA invalida.';
  const result = productSchema.safeParse(parseResponse(response, 100000, message));
  if (!result.success) throw new Error(message);
  return result.data;
}

const recommendationsSchema = z.object({
  sugestoes: z.array(z.object({
    produto_codigo: z.string().min(1).max(2000), motivo_sugestao: text, score_confianca: confidence,
    produtos_complementares: z.array(text).max(100).optional(),
  }).passthrough()).max(50),
}).passthrough();

/** @param {unknown} response @param {ReadonlyArray<{codigo?: unknown}>} produtos */
export function validarSugestoesProdutosIA(response, produtos) {
  const message = 'Resposta de sugestoes IA invalida.';
  const result = recommendationsSchema.safeParse(parseResponse(response, 100000, message));
  if (!result.success) throw new Error(message);
  const codes = result.data.sugestoes.map(item => item.produto_codigo);
  if (new Set(codes).size !== codes.length || codes.some(code => produtos.filter(item => item.codigo === code).length !== 1)) throw new Error(message);
  return result.data;
}

const prioritiesSchema = z.object({
  oportunidades_priorizadas: z.array(z.object({
    titulo: z.string().min(1).max(4000), score_ia: z.number().finite(), motivo_priorizacao: text,
  }).passthrough()).max(200),
}).passthrough();

/** @param {unknown} response @param {ReadonlyArray<{titulo?: unknown}>} oportunidades */
export function validarPrioridadesOportunidadesIA(response, oportunidades) {
  const message = 'Resposta de prioridades IA invalida.';
  const result = prioritiesSchema.safeParse(parseResponse(response, 100000, message));
  if (!result.success) throw new Error(message);
  const titles = result.data.oportunidades_priorizadas.map(item => item.titulo);
  // A title is not an ID: ambiguous source titles cannot establish a match.
  if (new Set(titles).size !== titles.length || titles.some(title => oportunidades.filter(item => item.titulo === title).length !== 1)) throw new Error(message);
  return result.data;
}

const deliverySchema = z.object({
  data_prevista: z.string().min(1).max(100), horario_previsto: z.string().max(100).optional(),
  confianca_percentual: confidence, prazo_dias: z.number().finite().nonnegative().optional(),
  fatores_risco: z.array(z.string().max(2000)).max(100).optional(),
  recomendacoes: z.array(z.string().max(2000)).max(100).optional(),
}).passthrough();

/** @param {unknown} response */
export function validarPrevisaoEntregaIA(response) {
  const message = 'Resposta de previsao de entrega IA invalida.';
  const result = deliverySchema.safeParse(parseResponse(response, 100000, message));
  if (!result.success) throw new Error(message);
  return result.data;
}

const projectQuoteSchema = z.object({
  pecas: z.array(z.object({
    tipo: z.string().min(1).max(4000), identificador: text.optional(),
    quantidade: z.number().finite().positive(), comprimento: z.number().finite().nonnegative(),
    largura: z.number().finite().nonnegative().optional(), altura: z.number().finite().nonnegative().optional(),
    bitola_principal: text.optional(), peso_kg: z.number().finite().nonnegative(),
    preco_total: z.number().finite().nonnegative(),
  }).passthrough()).max(500),
  resumo: z.object({
    total_pecas: z.number().int().nonnegative().safe(), peso_total_kg: z.number().finite().nonnegative(),
    valor_estimado: z.number().finite().nonnegative(), prazo_dias: z.number().finite().nonnegative(),
  }).passthrough(),
  confianca: confidence,
}).passthrough();

/** @param {unknown} response */
export function validarOrcamentoProjetoIA(response) {
  const message = 'Resposta de orcamento de projeto IA invalida.';
  const result = projectQuoteSchema.safeParse(parseResponse(response, 1000000, message));
  if (!result.success) throw new Error(message);
  return result.data;
}

const priceSuggestionSchema = z.object({
  markup_sugerido_geral: z.number().finite(),
  markup_por_setor: z.record(z.number().finite()),
  produtos_promocao: z.array(z.string().min(1).max(2000)).max(500),
  estrategia: text.optional(), observacoes: text.optional(),
}).passthrough();

/** @param {unknown} response @param {ReadonlyArray<{produto_id?: unknown}>} itens */
export function validarPrecificacaoTabelaIA(response, itens) {
  const message = 'Resposta de precificacao IA invalida.';
  const result = priceSuggestionSchema.safeParse(parseResponse(response, 100000, message));
  if (!result.success) throw new Error(message);
  const ids = result.data.produtos_promocao;
  if (new Set(ids).size !== ids.length || ids.some(id => itens.filter(item => item.produto_id === id).length !== 1)) throw new Error(message);
  return result.data;
}

const productionSelectionSchema = z.object({
  indices_producao: z.array(z.number().int().nonnegative().safe()).max(20).optional(),
  justificativa: text.optional(),
}).passthrough();

/** @param {unknown} response @param {number} quantidadeEnviada */
export function validarSelecaoProducaoIA(response, quantidadeEnviada) {
  const message = 'Resposta de selecao de producao IA invalida.';
  const result = productionSelectionSchema.safeParse(parseResponse(response, 100000, message));
  if (!result.success || !Number.isSafeInteger(quantidadeEnviada) || quantidadeEnviada < 0 || quantidadeEnviada > 20) throw new Error(message);
  const indices = result.data.indices_producao || [];
  if (new Set(indices).size !== indices.length || indices.some(index => index >= quantidadeEnviada)) throw new Error(message);
  return result.data;
}

const supportSuggestionsSchema = z.object({
  respostas_sugeridas: z.array(z.object({texto: z.string().min(1).max(4000), tom: z.enum(['formal', 'amigavel', 'tecnico']).optional()}).passthrough()).max(50).optional(),
  acoes_recomendadas: z.array(text).max(100).optional(),
  alerta: z.object({tem_alerta: z.boolean().optional(), mensagem: text.optional(), tipo: z.enum(['info', 'aviso', 'urgente']).optional()}).passthrough().optional(),
}).passthrough();

/** @param {unknown} response */
export function validarSugestoesAtendimentoIA(response) {
  const message = 'Resposta de sugestoes de atendimento IA invalida.';
  const result = supportSuggestionsSchema.safeParse(parseResponse(response, 100000, message));
  if (!result.success) throw new Error(message);
  return result.data;
}

const productionPlanSchema = z.object({
  sequenciamento_sugerido: text.min(1), otimizacao_corte: text.min(1),
  tempo_previsto_horas: z.number().finite().nonnegative().optional(),
  riscos_identificados: z.array(text).max(100).optional(), gargalos: z.array(text).max(100).optional(),
}).passthrough();

/** @param {unknown} response */
export function validarPlanoProducaoIA(response) {
  const message = 'Resposta de planejamento de producao IA invalida.';
  const result = productionPlanSchema.safeParse(parseResponse(response, 100000, message));
  if (!result.success) throw new Error(message);
  return result.data;
}

const purchaseSuggestionsSchema = z.object({
  sugestoes: z.array(z.object({
    produto_codigo: z.string().min(1).max(2000), quantidade_sugerida: z.number().finite().positive(),
    justificativa: text, prioridade: z.enum(['Baixa', 'Média', 'Alta', 'Urgente']),
  }).passthrough()).max(200),
}).passthrough();

/** @param {unknown} response @param {ReadonlyArray<{codigo?: unknown}>} produtos */
export function validarSugestoesCompraIA(response, produtos) {
  const message = 'Resposta de sugestoes de compra IA invalida.';
  const result = purchaseSuggestionsSchema.safeParse(parseResponse(response, 100000, message));
  if (!result.success) throw new Error(message);
  const codes = result.data.sugestoes.map(item => item.produto_codigo);
  if (new Set(codes).size !== codes.length || codes.some(code => produtos.filter(item => item.codigo === code).length !== 1)) throw new Error(message);
  return result.data;
}

const ncmSuggestionsSchema = z.object({
  sugestoes: z.array(z.object({
    chave: z.string().min(1).max(4000), ncm_sugerido: z.string().regex(/^\d{8}$/),
    confianca: confidence.optional(), justificativa: text.optional(),
  }).passthrough()).max(1000),
}).passthrough();

/** @param {unknown} response @param {ReadonlyArray<{chave?: unknown}>} itens */
export function validarSugestoesNcmIA(response, itens) {
  const message = 'Resposta de sugestoes NCM IA invalida.';
  const result = ncmSuggestionsSchema.safeParse(parseResponse(response, 1000000, message));
  if (!result.success) throw new Error(message);
  const keys = result.data.sugestoes.map(item => item.chave);
  if (new Set(keys).size !== keys.length || keys.some(key => itens.filter(item => item.chave === key).length !== 1)) throw new Error(message);
  return result.data;
}

const deliveryRouteSchema = z.object({
  sequencia_otimizada: z.array(corteDobraId).max(200).optional(),
  distancia_total_km: z.number().finite().nonnegative().optional(),
  tempo_total_minutos: z.number().finite().nonnegative().optional(),
  custo_estimado: z.number().finite().nonnegative().optional(),
  economia_vs_manual: z.record(z.unknown()).optional(),
}).passthrough();

/** @param {unknown} response @param {ReadonlyArray<{id?: unknown}>} entregas */
export function validarRoteirizacaoEntregaIA(response, entregas) {
  const message = 'Resposta de roteirizacao IA invalida.';
  const result = deliveryRouteSchema.safeParse(parseResponse(response, 100000, message));
  if (!result.success) throw new Error(message);
  const ids = result.data.sequencia_otimizada || [];
  // Empty/absent sequence retains the existing local optimizer; a supplied route must be complete.
  if (ids.length && (ids.length !== entregas.length || new Set(ids).size !== ids.length
    || ids.some(id => entregas.filter(item => item.id === id).length !== 1))) throw new Error(message);
  return result.data;
}

const pickingRouteSchema = z.object({
  rota_otimizada: z.array(z.object({
    ordem: z.number().int().positive().safe(), produto: text.min(1), localizacao: text,
    distancia_estimada_m: z.number().finite().nonnegative().optional(),
  }).passthrough()).max(500),
  distancia_total_m: z.number().finite().nonnegative().optional(),
  tempo_estimado_min: z.number().finite().nonnegative().optional(),
}).passthrough();

/** @param {unknown} response @param {ReadonlyArray<{produto: string, localizacao: string}>} itens */
export function validarRotaPickingIA(response, itens) {
  const message = 'Resposta de rota de picking IA invalida.';
  const result = pickingRouteSchema.safeParse(parseResponse(response, 100000, message));
  if (!result.success || result.data.rota_otimizada.length !== itens.length) throw new Error(message);
  const routes = result.data.rota_otimizada;
  const key = item => JSON.stringify([item.produto, item.localizacao]);
  const keys = routes.map(key), orders = routes.map(item => item.ordem);
  if (new Set(keys).size !== keys.length || new Set(orders).size !== orders.length
    || orders.some(order => order > routes.length)
    || routes.some(route => itens.filter(item => key(item) === key(route)).length !== 1)) throw new Error(message);
  return result.data;
}

const pontoAnomalySchema = z.object({
  risco: z.enum(['Baixo', 'Médio', 'Alto']),
  requer_aprovacao_gestor: z.boolean(),
  observacoes_ia: text,
  anomalias_detectadas: z.array(text).max(100).optional(),
}).strict();

/** @param {unknown} response */
export function validarAnomaliasPontoIA(response) {
  const message = 'Resposta de analise de ponto IA invalida.';
  const result = pontoAnomalySchema.safeParse(parseResponse(response, 100000, message));
  if (!result.success) throw new Error(message);
  return result.data;
}

const publicLookupErrorSchema = z.object({erro: text.min(1)}).strict();
const ncmLookupSuggestionSchema = z.object({
  descricao: text.min(1), unidade: text.optional(),
  aliquota_ipi: z.number().finite().optional(),
  aliquota_pis: z.number().finite().optional(),
  aliquota_cofins: z.number().finite().optional(),
  cest: text.optional(), obs: text.optional(),
}).strict().or(publicLookupErrorSchema);
const rntrcLookupSuggestionSchema = z.object({
  valido: z.boolean(), situacao: z.enum(['Ativo', 'Suspenso', 'Cancelado']),
  tipo_registro: z.enum(['ETC', 'TAC', 'CTC']), categoria: text.optional(),
}).strict().or(publicLookupErrorSchema);

/** @param {unknown} response */
export function validarSugestaoNcmConsultaIA(response) {
  const message = 'Nao foi possivel obter uma sugestao NCM valida.';
  const result = ncmLookupSuggestionSchema.safeParse(parseResponse(response, 100000, message));
  if (!result.success || 'erro' in result.data) throw new Error(message);
  return result.data;
}

/** @param {unknown} response */
export function validarSugestaoRntrcConsultaIA(response) {
  const message = 'Nao foi possivel obter uma sugestao RNTRC valida.';
  const result = rntrcLookupSuggestionSchema.safeParse(parseResponse(response, 100000, message));
  if (!result.success || 'erro' in result.data) throw new Error(message);
  return result.data;
}
