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
export async function loadPedidosHistoricoHttp({
  clienteId,
  groupId,
  empresaId,
  signal,
  limit = PEDIDOS_PAGE_LIMIT,
  offset = 0,
}) {
  const session = readErpHttpSession();
  if (!session?.token || !session?.actorId || !session?.groupId) {
    throw Object.assign(new Error("Sessao HTTP ausente para historico de produtos."), {
      code: "HTTP_SESSION_REQUIRED",
    });
  }
  if (!empresaId) {
    throw Object.assign(new Error("Historico HTTP exige empresa no contexto."), {
      code: "EMPRESA_CONTEXT_REQUIRED",
    });
  }
  if (!clienteId) {
    throw Object.assign(new Error("Historico HTTP exige clienteId."), {
      code: "CLIENTE_ID_REQUIRED",
    });
  }
  const http = createHttpApiClient({
    getScope: () => ({
      token: session.token,
      groupId: groupId || session.groupId,
      empresaId,
      actorId: session.actorId,
      actorEmail: session.email || null,
    }),
  });
  const page = await http.pedidos.list({
    limit,
    offset,
    clienteId,
    signal,
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
  const podeVisualizarHistorico =
    hasPermission("Comercial.Pedido.visualizar") ||
    hasPermission("CRM.Cliente.visualizar") ||
    hasPermission("comercial", "visualizar_pedido");
  const consultaHabilitada = Boolean(
    clienteId && contextoValido && podeVisualizarHistorico && (!httpMode || empresaId),
  );

  const sessionEpochRef = useRef(0);
  const [extraPages, setExtraPages] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(null);

  const queryKey = [
    "historico-produtos-cliente-contexto",
    clienteId,
    groupId,
    empresaId,
    contexto,
    httpMode ? "http" : "legado",
  ];

  useEffect(() => {
    sessionEpochRef.current += 1;
    setExtraPages([]);
    setLoadMoreError(null);
  }, [clienteId, groupId, empresaId, contexto, httpMode]);

  const {
    data: firstPage,
    isError,
    error,
    isFetching,
  } = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      if (httpMode) {
        return loadPedidosHistoricoHttp({
          clienteId,
          groupId,
          empresaId,
          signal,
          limit: PEDIDOS_PAGE_LIMIT,
          offset: 0,
        });
      }
      // Legado/local: filterInContext. Em HTTP nunca cai aqui (sem facade silenciosa).
      const rows = await filterInContext(
        "Pedido",
        { cliente_id: clienteId },
        "-data_pedido",
        LEGADO_PEDIDOS_LIMIT,
      );
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

  const pedidos = useMemo(() => {
    const base = Array.isArray(firstPage?.data) ? firstPage.data : [];
    const extras = extraPages.flatMap((page) => (Array.isArray(page?.data) ? page.data : []));
    return [...base, ...extras];
  }, [firstPage, extraPages]);

  const meta = useMemo(() => {
    if (extraPages.length) return extraPages[extraPages.length - 1]?.meta || firstPage?.meta;
    return firstPage?.meta || null;
  }, [firstPage, extraPages]);

  const totalPedidos = Number.isFinite(Number(meta?.total)) ? Number(meta.total) : pedidos.length;
  const hasMore = Boolean(meta?.hasMore);
  const linhas = useMemo(() => mapPedidosToHistoricoLinhas(pedidos), [pedidos]);

  const handleLoadMore = async () => {
    if (!httpMode || !hasMore || loadingMore || !consultaHabilitada) return;
    const epoch = sessionEpochRef.current;
    const offset = pedidos.length;
    setLoadingMore(true);
    setLoadMoreError(null);
    const controller = new AbortController();
    try {
      const page = await loadPedidosHistoricoHttp({
        clienteId,
        groupId,
        empresaId,
        signal: controller.signal,
        limit: PEDIDOS_PAGE_LIMIT,
        offset,
      });
      if (epoch !== sessionEpochRef.current) return; // contexto/sessão trocou — descarta
      setExtraPages((prev) => [...prev, page]);
    } catch (err) {
      if (epoch !== sessionEpochRef.current) return;
      setLoadMoreError(err);
    } finally {
      if (epoch === sessionEpochRef.current) setLoadingMore(false);
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
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Package className="w-4 h-4 text-sky-600" />
          Histórico de Produtos ({linhas.length}
          {httpMode && totalPedidos > pedidos.length
            ? ` linhas · ${pedidos.length}/${totalPedidos} pedidos`
            : ""}
          ){isFetching || loadingMore ? "…" : ""}
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
              disabled={loadingMore}
              onClick={handleLoadMore}
            >
              {loadingMore ? "Carregando…" : "Carregar mais"}
            </Button>
          </div>
        ) : null}
        {loadMoreError ? (
          <Alert className="mt-3 border-red-200 bg-red-50" data-historico-produtos-error="load-more">
            <ShieldAlert className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {loadMoreError?.message || "Falha ao carregar próxima página. Sem fallback local."}
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
