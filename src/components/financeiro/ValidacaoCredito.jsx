import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { evaluatePedidoCredito } from "@/components/lib/pedidoFaturamentoPolicy";

/**
 * Validação de crédito reutilizando evaluatePedidoCredito (Onda 6).
 * Aceita cliente já carregado (painel HTTP) ou busca legada via Base44.
 */
export default function ValidacaoCredito({
  clienteId,
  valorPedido,
  pedidoId,
  cliente: clienteProp = null,
  groupId = null,
  empresaId = null,
  permitirOverride = false,
}) {
  const contextoPronto = Boolean(groupId && empresaId);
  const { data: clienteFetch, isLoading } = useQuery({
    queryKey: ['cliente-credito', groupId, empresaId, clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      const clientes = await base44.entities.Cliente.filter({ id: clienteId });
      return clientes[0] || null;
    },
    enabled: !!clienteId && !clienteProp && contextoPronto,
  });

  const { data: pedidosPendentes = [] } = useQuery({
    queryKey: ['pedidos-pendentes-cliente', groupId, empresaId, clienteId, pedidoId],
    queryFn: async () => {
      if (!clienteId) return [];
      const pedidos = await base44.entities.Pedido.filter({
        cliente_id: clienteId,
        status: { $in: ["Aprovado", "Em Produção", "Faturado"] },
      });
      return pedidos.filter((p) => p.id !== pedidoId);
    },
    enabled: !!clienteId && !clienteProp && contextoPronto,
  });

  if (!clienteId && !clienteProp) return null;
  if (!contextoPronto && !clienteProp) {
    return (
      <Alert className="w-full border-amber-200 bg-amber-50" data-context-required="true" data-permission="Comercial.pedido.visualizar">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Selecione grupo e empresa para analisar crédito.</AlertDescription>
      </Alert>
    );
  }
  if (isLoading && !clienteProp) {
    return (
      <Card className="border-blue-200 bg-blue-50 w-full">
        <CardContent className="p-4">
          <div className="animate-pulse">Verificando crédito...</div>
        </CardContent>
      </Card>
    );
  }

  const cliente = clienteProp || clienteFetch;
  if (!cliente) return null;

  const valorPendenteOutrosPedidos = (Array.isArray(pedidosPendentes) ? pedidosPendentes : [])
    .reduce((sum, p) => sum + (Number(p.valor_total) || 0), 0);
  const clienteAjustado = valorPendenteOutrosPedidos > 0
    ? {
      ...cliente,
      condicao_comercial: {
        ...(cliente.condicao_comercial || {}),
        limite_credito_utilizado:
          Number(cliente.condicao_comercial?.limite_credito_utilizado || 0) + valorPendenteOutrosPedidos,
      },
    }
    : cliente;

  const evaluation = evaluatePedidoCredito({
    pedido: {
      cliente_id: clienteId || cliente.id,
      valor_total: valorPedido,
      limite_credito_override: false,
    },
    cliente: clienteAjustado,
    permitirOverride,
  });

  const limiteTotal = Number(evaluation.limite_total || 0);
  const limiteUtilizado = Number(evaluation.limite_utilizado || 0);
  const limiteDisponivel = Number(evaluation.limite_disponivel || 0);
  const limiteAposAprovacao = limiteDisponivel - Number(valorPedido || 0);
  const percentualUtilizado = limiteTotal > 0
    ? ((limiteUtilizado + Number(valorPedido || 0)) / limiteTotal) * 100
    : 0;

  let status = "aprovado";
  let statusTexto = "Crédito Aprovado";
  let statusIcon = CheckCircle;
  let statusCor = "green";

  if (!evaluation.aprovado && /sem limite/i.test(evaluation.motivo || "")) {
    status = "sem_limite";
    statusTexto = "Sem Limite Configurado";
    statusIcon = AlertTriangle;
    statusCor = "amber";
  } else if (!evaluation.aprovado) {
    status = "reprovado";
    statusTexto = "Crédito Insuficiente";
    statusIcon = XCircle;
    statusCor = "red";
  } else if (percentualUtilizado > 90) {
    status = "alerta";
    statusTexto = "Atenção: Limite Quase Esgotado";
    statusIcon = AlertTriangle;
    statusCor = "orange";
  }

  const StatusIcon = statusIcon;

  return (
    <Card
      className={`w-full border-2 ${
        statusCor === "green" ? "border-green-300 bg-green-50"
          : statusCor === "red" ? "border-red-300 bg-red-50"
            : statusCor === "orange" ? "border-orange-300 bg-orange-50"
              : "border-amber-300 bg-amber-50"
      }`}
      data-permission="Comercial.pedido.visualizar"
      data-action="analise-credito"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <StatusIcon className={`w-5 h-5 text-${statusCor}-600`} />
          Análise de Crédito
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status:</span>
          <Badge className={`${
            statusCor === "green" ? "bg-green-600"
              : statusCor === "red" ? "bg-red-600"
                : statusCor === "orange" ? "bg-orange-600"
                  : "bg-amber-600"
          }`}>
            {statusTexto}
          </Badge>
        </div>
        <p className="text-xs text-slate-600">{evaluation.motivo}</p>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-700">Limite Total:</span>
            <span className="font-bold">R$ {limiteTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-700">Já Utilizado:</span>
            <span className="font-semibold text-blue-600">
              R$ {limiteUtilizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          {valorPendenteOutrosPedidos > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-700">Pedidos Pendentes ({pedidosPendentes.length}):</span>
              <span className="font-semibold text-orange-600">
                R$ {valorPendenteOutrosPedidos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t">
            <span className="text-slate-700">Disponível Atual:</span>
            <span className="font-bold text-green-600">
              R$ {limiteDisponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-700">Valor deste Pedido:</span>
            <span className="font-bold text-blue-900">
              R$ {Number(valorPedido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t font-bold">
            <span>Disponível Após Aprovação:</span>
            <span className={limiteAposAprovacao >= 0 ? "text-green-600" : "text-red-600"}>
              R$ {limiteAposAprovacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {limiteTotal > 0 && (
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Utilização do Limite</span>
              <span className="font-semibold">{percentualUtilizado.toFixed(1)}%</span>
            </div>
            <Progress
              value={Math.min(percentualUtilizado, 100)}
              className={`h-3 ${
                percentualUtilizado > 100 ? "[&>div]:bg-red-600"
                  : percentualUtilizado > 90 ? "[&>div]:bg-orange-600"
                    : "[&>div]:bg-green-600"
              }`}
            />
          </div>
        )}

        {status === "reprovado" && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Pedido bloqueado!</strong> O valor excede o limite de crédito disponível.
              Necessário permissão aprovar-crédito ou pagamento antecipado.
            </AlertDescription>
          </Alert>
        )}

        {status === "alerta" && (
          <Alert className="border-orange-300 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-xs text-orange-900">
              <strong>Atenção:</strong> Este pedido utilizará {percentualUtilizado.toFixed(0)}% do limite total.
            </AlertDescription>
          </Alert>
        )}

        {status === "sem_limite" && (
          <Alert className="border-amber-300 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-900">
              Cliente sem limite de crédito cadastrado. Venda condicionada exige alçada aprovar-crédito.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
