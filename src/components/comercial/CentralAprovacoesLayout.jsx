import React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, DollarSign, Shield, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

export function CentralAprovacoesShell({ windowMode, contextoValido, acessoPermitido, children }) {
  const containerClass = windowMode
    ? "w-full h-full flex flex-col overflow-hidden"
    : "w-full h-full space-y-6";
  const contentClass = windowMode ? "flex-1 overflow-y-auto p-6" : "";

  return (
    <div className={containerClass} data-context-required="true">
      <div className={contentClass}>
        {(!contextoValido || !acessoPermitido) && (
          <Alert className="mb-6 border-red-300 bg-red-50">
            <Shield className="h-4 w-4 text-red-600" />
            <AlertDescription>
              <p className="font-semibold text-red-900">Acesso negado</p>
              <p className="mt-1 text-sm text-red-700">
                Selecione um contexto válido e confirme as permissões do seu perfil para acessar esta central.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <ShieldCheck className="h-7 w-7 text-orange-600" />
              Central de Aprovações V21.6
            </h2>
            <p className="text-sm text-slate-600">Gerencie aprovações com fechamento automático integrado</p>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

function fmtMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

/**
 * Abas Limite / Duplicatas — recupera listagens no existente (sem stub).
 * Manager permanece intocado (hash pin stage54); dados via filterInContext.
 */
export function AprovacoesPlaceholder({ tipo }) {
  const limite = tipo === "limite";
  const Icon = limite ? DollarSign : AlertCircle;
  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id || null : null;
  const contextoValido = contexto === "grupo" ? Boolean(groupId) : Boolean(groupId && empresaId);
  const podeVisualizar =
    hasPermission("Comercial", "Pedido", "visualizar") ||
    hasPermission("Comercial", "Pedido", "aprovar") ||
    hasPermission("Comercial.Pedido.visualizar") ||
    hasPermission("Comercial.Pedido.aprovar") ||
    hasPermission("Financeiro", "ContaReceber", "visualizar") ||
    hasPermission("Financeiro.ContaReceber.visualizar");
  const consultaHabilitada = Boolean(contextoValido && podeVisualizar);

  const pedidosQuery = useQuery({
    queryKey: ["central-aprovacoes-limite-pedidos", groupId, empresaId, contexto],
    queryFn: () =>
      filterInContext(
        "Pedido",
        empresaId ? { empresa_id: empresaId, status_aprovacao: "pendente" } : { status_aprovacao: "pendente" },
        "-created_date",
        100,
      ),
    enabled: consultaHabilitada && limite,
    retry: false,
  });

  const duplicatasQuery = useQuery({
    queryKey: ["central-aprovacoes-duplicatas", groupId, empresaId, contexto],
    queryFn: () =>
      filterInContext(
        "ContaReceber",
        empresaId ? { empresa_id: empresaId, status: "Atrasado" } : { status: "Atrasado" },
        "-data_vencimento",
        100,
      ),
    enabled: consultaHabilitada && !limite,
    retry: false,
  });

  const activeQuery = limite ? pedidosQuery : duplicatasQuery;
  const status = !consultaHabilitada
    ? "blocked"
    : activeQuery.isError
      ? "unavailable"
      : activeQuery.isLoading || (activeQuery.isFetching && !activeQuery.data)
        ? "loading"
        : "ok";
  const rows = Array.isArray(activeQuery.data) ? activeQuery.data : [];
  const hint =
    status === "blocked"
      ? "Contexto ou permissão insuficientes"
      : status === "unavailable"
        ? activeQuery.error?.message || "Dados indisponíveis neste contexto"
        : status === "loading"
          ? "Carregando…"
          : null;

  return (
    <Card
      className="mt-4 border-0 shadow-md"
      data-action={limite ? "central-aprovacoes-limite" : "central-aprovacoes-duplicatas"}
      data-kpi-status={status}
    >
      <CardHeader className={limite ? "border-b bg-sky-50" : "border-b bg-red-50"}>
        <CardTitle className="flex items-center gap-2">
          <Icon className={limite ? "h-5 w-5 text-sky-600" : "h-5 w-5 text-red-600"} />
          {limite ? "Aprovações de Limite de Crédito" : "Aprovações de Duplicatas Vencidas"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {hint ? (
          <p
            className={`p-6 text-sm ${status === "unavailable" ? "text-amber-800" : "text-slate-500"}`}
            role={status === "unavailable" ? "alert" : "status"}
            data-action="central-aprovacoes-hint"
          >
            {status === "unavailable" || status === "blocked" || status === "loading"
              ? status === "unavailable" || status === "blocked"
                ? "DESCONHECIDO — " + hint
                : hint
              : hint}
          </p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500" data-action="central-aprovacoes-vazio">
            {limite
              ? "Nenhum pedido pendente de aprovação neste contexto."
              : "Nenhuma duplicata atrasada neste contexto."}
          </p>
        ) : limite ? (
          <Table data-action="central-aprovacoes-limite-tabela">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((pedido) => (
                <TableRow key={pedido.id}>
                  <TableCell className="font-medium">{pedido.numero_pedido || pedido.id}</TableCell>
                  <TableCell>{pedido.cliente_nome || pedido.cliente_razao_social || "—"}</TableCell>
                  <TableCell className="text-right">{fmtMoney(pedido.valor_total)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{pedido.status_aprovacao || pedido.status || "pendente"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table data-action="central-aprovacoes-duplicatas-tabela">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Título</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((conta) => (
                <TableRow key={conta.id}>
                  <TableCell className="font-medium">
                    {conta.numero_titulo || conta.numero_documento || conta.id}
                  </TableCell>
                  <TableCell>{conta.cliente_nome || conta.sacado_nome || "—"}</TableCell>
                  <TableCell>
                    {conta.data_vencimento
                      ? new Date(conta.data_vencimento).toLocaleDateString("pt-BR")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">{fmtMoney(conta.valor || conta.valor_titulo)}</TableCell>
                  <TableCell>
                    <Badge className="bg-red-100 text-red-700">{conta.status || "Atrasado"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {limite && status === "ok" ? (
          <p className="px-6 py-3 text-xs text-slate-500 border-t" data-action="central-aprovacoes-limite-nota">
            A aprovação na aba Descontos continua validando limite via `validarLimiteCredito` (fail-closed).
            Esta lista mostra pendentes no contexto — sem fabricar saldo de crédito.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
