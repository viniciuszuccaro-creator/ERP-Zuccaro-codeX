/**
 * useEntityCounts V6 — contagem robusta multiempresa
 * - SEM cache em memória (COUNT_CACHE removido — causava contagens stale após mutações)
 * - Usa batch API do countEntities (1 request para N entidades)
 * - React Query com staleTime=30s controla a frequência de re-fetch
 * - Invalidação automática via subscribe por entidade
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useMemo, useEffect } from "react";

// Entidades que NÃO precisam de filtro de empresa/grupo (catálogos globais)
export const SIMPLE_CATALOG = new Set([
  'Banco','FormaPagamento','TipoDespesa','MoedaIndice','TipoFrete',
  'UnidadeMedida','Departamento','Cargo','Turno','GrupoProduto','Marca',
  'SetorAtividade','LocalEstoque','TabelaFiscal','CentroResultado',
  'OperadorCaixa','RotaPadrao','ModeloDocumento','KitProduto','CatalogoWeb',
  'Servico','CondicaoComercial','TabelaPreco','PerfilAcesso',
  'ConfiguracaoNFe','ConfiguracaoBoletos','ConfiguracaoWhatsApp',
  'GatewayPagamento','ApiExterna','Webhook','ChatbotIntent','ChatbotCanal',
  'JobAgendado','EventoNotificacao','SegmentoCliente','RegiaoAtendimento',
  'ContatoB2B','CentroCusto','PlanoDeContas','PlanoContas',
  'Veiculo','Motorista','Representante','GrupoEmpresarial','Empresa',
  'ConfiguracaoDespesaRecorrente',
]);

const CAMPO_CTX = {
  Fornecedor: 'empresa_dona_id',
  Transportadora: 'empresa_dona_id',
  Colaborador: 'empresa_alocada_id',
};

const SHARED = new Set(['Cliente', 'Fornecedor', 'Transportadora']);

/**
 * buildContextFilter — mantido para compatibilidade com imports externos.
 * Internamente o hook agora usa filtro simples (o backend expande).
 */
export function buildContextFilter(entityName, empresaId, groupId, empresasDoGrupo) {
  if (SIMPLE_CATALOG.has(entityName)) return {};
  // Filtro simples: o backend (countEntities / entityListSorted) já expande
  // empresa_id → empresa_dona_id, empresa_alocada_id, empresas_compartilhadas_ids
  // group_id  → todas as empresas do grupo
  if (groupId && !empresaId) return { group_id: groupId };
  if (empresaId) return { empresa_id: empresaId };
  return {};
}

// Fallback: contagem individual via countEntities (single mode)
async function countSingle(entityName, filter) {
  try {
    const res = await base44.functions.invoke('countEntities', {
      entityName,
      filter: filter || {},
    });
    const d = res?.data;
    if (typeof d?.count === 'number') return d.count;
  } catch (error) {
    console.error('[useEntityCounts] Falha na contagem individual', error, { entityName });
  }
  try {
    const res = await base44.functions.invoke('entityListSorted', {
      entityName,
      filter: filter || {},
      sortField: 'id',
      sortDirection: 'asc',
      limit: 2000,
    });
    return Array.isArray(res?.data) ? res.data.length : 0;
  } catch (error) {
    console.error('[useEntityCounts] Falha na contagem por listagem', error, { entityName });
  }
  return 0;
}

export function useEntityCounts(entities = []) {
  const { grupoAtual, empresaAtual, empresasDoGrupo } = useContextoVisual();
  const queryClient = useQueryClient();

  const groupId = grupoAtual?.id || null;
  const empresaId = empresaAtual?.id || null;

  const normalized = useMemo(() => {
    const arr = Array.isArray(entities) ? entities : [entities];
    return arr.filter(Boolean);
  }, [entities.join ? entities.join(',') : JSON.stringify(entities)]); // eslint-disable-line

  const entitiesKey = useMemo(() => [...normalized].sort().join(','), [normalized]);

  const grupoEmpIdsKey = useMemo(
    () => (Array.isArray(empresasDoGrupo) ? empresasDoGrupo.map(e => e.id).filter(Boolean).sort().join(',') : ''),
    [empresasDoGrupo]
  );

  const queryKey = ['entityCounts_v5', entitiesKey, groupId, empresaId, grupoEmpIdsKey];

  // Sempre busca — se não há contexto, usa filtro vazio (conta tudo) ou
  // contexto do grupo/empresa quando disponível
  const canFetch = normalized.length > 0;

  const { data: counts = {}, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!normalized.length) return {};

      const batchPayload = [];

      for (const entityName of normalized) {
        const isSimple = SIMPLE_CATALOG.has(entityName);
        let ctxFilter = {};
        if (!isSimple) {
          // buildContextFilter pode retornar null quando sem contexto — usa {} para contar global
          ctxFilter = buildContextFilter(entityName, empresaId, groupId, empresasDoGrupo) ?? {};
        }
        batchPayload.push({ entityName, filter: ctxFilter });
      }

      if (!batchPayload.length) return {};

      // Batch API — 1 request para todas as entidades
      try {
        const res = await base44.functions.invoke('countEntities', {
          entities: batchPayload,
        });
        const d = res?.data;
        if (d?.counts && typeof d.counts === 'object') {
          // CORREÇÃO: 'fixed' nunca existiu — ReferenceError silencioso zerrava todos os counts
          return { ...d.counts };
        }
      } catch (_) {}

      // Fallback sequencial com delay para evitar 429
      const result = {};
      for (let i = 0; i < batchPayload.length; i++) {
        const { entityName, filter } = batchPayload[i];
        result[entityName] = await countSingle(entityName, filter);
        if (i < batchPayload.length - 1) await new Promise(r => setTimeout(r, 200));
      }
      return result;
    },
    staleTime: 30_000,     // 30s — contagens frescas após cadastros
    gcTime: 300_000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    enabled: canFetch,
  });

  // Invalidar quando registros mudam
  useEffect(() => {
    if (!normalized.length) return;
    const unsubs = normalized.map(entity => {
      const api = base44.entities?.[entity];
      if (!api?.subscribe) return null;
      return api.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ['entityCounts_v5'] });
      });
    }).filter(Boolean);
    return () => { unsubs.forEach(u => { if (typeof u === 'function') u(); }); };
  }, [entitiesKey, queryClient]); // eslint-disable-line

  const total = useMemo(
    () => normalized.reduce((acc, e) => acc + (Number(counts[e]) || 0), 0),
    [counts, normalized]
  );

  return { counts: counts || {}, total, isLoading };
}

export default useEntityCounts;