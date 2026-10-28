import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Package, ShieldAlert } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { createHttpApiClient } from "@/api/httpApiClient";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { resolveErpBackendMode } from "@/api/runtimeBackend";

/** Página HTTP canônica (Pedido.list). */
const PEDIDOS_PAGE_LIMIT = 50;
/** Legado: cobertura anterior ao corte silencioso de 200→50. */
const LEGADO_PEDIDOS_LIMIT = 200;
const LINHAS_UI_LIMIT = 100;

/** Extrai linhas de produto de Pedido legado (itens_*) ou canônico HTTP (`itens`). */
export function mapPedidosToHistoricoLinhas(pedidos = []) {
  const rows = [];
  for (const p of pedidos) {
    const dataRaw = p.data_pedido || p.created_at || p.data_entrega_solicitada || null;
    const data = dataRaw ? new Date(dataRaw) : null;
    const numero = p.numero_pedido || p.numero || "-";

    (p.itens_revenda || []).forEach((it) => {
      rows.push({
        tipo: "Revenda",
        descricao: it.descricao || it.produto_descricao || "-",
        quantidade: it.quantidade,
        unidade: it.unidade || it.unidade_sigla,
        valor: Number(it.valor_total ?? it.total),
        data,
        numero_pedido: numero,
        pedido_id: p.id || null,
      });
    });
    (p.itens_armado_padrao || []).forEach((it) => {
      rows.push({
        tipo: "Armado",
        descricao: it.descricao || it.produto_descricao || `${it.elemento || ""}`,
        quantidade: it.quantidade || it.quantidade_barras_principais || 0,
        unidade: "PC",
        valor: Number(it.valor_total ?? it.total),
        data,
        numero_pedido: numero,
        pedido_id: p.id || null,
      });
    });
    (p.itens_corte_dobra || []).forEach((it) => {
      rows.push({
        tipo: "Corte/Dobra",
        descricao: it.descricao || it.descricao_automatica || "-",
        quantidade: it.quantidade || it.quantidade_pecas || 0,
        unidade: "PC",
        valor: Number(it.valor_total ?? it.total),
        data,
        numero_pedido: numero,
        pedido_id: p.id || null,
      });
    });
    // Contrato canônico HTTP: lista/get devolvem `itens` (não itens_revenda).
    if (Array.isArray(p.itens) && p.itens.length) {
      p.itens.forEach((it) => {
        rows.push({
          tipo: "Revenda",
          descricao: it.descricao || "-",
          quantidade: Number(it.quantidade) || 0,
          unidade: it.unidade_sigla || it.unidade || "-",
          valor: Number(it.total ?? it.valor_total ?? it.subtotal),
          data,
          numero_pedido: numero,
          pedido_id: p.id || null,
          produto_id: it.produto_id || null,
        });
      });
    }
  }
  return rows.sort((a, b) => (b.data?.getTime() || 0) - (a.data?.getTime() || 0));
}

/**
 * Fonte HTTP canônica: lista Pedidos por `clienteId` (mestre) com itens.
 * Autorizado por Comercial.Pedido.visualizar — resolve ClienteEmpresa no
 * backend via repositório tenant-scoped, sem exigir Cadastros.cliente_empresa
 * nem round-trip Central360.
 *
 * Sem fallback silencioso para entityListSorted/local em modo HTTP.
 */
/**
 * Identidade de sessão para queryKey/revalidação (sem persistir o JWT completo).
 * Prefixo curto colide entre renovações (mesmo header JWT) — usa comprimento +
 * hash simples do token inteiro + actorId (padrão Orçamento: troca de token invalida cache).
 */
