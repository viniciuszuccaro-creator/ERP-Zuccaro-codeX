/**
 * Filtro canônico de contagem multiempresa (Cadastros badges / entity counts).
 * Única implementação — consumida por useEntityCounts e cadastrosAllCountsCore.
 */
import { buildMultiempresaReadFilter } from './contextoMultiempresaPolicy.js';

/** Entidades cujo filtro de leitura pode ser vazio quando não há contexto (catálogo). */
export const SIMPLE_CATALOG = new Set([
  'Banco', 'FormaPagamento', 'TipoDespesa', 'MoedaIndice', 'TipoFrete',
  'UnidadeMedida', 'Departamento', 'Cargo', 'Turno', 'GrupoProduto', 'Marca',
  'SetorAtividade', 'LocalEstoque', 'TabelaFiscal', 'CentroResultado',
  'OperadorCaixa', 'RotaPadrao', 'ModeloDocumento', 'KitProduto', 'CatalogoWeb',
  'Servico', 'CondicaoComercial', 'TabelaPreco', 'PerfilAcesso',
  'ConfiguracaoNFe', 'ConfiguracaoBoletos', 'ConfiguracaoWhatsApp',
  'GatewayPagamento', 'ApiExterna', 'Webhook', 'ChatbotIntent', 'ChatbotCanal',
  'JobAgendado', 'EventoNotificacao', 'SegmentoCliente', 'RegiaoAtendimento',
  'ContatoB2B', 'CentroCusto', 'PlanoDeContas', 'PlanoContas',
  'Veiculo', 'Motorista', 'Representante', 'GrupoEmpresarial', 'Empresa',
  'ConfiguracaoDespesaRecorrente',
]);

export const COUNT_CAMPO_CTX = Object.freeze({
  Fornecedor: 'empresa_dona_id',
  Transportadora: 'empresa_dona_id',
  Colaborador: 'empresa_alocada_id',
});

export const COUNT_SHARED_ENTITIES = new Set(['Cliente', 'Fornecedor', 'Transportadora']);

/**
 * Escopo multiempresa para contagens — alinhado ao Visualizador.
 * @param {string} entityName
 * @param {string|null|undefined} empresaId
 * @param {string|null|undefined} groupId
 * @param {Array<{id?: string}>|undefined} empresasDoGrupo
 */
export function buildContextFilter(entityName, empresaId, groupId, empresasDoGrupo) {
  if (!groupId && !empresaId) {
    if (SIMPLE_CATALOG.has(entityName)) return {};
    return { id: '__escopo_multiempresa_obrigatorio__' };
  }
  const ctxField = COUNT_CAMPO_CTX[entityName] || 'empresa_id';
  const tenantMaster = entityName === 'Empresa' || entityName === 'GrupoEmpresarial';
  return buildMultiempresaReadFilter({
    groupId,
    empresaId: tenantMaster ? null : empresaId,
    ctxField,
    shared: COUNT_SHARED_ENTITIES.has(entityName),
    empresaIdsDoGrupo: (!tenantMaster && !empresaId && Array.isArray(empresasDoGrupo))
      ? empresasDoGrupo.map((e) => e.id).filter(Boolean)
      : [],
    rest: {},
  });
}
