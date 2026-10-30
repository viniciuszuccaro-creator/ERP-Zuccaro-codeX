import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, TrendingUp, Package, FileText, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import HistoricoOrigemCliente from "./HistoricoOrigemCliente";
import HistoricoProdutosCliente, {
  loadPedidosHistoricoHttp,
  historicoSessionCacheKey,
} from "./HistoricoProdutosCliente";
import CentralCliente360Panel from "./CentralCliente360Panel";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { resolveErpAuthSessionToken } from "@/api/httpApiClient";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { resolveErpBackendMode } from "@/api/runtimeBackend";
import { appParams } from "@/lib/app-params";

const PEDIDOS_KPI_LIMIT = 50;

/** Status cancelado (legado string ou canônico HTTP). */
export function isPedidoCancelado(pedido) {
  const s = String(pedido?.status || "").toUpperCase();
  return s === "CANCELADO" || s === "CANCELLED";
}

/** Valor do pedido: legado `valor_total` ou canônico HTTP `total`. */
export function pedidoValorTotal(pedido) {
  const raw = pedido?.valor_total ?? pedido?.total;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** KPIs só com dados confirmados — HTTP vazio/erro ≠ R$ 0,00. */
export function computeDetalhesClientePedidosKpis(pedidos) {
  const list = Array.isArray(pedidos) ? pedidos : [];
  const ativos = list.filter((p) => !isPedidoCancelado(p));
  const totalCompras = ativos.reduce((sum, p) => sum + pedidoValorTotal(p), 0);
  const ticketMedio = ativos.length > 0 ? totalCompras / ativos.length : 0;
  return {
    totalCompras,
    ticketMedio,
    qtdPedidos: list.length,
    qtdAtivos: ativos.length,
  };
}

/**
 * AGENTS §11: não publicar KPIs pela 1ª página quando há mais registros.
 * Contagem pode usar `meta.total` (agregação server-side); somas/ticket só com página completa.
 */
export function isDetalhesClientePedidosPageComplete(meta, pedidos) {
  const rows = Array.isArray(pedidos) ? pedidos : [];
  if (meta?.hasMore) return false;
  const total = Number(meta?.total);
  if (Number.isFinite(total) && total > rows.length) return false;
  return true;
}

/**
 * @param {{ pedidos?: unknown[], meta?: { hasMore?: boolean, total?: number, limit?: number, offset?: number } | null }} [options]
 * @returns {{ moneyIncomplete: boolean, kpis: { totalCompras: number|null, ticketMedio: number|null, qtdPedidos: number|null, qtdAtivos: number|null } }}
 */
export function resolveDetalhesClienteKpisFromPage({ pedidos, meta } = {}) {
  const rows = Array.isArray(pedidos) ? pedidos : [];
  const complete = isDetalhesClientePedidosPageComplete(meta, rows);
  const totalMeta = Number(meta?.total);
  const qtdFromMeta = Number.isFinite(totalMeta) ? totalMeta : null;
  if (!complete) {
    return {
      moneyIncomplete: true,
      kpis: {
        totalCompras: null,
        ticketMedio: null,
        qtdPedidos: qtdFromMeta,
        qtdAtivos: null,
      },
    };
  }
  return {
    moneyIncomplete: false,
    kpis: computeDetalhesClientePedidosKpis(rows),
  };
}

/**
 * V21.1.2 - WINDOW MODE READY
 * Central 360 HTTP (opt-in) composta sobre este detalhe existente.
 * Token Bearer da sessão autenticada é passado ao painel (não ativar flag sem supabase_user).
 *
 * KPIs / Últimos Pedidos: em HTTP reutiliza `loadPedidosHistoricoHttp` (mesmo contrato do
 * Histórico de Produtos). Sem filterInContext Pedido em HTTP — não inventar zeros.
 */
export default function DetalhesCliente({ cliente, onClose, windowMode = false }) {
  const [activeTab, setActiveTab] = useState("historico");
  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const { hasPermission, user } = usePermissions();

  const groupId = cliente.group_id || cliente.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = cliente.empresa_id || cliente.empresa_dona_id || (contexto === "empresa" ? empresaAtual?.id : null);
  const contextoValido = Boolean(groupId || empresaId);
  const podeVisualizarDetalhes =
    hasPermission("Comercial.Pedido.visualizar") ||
    hasPermission("CRM.Cliente.visualizar") ||
    hasPermission("Cadastros.Cliente.visualizar") ||
    hasPermission("comercial", "visualizar_pedido");
  const httpMode = resolveErpBackendMode() === "http";
  const sessionSnapshot = readErpHttpSession();
  const sessionActorId = sessionSnapshot?.actorId || null;
  const sessionCacheKey = historicoSessionCacheKey(sessionSnapshot);
  const consultaHabilitada = Boolean(
    cliente.id
      && contextoValido
      && podeVisualizarDetalhes
      && (!httpMode || (empresaId && sessionActorId && sessionCacheKey)),
  );
  const actorId = user?.id || user?.profile_id || sessionActorId || null;
  const actorEmail = user?.email || null;
  const sessionToken = resolveErpAuthSessionToken({ appToken: appParams?.token });

  const {
    data: pedidosPage,
    isError: pedidosErro,
    isFetching: pedidosFetching,
    error: pedidosError,
  } = useQuery({
    queryKey: [
      "pedidos-cliente-contexto",
      cliente.id,
      groupId,
      empresaId,
      contexto,
      sessionActorId,
      sessionCacheKey,
      httpMode ? "http" : "legado",
    ],
    queryFn: async ({ signal }) => {
      if (!cliente.id || !contextoValido || !podeVisualizarDetalhes) {
        throw Object.assign(new Error("Detalhes bloqueados: contexto ou permissao ausente."), {
          code: "DETALHES_CONTEXT_DENIED",
        });
      }
      if (httpMode) {
        if (!empresaId) {
          throw Object.assign(new Error("Detalhes HTTP exigem empresa no contexto."), {
            code: "EMPRESA_CONTEXT_REQUIRED",
          });
        }
        return loadPedidosHistoricoHttp({
          clienteId: cliente.id,
          groupId,
          empresaId,
          signal,
          limit: PEDIDOS_KPI_LIMIT,
          offset: 0,
          expectedActorId: sessionActorId,
          expectedSessionKey: sessionCacheKey,
        });
      }
      const rows = await filterInContext("Pedido", { cliente_id: cliente.id }, "-data_pedido", PEDIDOS_KPI_LIMIT);
      const data = Array.isArray(rows) ? rows : [];
      return {
        data,
        meta: { limit: PEDIDOS_KPI_LIMIT, offset: 0, total: data.length, hasMore: false },
      };
    },
    enabled: consultaHabilitada,
    staleTime: 60_000,
    retry: false,
  });

  const pedidos = Array.isArray(pedidosPage?.data) ? pedidosPage.data : [];
  const kpisDisponiveis = consultaHabilitada && !pedidosErro && pedidosPage != null;
  const resolvedKpis = kpisDisponiveis
    ? resolveDetalhesClienteKpisFromPage({ pedidos, meta: pedidosPage?.meta })
    : { moneyIncomplete: false, kpis: { totalCompras: null, ticketMedio: null, qtdPedidos: null, qtdAtivos: null } };
  const kpis = resolvedKpis.kpis;
  const kpisMoneyIncomplete = Boolean(resolvedKpis.moneyIncomplete);

  const fmtMoney = (n) =>
    n == null
      ? "—"
      : `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const statusColors = {
    Ativo: "bg-green-100 text-green-700",
    Inativo: "bg-red-100 text-red-700",
    Prospect: "bg-blue-100 text-blue-700",
    Bloqueado: "bg-orange-100 text-orange-700"
  };

  const httpIndisponivel =
    httpMode
    && podeVisualizarDetalhes
    && contextoValido
    && (!consultaHabilitada || pedidosErro);

  const content = (
    <div className={windowMode ? "w-full h-full overflow-auto bg-white p-4" : "w-full h-full"} data-context-required="true" data-permission="Comercial.Pedido.visualizar">
      {(!contextoValido || !podeVisualizarDetalhes) && (
        <Alert className="mb-4 border-amber-200 bg-amber-50" data-context-required="true" data-permission="Comercial.Pedido.visualizar">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Detalhes do cliente exigem contexto de grupo/empresa e permissão para visualizar pedidos ou clientes.
          </AlertDescription>
        </Alert>
      )}

      {httpIndisponivel && (
        <Alert
          className="mb-4 border-sky-200 bg-sky-50"
          data-action="detalhes-cliente-pedidos-http-indisponivel"
          data-context-required="true"
        >
          <ShieldAlert className="h-4 w-4 text-sky-700" />
          <AlertDescription className="text-sky-900">
            {pedidosErro
              ? (pedidosError?.message || "Falha ao carregar pedidos do cliente em HTTP. KPIs não usam zero como ausência.")
              : "Pedidos do cliente indisponíveis em HTTP até sessão/empresa válidos. Não use R$ 0,00 como “sem compras”."}
          </AlertDescription>
        </Alert>
      )}

      {kpisDisponiveis && kpisMoneyIncomplete && (
        <Alert
          className="mb-4 border-sky-200 bg-sky-50"
          data-action="detalhes-cliente-kpis-pagina-incompleta"
          data-context-required="true"
        >
          <ShieldAlert className="h-4 w-4 text-sky-700" />
          <AlertDescription className="text-sky-900">
            Total/ticket não calculados pela 1ª página ({PEDIDOS_KPI_LIMIT}). Contagem usa total do servidor quando disponível; agregação monetária completa = gate futuro.
          </AlertDescription>
        </Alert>
      )}

      <Card className={windowMode ? "border shadow-sm" : "border-0 shadow-none m-4"}>
        <CardHeader className="border-b bg-white">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl">{cliente.nome || cliente.razao_social}</CardTitle>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                {cliente.codigo != null && String(cliente.codigo).trim() !== '' && (
                  <p className="text-sm font-mono tabular-nums text-slate-700" data-action="codigo-registro-cliente-360" title="Código de registro (não é o ID técnico)">
                    Cód. {String(cliente.codigo)}
                  </p>
                )}
                {cliente.id && (
                  <p className="text-xs font-mono text-slate-500" data-action="id-tecnico-cliente-360" title="ID técnico imutável">
                    ID {String(cliente.id)}
                  </p>
                )}
                <p className="text-sm text-slate-600">{cliente.tipo}</p>
                <Badge className={statusColors[cliente.status]}>{cliente.status}</Badge>
              </div>
            </div>
            {!windowMode && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <CentralCliente360Panel
            clienteId={cliente.id}
            groupId={groupId}
            empresaId={empresaId || empresaAtual?.id}
            actorId={actorId}
            actorEmail={actorEmail}
            token={sessionToken}
          />

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6" data-action="detalhes-cliente-kpis-pedidos">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-xs text-slate-600">Total Compras</p>
                  <p className="text-2xl font-bold text-blue-600" data-action="kpi-total-compras">
                    {pedidosFetching && !kpisDisponiveis ? "…" : fmtMoney(kpis.totalCompras)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <FileText className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-xs text-slate-600">Pedidos</p>
                  <p className="text-2xl font-bold text-green-600" data-action="kpi-qtd-pedidos">
                    {pedidosFetching && !kpisDisponiveis ? "…" : (kpis.qtdPedidos == null ? "—" : kpis.qtdPedidos)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className="w-5 h-5 text-sky-600" />
                  </div>
                  <p className="text-xs text-slate-600">Ticket Médio</p>
                  <p className="text-2xl font-bold text-sky-600" data-action="kpi-ticket-medio">
                    {pedidosFetching && !kpisDisponiveis ? "…" : fmtMoney(kpis.ticketMedio)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <HistoricoOrigemCliente clienteId={cliente.id} compact={false} />

              <div data-action="detalhes-cliente-ultimos-pedidos">
                <h3 className="font-semibold text-slate-900 mb-2">Últimos Pedidos</h3>
                {!kpisDisponiveis ? (
                  <p className="text-sm text-slate-500">
                    {pedidosFetching ? "Carregando pedidos…" : "Lista de pedidos indisponível neste contexto."}
                  </p>
                ) : pedidos.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum pedido neste escopo.</p>
                ) : (
                  pedidos.slice(0, 5).map((pedido) => (
                    <div key={pedido.id} className="flex items-center justify-between py-2 border-b">
                      <div>
                        <p className="font-medium">{pedido.numero_pedido || pedido.numero}</p>
                        <p className="text-xs text-slate-500">
                          {(() => {
                            const raw = pedido.data_pedido || pedido.created_at;
                            if (!raw) return "—";
                            const d = new Date(raw);
                            return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
                          })()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {fmtMoney(pedidoValorTotal(pedido))}
                        </p>
                        <Badge variant="outline" className="text-xs">{pedido.status}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Histórico de produtos paginado — mesmo componente do Painel Cadastros; fluxo Comercial360. */}
              <div data-action="cliente-360-historico-produtos" data-permission="Comercial.Pedido.visualizar">
                <h3 className="font-semibold text-slate-900 mb-2">Histórico de Produtos</h3>
                <HistoricoProdutosCliente clienteId={cliente.id} />
              </div>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );

  if (windowMode) return content;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="border-t-2 border-blue-200 bg-gradient-to-r from-blue-50 to-slate-50"
    >
      {content}
    </motion.div>
  );
}
