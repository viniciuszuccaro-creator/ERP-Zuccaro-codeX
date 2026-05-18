/**
 * useCadastrosAllCounts V5 — Contagens definitivas para Cadastros Gerais
 *
 * CORREÇÕES:
 * - Filtro simplificado: passa empresa_id ou group_id diretamente (sem buildContextFilter complexo)
 * - O backend countEntities e entityListSorted já expandem corretamente os filtros simples
 * - staleTime reduzido para 30s para contagens imediatas após cadastros
 * - Invalida ao montar + ao trocar empresa/grupo
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { SIMPLE_CATALOG } from "@/components/lib/useEntityCounts";
import { useEffect, useRef } from "react";

// Entidades de cada bloco
export const BLOCOS_ENTITIES = {
  bloco1: ["Cliente","Fornecedor","Transportadora","Colaborador","Representante","ContatoB2B","SegmentoCliente","RegiaoAtendimento"],
  bloco2: ["Produto","Servico","SetorAtividade","GrupoProduto","Marca","TabelaPreco","KitProduto","CatalogoWeb","UnidadeMedida"],
  bloco3: ["Banco","FormaPagamento","PlanoDeContas","CentroCusto","CentroResultado","TipoDespesa","MoedaIndice","OperadorCaixa","ConfiguracaoDespesaRecorrente","TabelaFiscal","CondicaoComercial"],
  bloco4: ["Veiculo","Motorista","TipoFrete","LocalEstoque","RotaPadrao","ModeloDocumento"],
  bloco5: ["Empresa","GrupoEmpresarial","Departamento","Cargo","Turno","PerfilAcesso"],
  bloco6: ["ApiExterna","ChatbotCanal","ChatbotIntent","JobAgendado","Webhook","ConfiguracaoNFe","GatewayPagamento","EventoNotificacao"],
};

const ALL_ENTITIES = Object.values(BLOCOS_ENTITIES).flat();

/**
 * Filtro simples e direto: o backend (countEntities + entityListSorted)
 * já faz a expansão para empresa_dona_id, empresa_alocada_id, etc.
 * Não usar buildContextFilter complexo aqui — causa $or aninhado que quebra o count.
 */
function buildSimpleFilter(entityName, empresaId, groupId) {
  if (SIMPLE_CATALOG.has(entityName)) return {};
  // Contexto de grupo: usa group_id para o backend expandir para todas as empresas
  if (groupId && !empresaId) return { group_id: groupId };
  // Contexto de empresa: usa empresa_id para o backend expandir para todos os campos
  if (empresaId) return { empresa_id: empresaId };
  // Sem contexto valido: a query retorna zero antes de chegar aqui.
  return {};
}

export default function useCadastrosAllCounts() {
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const empresaId = empresaAtual?.id || null;
  const groupId   = grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(empresaId || groupId);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["cadastros-all-counts-v5", empresaId, groupId],
    queryFn: async () => {
      if (!contextoValido) {
        const vazio = {};
        ALL_ENTITIES.forEach(e => { vazio[e] = 0; });
        return vazio;
      }

      const entities = ALL_ENTITIES.map(entityName => ({
        entityName,
        filter: buildSimpleFilter(entityName, empresaId, groupId),
      }));

      // Tentativa 1: batch completo (WINDOW=2 no backend, ~54/2 * 500ms ≈ 13s max)
      try {
        const res = await base44.functions.invoke("countEntities", { entities });
        const raw = res?.data?.counts || res?.data || {};
        if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
          // Garantir que TODAS as entidades estão no resultado (default 0)
          const full = {};
          ALL_ENTITIES.forEach(e => { full[e] = Number(raw[e]) || 0; });
          return full;
        }
      } catch (_) {}

      // Tentativa 2: batches de 8 com delay anti-429
      const result = {};
      const BATCH = 8;
      for (let i = 0; i < entities.length; i += BATCH) {
        const slice = entities.slice(i, i + BATCH);
        try {
          if (i > 0) await new Promise(r => setTimeout(r, 600));
          const res = await base44.functions.invoke("countEntities", { entities: slice });
          const raw = res?.data?.counts || res?.data || {};
          Object.assign(result, raw);
        } catch (_) {
          slice.forEach(e => { result[e.entityName] = result[e.entityName] ?? 0; });
        }
      }
      // Normalização final: garante que TODAS as entidades têm valor (default 0)
      const full = {};
      ALL_ENTITIES.forEach(e => { full[e] = Number(result[e]) || 0; });
      return full;
    },
    staleTime: 20_000,
    gcTime: 10 * 60_000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
    retry: 2,
    retryDelay: (attempt) => Math.min(2000 * (attempt + 1), 8000),
  });

  // Invalida ao trocar empresa/grupo
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["cadastros-all-counts-v5"] });
    queryClient.invalidateQueries({ queryKey: ["entityCounts_v5"] });
  }, [empresaId, groupId]); // eslint-disable-line

  // Subscrição real-time: invalida contagens quando qualquer entidade muda
  // CORREÇÃO: sem subscribedRef — re-executa quando empresa/grupo muda para garantir invalidação correta
  useEffect(() => {
    const unsubs = ALL_ENTITIES.map(name => {
      const api = base44.entities?.[name];
      if (!api?.subscribe) return null;
      return api.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ["cadastros-all-counts-v5"] });
        queryClient.invalidateQueries({ queryKey: ["entityCounts_v5"] });
      });
    }).filter(Boolean);
    return () => { unsubs.forEach(u => { if (typeof u === 'function') u(); }); };
  }, [empresaId, groupId, queryClient]); // eslint-disable-line

  const counts = data || {};

  // Totais por bloco (soma de todas as entidades do bloco)
  const totals = Object.fromEntries(
    Object.entries(BLOCOS_ENTITIES).map(([bloco, entities]) => [
      bloco,
      entities.reduce((sum, e) => sum + (Number(counts[e]) || 0), 0),
    ])
  );

  return { counts, totals, isLoading };
}