export function historicoTokenFingerprint(token) {
  const raw = String(token || "");
  if (!raw) return null;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${raw.length}:${(h >>> 0).toString(36)}`;
}

export function historicoSessionCacheKey(session) {
  if (!session?.token || !session?.actorId) return null;
  const fp = historicoTokenFingerprint(session.token);
  if (!fp) return null;
  return `${session.actorId}:${fp}`;
}

/**
 * Revalida sessão/tenant antes e depois da listagem.
 * Descarta resultado se usuário/empresa/grupo mudarem durante a request.
 */
export function assertHistoricoHttpScope({
  session,
  groupId,
  empresaId,
  expectedActorId = null,
  expectedSessionKey = null,
}) {
  if (!session?.token || !session?.actorId || !session?.groupId) {
    throw Object.assign(new Error("Sessao HTTP ausente para historico de produtos."), {
      code: "HTTP_SESSION_REQUIRED",
    });
  }
  if (expectedActorId && session.actorId !== expectedActorId) {
    throw Object.assign(new Error("Sessao trocou de usuario durante o historico."), {
      code: "SESSION_ACTOR_CHANGED",
    });
  }
  if (expectedSessionKey && historicoSessionCacheKey(session) !== expectedSessionKey) {
    throw Object.assign(new Error("Sessao HTTP rotacionou durante o historico."), {
      code: "SESSION_ROTATED",
    });
  }
  const effectiveGroup = groupId || session.groupId;
  if (session.groupId !== effectiveGroup) {
    throw Object.assign(new Error("Grupo da sessao diverge do contexto do historico."), {
      code: "GROUP_CONTEXT_MISMATCH",
    });
  }
  if (!empresaId) {
    throw Object.assign(new Error("Historico HTTP exige empresa no contexto."), {
      code: "EMPRESA_CONTEXT_REQUIRED",
    });
  }
}

export async function loadPedidosHistoricoHttp({
  clienteId,
  groupId,
  empresaId,
  signal,
  limit = PEDIDOS_PAGE_LIMIT,
  offset = 0,
  expectedActorId = null,
  expectedSessionKey = null,
}) {
  const sessionBefore = readErpHttpSession();
  assertHistoricoHttpScope({
    session: sessionBefore,
    groupId,
    empresaId,
    expectedActorId,
    expectedSessionKey,
  });
  if (!clienteId) {
    throw Object.assign(new Error("Historico HTTP exige clienteId."), {
      code: "CLIENTE_ID_REQUIRED",
    });
  }
  const http = createHttpApiClient({
    getScope: () => {
      const live = readErpHttpSession() || sessionBefore;
      return {
        token: live.token,
        groupId: groupId || live.groupId,
        empresaId,
        actorId: live.actorId,
        actorEmail: live.email || null,
      };
    },
  });
  const page = await http.pedidos.list({
    limit,
    offset,
    clienteId,
    signal,
  });
  // Revalida após a rede — resposta tardia com sessão/tenant trocado não entra no cache.
  assertHistoricoHttpScope({
    session: readErpHttpSession(),
    groupId,
    empresaId,
    expectedActorId: expectedActorId || sessionBefore.actorId,
    expectedSessionKey: expectedSessionKey || historicoSessionCacheKey(sessionBefore),
  });
  const rows = Array.isArray(page?.data) ? page.data : (Array.isArray(page) ? page : []);
  const meta = page?.meta && typeof page.meta === "object"
    ? {
        limit: Number(page.meta.limit) || limit,
        offset: Number(page.meta.offset) || offset,
        total: Number.isFinite(Number(page.meta.total)) ? Number(page.meta.total) : rows.length,
        hasMore: Boolean(page.meta.hasMore),
      }
    : {
        limit,
        offset,
        total: rows.length,
        hasMore: false,
      };
  return { data: rows, meta };
}

export default function HistoricoProdutosCliente({ clienteId }) {
  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
  const httpMode = resolveErpBackendMode() === "http";
  const sessionSnapshot = readErpHttpSession();
  const actorId = sessionSnapshot?.actorId || null;
  const sessionCacheKey = historicoSessionCacheKey(sessionSnapshot);
  const podeVisualizarHistorico =
    hasPermission("Comercial.Pedido.visualizar") ||
    hasPermission("CRM.Cliente.visualizar") ||
    hasPermission("comercial", "visualizar_pedido");
  const consultaHabilitada = Boolean(
    clienteId
      && contextoValido
      && podeVisualizarHistorico
      && (!httpMode || (empresaId && actorId && sessionCacheKey)),
  );

  const sessionEpochRef = useRef(0);
  const loadMoreAbortRef = useRef(null);
  const loadMoreInFlightRef = useRef(false);
  const firstPageFingerprintSeenRef = useRef(null);
  // Páginas extras amarradas ao proprietário completo — filtradas no render (não só em useEffect).
  const [extraSession, setExtraSession] = useState({ ownerKey: null, pages: [] });
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(null);

  // Isolamento de cache: grupo/empresa + usuário/sessão (padrão Orçamento/Pedido).
  const queryKey = [
    "historico-produtos-cliente-contexto",
    clienteId,
    groupId,
    empresaId,
    contexto,
    actorId,
    sessionCacheKey,
    httpMode ? "http" : "legado",
  ];
  const historicoOwnerKey = useMemo(
    () => JSON.stringify([
      clienteId ?? null,
      groupId ?? null,
      empresaId ?? null,
      contexto ?? null,
      actorId ?? null,
      sessionCacheKey ?? null,
      httpMode ? "http" : "legado",
    ]),
    [clienteId, groupId, empresaId, contexto, actorId, sessionCacheKey, httpMode],
  );
  // P2 Codex: no 1º render após troca de contexto, excluir extras/meta do proprietário anterior.
  const ownerMatches = extraSession.ownerKey === historicoOwnerKey;
  const extraPages = ownerMatches ? extraSession.pages : [];
  const scopedLoadingMore = ownerMatches && loadingMore;
  const scopedLoadMoreError = ownerMatches ? loadMoreError : null;

  const resetPaginationSession = () => {
    sessionEpochRef.current += 1;
    loadMoreInFlightRef.current = false;
    if (loadMoreAbortRef.current) {
      try { loadMoreAbortRef.current.abort(); } catch (_) { /* ignore */ }
      loadMoreAbortRef.current = null;
    }
    setExtraSession({ ownerKey: null, pages: [] });
    setLoadMoreError(null);
    setLoadingMore(false);
  };

  useEffect(() => {
    firstPageFingerprintSeenRef.current = null;
    resetPaginationSession();
  }, [clienteId, groupId, empresaId, contexto, actorId, sessionCacheKey, httpMode]);

  const {
    data: firstPage,
    isError,
    error,
    isFetching,
  } = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const epoch = sessionEpochRef.current;
      // Fail-closed: revalida permissão/contexto na execução (enabled sozinho não basta).
      if (!clienteId || !contextoValido || !podeVisualizarHistorico) {
        throw Object.assign(new Error("Historico bloqueado: contexto ou permissao ausente."), {
          code: "HISTORICO_CONTEXT_DENIED",
        });
      }
      if (httpMode) {
        if (!empresaId) {
          throw Object.assign(new Error("Historico HTTP exige empresa no contexto."), {
            code: "EMPRESA_CONTEXT_REQUIRED",
          });
        }
        const page = await loadPedidosHistoricoHttp({
          clienteId,
          groupId,
          empresaId,
          signal,
          limit: PEDIDOS_PAGE_LIMIT,
          offset: 0,
          expectedActorId: actorId,
          expectedSessionKey: sessionCacheKey,
        });
        if (epoch !== sessionEpochRef.current) {
          throw Object.assign(new Error("Contexto alterado durante consulta do historico."), {
            code: "CONTEXT_CHANGED",
          });
        }
        return page;
      }
      // Legado/local: filterInContext. Em HTTP nunca cai aqui (sem facade silenciosa).
      const rows = await filterInContext(
        "Pedido",
        { cliente_id: clienteId },
        "-data_pedido",
        LEGADO_PEDIDOS_LIMIT,
      );
      if (epoch !== sessionEpochRef.current) {
        throw Object.assign(new Error("Contexto alterado durante consulta do historico."), {
          code: "CONTEXT_CHANGED",
        });
      }
      const data = Array.isArray(rows) ? rows : [];
      return {
        data,
        meta: {
          limit: LEGADO_PEDIDOS_LIMIT,
          offset: 0,
          total: data.length,
          hasMore: false,
        },
      };
    },
    enabled: consultaHabilitada,
    staleTime: 60_000,
    retry: false,
  });

  // P2 Codex: refetch/invalidação da 1ª página não pode misturar extras de snapshot antigo.
  const firstPageFingerprint = useMemo(() => {
    if (!firstPage) return null;
    const ids = (Array.isArray(firstPage.data) ? firstPage.data : [])
      .map((p) => p?.id || p?.numero_pedido || p?.numero || "")
      .join(",");
    const total = firstPage.meta?.total;
    const hasMoreMeta = firstPage.meta?.hasMore;
    return `${ids}|${total}|${hasMoreMeta}`;
  }, [firstPage]);

  useEffect(() => {
    if (!firstPageFingerprint) return;
    if (firstPageFingerprintSeenRef.current == null) {
      firstPageFingerprintSeenRef.current = firstPageFingerprint;
      return;
    }
    if (firstPageFingerprintSeenRef.current === firstPageFingerprint) return;
    firstPageFingerprintSeenRef.current = firstPageFingerprint;
    resetPaginationSession();
  }, [firstPageFingerprint]);

  const pedidos = useMemo(() => {
    const base = Array.isArray(firstPage?.data) ? firstPage.data : [];
    const extras = extraPages.flatMap((page) => (Array.isArray(page?.data) ? page.data : []));
    return [...base, ...extras];
  }, [firstPage, extraPages]);

  const meta = useMemo(() => {
    // Com extras, hasMore/total vêm da última página; se 1ª página mudou, extras já foram limpos.
    if (extraPages.length) return extraPages[extraPages.length - 1]?.meta || firstPage?.meta;
    return firstPage?.meta || null;
  }, [firstPage, extraPages]);

  const totalPedidos = Number.isFinite(Number(meta?.total)) ? Number(meta.total) : pedidos.length;
  const hasMore = Boolean(meta?.hasMore);
  const linhas = useMemo(() => mapPedidosToHistoricoLinhas(pedidos), [pedidos]);
  const linhasExibidas = Math.min(linhas.length, LINHAS_UI_LIMIT);
  const linhasTruncadas = linhas.length > LINHAS_UI_LIMIT;

  const handleLoadMore = async () => {
    if (!httpMode || !hasMore || !consultaHabilitada) return;
    // Trava síncrona: scopedLoadingMore sozinho falha no 1º load (ownerKey ainda null).
    if (loadMoreInFlightRef.current || scopedLoadingMore) return;
    loadMoreInFlightRef.current = true;
    const epoch = sessionEpochRef.current;
    const offset = pedidos.length;
    const intentOwnerKey = historicoOwnerKey;
    // Associa proprietário ANTES da rede — loading/erro ficam visíveis; evita offset duplicado.
    setExtraSession((prev) => (
      prev.ownerKey === intentOwnerKey
        ? prev
        : { ownerKey: intentOwnerKey, pages: [] }
    ));
    setLoadingMore(true);
    setLoadMoreError(null);
    const controller = new AbortController();
    loadMoreAbortRef.current = controller;
    try {
      const page = await loadPedidosHistoricoHttp({
        clienteId,
        groupId,
        empresaId,
        signal: controller.signal,
        limit: PEDIDOS_PAGE_LIMIT,
        offset,
        expectedActorId: actorId,
        expectedSessionKey: sessionCacheKey,
      });
      if (epoch !== sessionEpochRef.current) return; // contexto/sessão trocou — descarta
      setExtraSession((prev) => {
        if (prev.ownerKey !== intentOwnerKey) return prev;
        return { ownerKey: intentOwnerKey, pages: [...prev.pages, page] };
      });
    } catch (err) {
      if (epoch !== sessionEpochRef.current) return;
      if (err?.name === "AbortError") return;
      setLoadMoreError(err);
    } finally {
      // Ownership também na liberação: A tardio não pode zerar inFlight de B.
      // Troca de contexto: resetPaginationSession aborta + limpa inFlight/loading.
      if (loadMoreAbortRef.current === controller) {
        loadMoreAbortRef.current = null;
        setLoadingMore(false);
        loadMoreInFlightRef.current = false;
      }
    }
  };

  if (clienteId && (!contextoValido || !podeVisualizarHistorico || (httpMode && !empresaId))) {
    return (
      <Alert className="w-full h-full border-amber-200 bg-amber-50" data-context-required="true" data-permission="Comercial.Pedido.visualizar">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          {httpMode && !empresaId
            ? "Histórico HTTP exige empresa selecionada (além de permissão para visualizar pedidos)."
            : "Histórico de produtos exige contexto de grupo/empresa e permissão para visualizar pedidos."}
        </AlertDescription>
      </Alert>
    );
  }

  if (isError) {
    return (
      <Alert
        className="w-full h-full border-red-200 bg-red-50"
        data-historico-produtos-error={
          (error && typeof error === "object" && "code" in error && error.code) || "error"
        }
      >
        <ShieldAlert className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          {error?.message || "Falha ao carregar histórico de produtos. Sem fallback local."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card
      className="w-full h-full border-0 shadow-sm"
      data-context-required="true"
      data-permission="Comercial.Pedido.visualizar"
      data-historico-fonte={httpMode ? "http" : "legado"}
      data-historico-pedidos-carregados={pedidos.length}
      data-historico-pedidos-total={totalPedidos}
      data-historico-linhas-carregadas={linhas.length}
      data-historico-linhas-exibidas={linhasExibidas}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Package className="w-4 h-4 text-sky-600" />
          Histórico de Produtos ({linhasExibidas}
          {linhasTruncadas || (httpMode && totalPedidos > pedidos.length)
            ? ` linhas · ${pedidos.length}/${totalPedidos} pedidos`
            : ""}
          ){isFetching || scopedLoadingMore ? "…" : ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Data</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-center">Qtd</TableHead>
                <TableHead>Unid</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.slice(0, LINHAS_UI_LIMIT).map((l, idx) => (
                <TableRow key={`${l.pedido_id || l.numero_pedido}-${idx}`}>
                  <TableCell className="text-sm">
                    {l.data && !Number.isNaN(l.data.getTime()) ? l.data.toLocaleDateString("pt-BR") : "-"}
                  </TableCell>
                  <TableCell className="text-sm">{l.numero_pedido || "-"}</TableCell>
                  <TableCell>
                    <Badge className={
                      l.tipo === "Revenda" ? "bg-sky-100 text-sky-700" :
                      l.tipo === "Armado" ? "bg-amber-100 text-amber-700" :
                      "bg-blue-100 text-blue-700"
                    }>
                      {l.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{l.descricao}</TableCell>
                  <TableCell className="text-center text-sm">{l.quantidade}</TableCell>
                  <TableCell className="text-sm">{l.unidade || "-"}</TableCell>
                  <TableCell className="text-right text-sm">
                    {Number.isFinite(l.valor) ? `R$ ${l.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                    Nenhum histórico de produtos encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {linhasTruncadas ? (
          <p
            className="pt-3 text-xs text-slate-500"
            data-historico-linhas-truncadas="true"
          >
            Exibindo {linhasExibidas} de {linhas.length} linhas dos pedidos já carregados
            ({pedidos.length}/{totalPedidos} pedidos). Carregar mais pedidos não remove este teto de exibição.
          </p>
        ) : null}
        {httpMode && hasMore ? (
          <div className="pt-3 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500" data-historico-paginacao="has-more">
              Exibindo {pedidos.length} de {totalPedidos} pedidos. Produtos de páginas seguintes exigem carregar mais.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              data-action="historico-produtos-carregar-mais"
              disabled={scopedLoadingMore}
              onClick={handleLoadMore}
            >
              {scopedLoadingMore ? "Carregando…" : "Carregar mais"}
            </Button>
          </div>
        ) : null}
        {scopedLoadMoreError ? (
          <Alert className="mt-3 border-red-200 bg-red-50" data-historico-produtos-error="load-more">
            <ShieldAlert className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {scopedLoadMoreError?.message || "Falha ao carregar próxima página. Sem fallback local."}
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
