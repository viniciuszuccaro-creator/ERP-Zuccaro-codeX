/**
 * Núcleo puro das contagens Cadastros Gerais (Pacote A).
 * Sem React/JSX — reutiliza buildContextFilter canônico (cadastroCountFilter).
 */
import { buildContextFilter } from '../../lib/cadastroCountFilter.js';

export const BLOCOS_ENTITIES = {
  bloco1: ["Cliente","Fornecedor","Transportadora","Colaborador","Representante","ContatoB2B","SegmentoCliente","RegiaoAtendimento"],
  bloco2: ["Produto","Servico","SetorAtividade","GrupoProduto","Marca","TabelaPreco","KitProduto","CatalogoWeb","UnidadeMedida"],
  bloco3: ["Banco","FormaPagamento","PlanoDeContas","CentroCusto","CentroResultado","TipoDespesa","MoedaIndice","OperadorCaixa","ConfiguracaoDespesaRecorrente","TabelaFiscal","CondicaoComercial"],
  bloco4: ["Veiculo","Motorista","TipoFrete","LocalEstoque","RotaPadrao","ModeloDocumento"],
  bloco5: ["Empresa","GrupoEmpresarial","Departamento","Cargo","Turno","PerfilAcesso"],
  bloco6: ["ApiExterna","ChatbotCanal","ChatbotIntent","JobAgendado","Webhook","ConfiguracaoNFe","GatewayPagamento","EventoNotificacao"],
};

export const ALL_ENTITIES = Object.values(BLOCOS_ENTITIES).flat();

/** Alias estável — mesma função canônica do useEntityCounts. */
export function buildCadastrosAllCountsFilter(entityName, empresaId, groupId, empresasDoGrupo) {
  return buildContextFilter(entityName, empresaId, groupId, empresasDoGrupo) ?? {};
}

/** @param {string[]} [entities] @returns {Record<string, number>} */
export function emptyCadastrosCounts(entities = ALL_ENTITIES) {
  /** @type {Record<string, number>} */
  const vazio = {};
  entities.forEach((e) => { vazio[e] = 0; });
  return vazio;
}

/**
 * Exige todas as entidades pedidas. Chave ausente = parcial ≠ total confirmado.
 * @param {Record<string, unknown>|null|undefined} raw
 * @param {string[]} [entities]
 * @returns {Record<string, number>}
 * @throws {Error & { code?: string, missing?: string[] }}
 */
/**
 * Contagem válida: number finito, safe integer, ≥ 0.
 * null/false/''/-1/1.5/overflow → indisponível (parcial), nunca coerção a 0.
 * @param {unknown} value
 * @returns {value is number}
 */
export function isValidCountValue(value) {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0;
}

export function normalizeCadastrosCounts(raw, entities = ALL_ENTITIES) {
  /** @type {Record<string, number>} */
  const full = {};
  const missing = [];
  for (const e of entities) {
    if (!Object.prototype.hasOwnProperty.call(raw || {}, e)) {
      missing.push(e);
      continue;
    }
    const v = /** @type {Record<string, unknown>} */ (raw || {})[e];
    if (!isValidCountValue(v)) {
      missing.push(e);
      continue;
    }
    full[e] = v;
  }
  if (missing.length) {
    /** @type {Error & { code?: string, missing?: string[] }} */
    const err = new Error('READ_COUNT_PARTIAL');
    err.code = 'READ_COUNT_PARTIAL';
    err.missing = missing;
    throw err;
  }
  return full;
}

/**
 * Conta em lote. Falha/parcial propaga (erro ≠ vazio; parcial ≠ total).
 * @param {object} [options]
 * @param {(name: string, body?: object) => Promise<{ data?: any }>} [options.invoke]
 * @param {string|null} [options.empresaId]
 * @param {string|null} [options.groupId]
 * @param {Array<{ id?: string }>} [options.empresasDoGrupo]
 * @param {string[]} [options.entities]
 * @returns {Promise<Record<string, number>>}
 */
export async function fetchCadastrosAllCounts({
  invoke,
  empresaId,
  groupId,
  empresasDoGrupo,
  entities = ALL_ENTITIES,
} = {}) {
  if (typeof invoke !== 'function') {
    throw new Error('invoke obrigatório');
  }
  if (!empresaId && !groupId) {
    return emptyCadastrosCounts(entities);
  }

  const batch = entities.map((entityName) => ({
    entityName,
    filter: buildCadastrosAllCountsFilter(entityName, empresaId, groupId, empresasDoGrupo),
  }));

  try {
    const res = await invoke('countEntities', { entities: batch });
    const raw = /** @type {Record<string, unknown>} */ (res?.data?.counts || res?.data || {});
    if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
      return normalizeCadastrosCounts(raw, entities);
    }
  } catch (error) {
    const partial = /** @type {{ code?: string, message?: string }|null|undefined} */ (error);
    if (partial?.code === 'READ_COUNT_PARTIAL' || partial?.message === 'READ_COUNT_PARTIAL') {
      throw error;
    }
    if (typeof console !== 'undefined') {
      console.warn('[cadastrosAllCountsCore] Contagem agregada indisponivel', error);
    }
  }

  /** @type {Record<string, unknown>} */
  const result = {};
  const BATCH = 8;
  for (let i = 0; i < batch.length; i += BATCH) {
    const slice = batch.slice(i, i + BATCH);
    if (i > 0) await new Promise((r) => setTimeout(r, 0));
    const res = await invoke('countEntities', { entities: slice });
    const raw = res?.data?.counts || res?.data || {};
    if (!raw || typeof raw !== 'object') {
      throw new Error('READ_COUNT_UNAVAILABLE');
    }
    Object.assign(result, /** @type {Record<string, unknown>} */ (raw));
  }
  return normalizeCadastrosCounts(result, entities);
}
