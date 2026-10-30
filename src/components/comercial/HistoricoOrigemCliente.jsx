import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import BadgeOrigemPedido from "./BadgeOrigemPedido";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { History, TrendingUp, ShoppingCart, ShieldAlert } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { resolveErpBackendMode } from "@/api/runtimeBackend";
import { readErpHttpSession } from "@/api/erpHttpSession";
import {
  historicoSessionCacheKey,
  loadPedidosHistoricoHttp,
} from "./HistoricoProdutosCliente";
import {
  resolveOrigemCanalComprovada,
  resolveValorPedidoHistorico,
} from "./historicoComprasClientePolicy";

const PEDIDOS_ORIGEM_LIMIT = 200;

/**
 * V21.6 - Histórico de Origens de um Cliente
 * Mostra preferências e padrões de compra por canal.
 * HTTP: reutiliza loadPedidosHistoricoHttp — erro/indisponível ≠ canal vazio.
 */
export default function HistoricoOrigemCliente({ clienteId, compact = false }) {
  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
  const httpMode = resolveErpBackendMode() === "http";
  const sessionSnapshot = readErpHttpSession();
  const sessionActorId = sessionSnapshot?.actorId || null;
  const sessionCacheKey = historicoSessionCacheKey(sessionSnapshot);
  const podeVisualizarHistorico =
    hasPermission("Comercial.Pedido.visualizar") ||
    hasPermission("CRM.Cliente.visualizar") ||
    hasPermission("comercial", "visualizar_pedido");
  const consultaHabilitada = Boolean(
    clienteId
      && contextoValido
      && podeVisualizarHistorico
      && (!httpMode || (empresaId && sessionActorId && sessionCacheKey)),
  );

  const {
    data: pedidosPage,
    isError: pedidosErro,
    isFetching: pedidosFetching,
    isLoading,
  } = useQuery({
    queryKey: [
      "pedidos-cliente-origem-contexto",
      clienteId,
      groupId,
      empresaId,
      contexto,
      sessionActorId,
      sessionCacheKey,
      httpMode ? "http" : "legado",
    ],
    queryFn: async ({ signal }) => {
      if (!clienteId || !contextoValido || !podeVisualizarHistorico) {
        throw Object.assign(new Error("Historico de origem bloqueado: contexto ou permissao ausente."), {
          code: "ORIGEM_CONTEXT_DENIED",
        });
      }
      if (httpMode) {
        if (!empresaId) {
          throw Object.assign(new Error("Historico de origem HTTP exige empresa no contexto."), {
            code: "EMPRESA_CONTEXT_REQUIRED",
          });
        }
        return loadPedidosHistoricoHttp({
          clienteId,
          groupId,
          empresaId,
          signal,
          limit: PEDIDOS_ORIGEM_LIMIT,
          offset: 0,
          expectedActorId: sessionActorId,
          expectedSessionKey: sessionCacheKey,
        });
      }
      const rows = await filterInContext("Pedido", { cliente_id: clienteId }, "-data_pedido", PEDIDOS_ORIGEM_LIMIT);
      const data = Array.isArray(rows) ? rows : [];
      return {
        data,
        meta: { limit: PEDIDOS_ORIGEM_LIMIT, offset: 0, total: data.length, hasMore: false },
      };
    },
    enabled: consultaHabilitada,
    staleTime: 60_000,
    retry: false,
  });

  const pedidosCliente = Array.isArray(pedidosPage?.data) ? pedidosPage.data : [];
  const dadosDisponiveis = consultaHabilitada && !pedidosErro && pedidosPage != null;

  if (!clienteId) return null;

  if (!contextoValido || !podeVisualizarHistorico) {
    if (compact) return null;
    return (
      <Alert className="w-full h-full border-amber-200 bg-amber-50" data-context-required="true" data-permission="Comercial.Pedido.visualizar">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Histórico de canais exige contexto de grupo/empresa e permissão para visualizar pedidos.
        </AlertDescription>
      </Alert>
    );
  }

  if (httpMode && (!empresaId || !sessionActorId || !sessionCacheKey)) {
    if (compact) {
      return (
        <div
          className="w-full h-full flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200"
          data-action="historico-origem-http-indisponivel"
          data-permission="Comercial.Pedido.visualizar"
        >
          <History className="w-4 h-4 text-amber-700" />
          <p className="text-xs text-amber-800">Canal preferido indisponível (HTTP sem empresa/sessão).</p>
        </div>
      );
    }
    return (
      <Alert
        className="w-full h-full border-amber-200 bg-amber-50"
        data-action="historico-origem-http-indisponivel"
        data-permission="Comercial.Pedido.visualizar"
      >
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Histórico de canais HTTP exige empresa no contexto e sessão autenticada — não inventar distribuição vazia.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading || (pedidosFetching && !dadosDisponiveis)) {
    if (compact) return null;
    return (
      <Card className="w-full h-full border-sky-200 bg-sky-50/40" data-action="historico-origem-carregando">
        <CardContent className="p-4 text-sm text-slate-600">Carregando histórico de canais…</CardContent>
      </Card>
    );
  }

  if (pedidosErro || !dadosDisponiveis) {
    if (compact) {
      return (
        <div
          className="w-full h-full flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200"
          data-action="historico-origem-http-indisponivel"
          data-permission="Comercial.Pedido.visualizar"
        >
          <History className="w-4 h-4 text-amber-700" />
          <p className="text-xs text-amber-800">Canal preferido indisponível (consulta falhou).</p>
        </div>
      );
    }
    return (
      <Alert
        className="w-full h-full border-amber-200 bg-amber-50"
        data-action="historico-origem-http-indisponivel"
        data-permission="Comercial.Pedido.visualizar"
      >
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Não foi possível carregar o histórico de canais. Erro ≠ ausência de pedidos.
        </AlertDescription>
      </Alert>
    );
  }

  if (pedidosCliente.length === 0) return null;

  // HTTP: contrato Pedido sem origem_pedido — não inventar "Manual" (Codex #4425419699).
  // Legado: fallback Manual só quando o campo existe no snapshot local.
  const porOrigem = pedidosCliente.reduce((acc, p) => {
    const comprovada = resolveOrigemCanalComprovada(p);
    const origem = comprovada || (httpMode ? null : "Manual");
    if (!origem) return acc;
    if (!acc[origem]) {
      acc[origem] = { count: 0, valor: 0 };
    }
    acc[origem].count++;
    acc[origem].valor += resolveValorPedidoHistorico(p);
    return acc;
  }, {});

  const dadosPizza = Object.entries(porOrigem).map(([origem, dados]) => ({
    name: origem,
    value: dados.count,
    valor: dados.valor
  })).sort((a, b) => b.value - a.value);

  if (dadosPizza.length === 0) {
    if (compact) {
      return (
        <div
          className="w-full h-full flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200"
          data-action="historico-origem-canal-indisponivel"
          data-permission="Comercial.Pedido.visualizar"
        >
          <History className="w-4 h-4 text-amber-700" />
          <p className="text-xs text-amber-800">Canal preferido indisponível (origem não comprovada no contrato).</p>
        </div>
      );
    }
    return (
      <Alert
        className="w-full h-full border-amber-200 bg-amber-50"
        data-action="historico-origem-canal-indisponivel"
        data-permission="Comercial.Pedido.visualizar"
      >
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Pedidos carregados, mas o canal de origem não está no contrato HTTP — não inferir &quot;Manual&quot;.
        </AlertDescription>
      </Alert>
    );
  }

  const CORES = ["#3b82f6", "#22c55e", "#a855f7", "#f97316", "#ef4444", "#eab308", "#ec4899", "#06b6d4"];
  const origemPreferida = dadosPizza[0];
  const pedidosComCanal = dadosPizza.reduce((sum, row) => sum + row.value, 0);
  const percentualPreferida = (origemPreferida.value / pedidosComCanal) * 100;
  const paginaIncompleta = Boolean(pedidosPage?.meta?.hasMore)
    || (Number.isFinite(Number(pedidosPage?.meta?.total))
      && Number(pedidosPage.meta.total) > pedidosCliente.length);

  if (compact) {
    return (
      <div className="w-full h-full flex items-center gap-2 p-3 bg-sky-50 rounded-lg border border-sky-200" data-context-required="true" data-permission="Comercial.Pedido.visualizar">
        <History className="w-4 h-4 text-sky-700" />
        <div className="flex-1">
          <p className="text-xs text-slate-600">Canal Preferido:</p>
          <BadgeOrigemPedido origemPedido={origemPreferida.name} showLock={false} />
        </div>
        <Badge className="bg-sky-100 text-sky-800">
          {paginaIncompleta ? "—" : `${percentualPreferida.toFixed(0)}%`}
        </Badge>
      </div>
    );
  }

  return (
    <Card className="w-full h-full border-sky-300 bg-gradient-to-br from-sky-50 to-slate-50" data-context-required="true" data-permission="Comercial.Pedido.visualizar">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="w-5 h-5 text-sky-600" />
          Histórico de Canais
        </CardTitle>
        <p className="text-xs text-slate-600 mt-1">
          Análise de {paginaIncompleta ? "—" : pedidosCliente.length} pedidos deste cliente
          {paginaIncompleta ? " (página incompleta — sem % inventado)" : ""}
        </p>
        {paginaIncompleta ? (
          <Alert className="mt-2 border-amber-200 bg-amber-50" data-action="historico-origem-pagina-incompleta">
            <AlertDescription className="text-amber-800 text-xs">
              Há mais pedidos além desta página. Percentuais de canal ficam indisponíveis até agregação completa.
            </AlertDescription>
          </Alert>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={dadosPizza}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    paginaIncompleta ? name : `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dadosPizza.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CORES[index % CORES.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name, props) => [
                    `${value} pedidos (R$ ${props.payload.valor.toFixed(2)})`,
                    name
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            {dadosPizza.map((origem, idx) => {
              const percentual = (origem.value / pedidosComCanal) * 100;
              const ticketMedio = origem.valor / origem.value;

              return (
                <div key={idx} className="p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <BadgeOrigemPedido origemPedido={origem.name} showLock={false} />
                    <Badge className="bg-slate-100 text-slate-700">
                      {paginaIncompleta ? "—" : `${percentual.toFixed(0)}%`}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 flex items-center gap-1">
                      <ShoppingCart className="w-3 h-3" />
                      {origem.value} pedidos
                    </span>
                    <span className="text-green-600 font-semibold">
                      R$ {ticketMedio.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 p-3 bg-sky-50 border border-sky-200 rounded-lg">
          <p className="text-sm text-sky-900">
            <TrendingUp className="w-4 h-4 inline mr-1" />
            <strong>Canal Preferido:</strong> {origemPreferida.name}
            {paginaIncompleta ? " (participação % indisponível — página incompleta)" : ` (${percentualPreferida.toFixed(0)}% dos pedidos)`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
