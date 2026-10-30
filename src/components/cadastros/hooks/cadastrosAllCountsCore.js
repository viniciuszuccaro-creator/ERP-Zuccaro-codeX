/**
 * Núcleo puro das contagens Cadastros Gerais (Pacote A).
 * Sem React/JSX — importável em testes Node e no hook.
 * Filtro alinhado a buildContextFilter / Visualizador (contextoMultiempresaPolicy).
 */
import { buildMultiempresaReadFilter } from '../../lib/contextoMultiempresaPolicy.js';

/** Espelho de SIMPLE_CATALOG / CAMPO_CTX / SHARED de useEntityCounts (manter alinhado). */
const CAMPO_CTX = {
  Fornecedor: 'empresa_dona_id',
  Transportadora: 'empresa_dona_id',
  Colaborador: 'empresa_alocada_id',
};
const SHARED = new Set(['Cliente', 'Fornecedor', 'Transportadora']);

export const BLOCOS_ENTITIES = {
  bloco1: ["Cliente","Fornecedor","Transportadora","Colaborador","Representante","ContatoB2B","SegmentoCliente","RegiaoAtendimento"],
  bloco2: ["Produto","Servico","SetorAtividade","GrupoProduto","Marca","TabelaPreco","KitProduto","CatalogoWeb","UnidadeMedida"],
  bloco3: ["Banco","FormaPagamento","PlanoDeContas","CentroCusto","CentroResultado","TipoDespesa","MoedaIndice","OperadorCaixa","ConfiguracaoDespesaRecorrente","TabelaFiscal","CondicaoComercial"],
  bloco4: ["Veiculo","Motorista","TipoFrete","LocalEstoque","RotaPadrao","ModeloDocumento"],
  bloco5: ["Empresa","GrupoEmpresarial","Departamento","Cargo","Turno","PerfilAcesso"],
  bloco6: ["ApiExterna","ChatbotCanal","ChatbotIntent","JobAgendado","Webhook","ConfiguracaoNFe","GatewayPagamento","EventoNotificacao"],
};

export const ALL_ENTITIES = Object.values(BLOCOS_ENTITIES).flat();

/** Mesmo contrato de buildContextFilter (useEntityCounts). */
export function buildCadastrosAllCountsFilter(entityName, empresaId, groupId, empresasDoGrupo) {
  if (!groupId && !empresaId) {
    return { id: '__escopo_multiempresa_obrigatorio__' };
  }
  const ctxField = CAMPO_CTX[entityName] || 'empresa_id';
  const tenantMaster = entityName === 'Empresa' || entityName === 'GrupoEmpresarial';
  return buildMultiempresaReadFilter({
    groupId,
    empresaId: tenantMaster ? null : empresaId,
    ctxField,
    shared: SHARED.has(entityName),
    empresaIdsDoGrupo: (!tenantMaster && !empresaId && Array.isArray(empresasDoGrupo))
      ? empresasDoGrupo.map((e) => e.id).filter(Boolean)
      : [],
    rest: {},
  });
}

export function emptyCadastrosCounts(entities = ALL_ENTITIES) {
  const vazio = {};
  entities.forEach((e) => { vazio[e] = 0; });
  return vazio;
}

export function normalizeCadastrosCounts(raw, entities = ALL_ENTITIES) {
  const full = {};
  entities.forEach((e) => {
    const n = Number(raw?.[e]);
    full[e] = Number.isFinite(n) ? n : 0;
  });
  return full;
}

/**
 * Conta em lote. Qualquer falha de transporte/autorização propaga (erro ≠ vazio).
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
    const raw = res?.data?.counts || res?.data || {};
    if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
      return normalizeCadastrosCounts(raw, entities);
    }
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('[cadastrosAllCountsCore] Contagem agregada indisponivel', error);
    }
  }

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
    Object.assign(result, raw);
  }
  return normalizeCadastrosCounts(result, entities);
}
