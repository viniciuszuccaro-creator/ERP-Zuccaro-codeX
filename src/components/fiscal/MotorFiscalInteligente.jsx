import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Zap, CheckCircle, AlertTriangle, FileText, Shield } from "lucide-react";
import { toast } from "sonner";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import usePermissions from "@/components/lib/usePermissions";
import {
  assertIaUiContext,
  stampIaFiscalSuggestion,
} from "@/components/lib/iaTransversalPolicy";

export default function MotorFiscalInteligente({ windowMode = false }) {
  const [pedidoValidacao, setPedidoValidacao] = useState(null);
  const { filterInContext, createInContext, empresaAtual, grupoAtual, estaNoGrupo } = useContextoVisual();
  const { user } = useUser();
  const { hasPermission, isAdmin } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const scopeType = estaNoGrupo ? "grupo" : "empresa";
  let contextoValido = false;
  try {
    assertIaUiContext({ groupId, empresaId, scopeType });
    contextoValido = true;
  } catch {
    contextoValido = false;
  }
  const canView = isAdmin?.() || hasPermission("Fiscal", null, "visualizar") || hasPermission("Fiscal", "NotaFiscal", "visualizar");

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-fiscal-ia", groupId, empresaId, scopeType],
    queryFn: () => filterInContext("Pedido", {}, "-data_pedido", 100),
    enabled: contextoValido && canView,
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-fiscal-ia", groupId, empresaId, scopeType],
    queryFn: () => filterInContext("Empresa", {}, "razao_social", 50),
    enabled: contextoValido && canView,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-fiscal-ia", groupId, empresaId, scopeType],
    queryFn: () => filterInContext("Produto", {}, "descricao", 200),
    enabled: contextoValido && canView,
  });

  const validarFiscalIAMutation = useMutation({
    mutationFn: async ({ pedidoId }) => {
      const ctx = assertIaUiContext({ groupId, empresaId, scopeType });
      if (!canView) throw new Error("Sem permissao para validacao fiscal com IA.");

      const pedido = pedidos.find((p) => p.id === pedidoId);
      if (!pedido) throw new Error("Pedido nao encontrado no contexto.");
      const empresa = empresas.find((e) => e.id === pedido?.empresa_id) || empresaAtual;

      toast.info("IA validando operacao fiscal (apenas sugestao)...");

      const result = await base44.integrations.Core.InvokeLLM({
        group_id: ctx.group_id,
        empresa_id: ctx.empresa_id,
        prompt: `Valide esta operação fiscal. APENAS SUGIRA. Nao emita NF nem altere pedido.

Pedido: ${pedido.numero_pedido}
Cliente: ${pedido.cliente_nome}
Valor: R$ ${pedido.valor_total}
Tipo Pedido: ${pedido.tipo_pedido}
CFOP Pedido: ${pedido.cfop_pedido || "Não definido"}
Natureza: ${pedido.natureza_operacao || "Não definida"}

Empresa:
- Regime: ${empresa?.regime_tributario || "Não definido"}
- Estado: ${empresa?.estado || "Não definido"}

Itens:
${JSON.stringify(pedido.itens_revenda?.map((i) => ({
  descricao: i.produto_descricao || i.descricao,
  valor: i.valor_total,
})) || [])}

Verifique:
1. CFOP correto para a operação
2. Regime tributário compatível
3. Destaque de impostos (ICMS, PIS, COFINS, IPI)
4. Triangulação ou operações especiais
5. NCM dos produtos

Retorne validação e alertas.`,
        response_json_schema: {
          type: "object",
          properties: {
            valido: { type: "boolean" },
            cfop_sugerido: { type: "string" },
            alertas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  tipo: { type: "string" },
                  severidade: { type: "string" },
                  descricao: { type: "string" },
                  sugestao: { type: "string" },
                },
              },
            },
            impostos_validados: { type: "boolean" },
          },
        },
      });

      const validacao = stampIaFiscalSuggestion(result);
      await createInContext("AuditoriaIA", {
        group_id: ctx.group_id,
        empresa_id: ctx.empresa_id,
        modulo: "Fiscal",
        funcionalidade: "MotorFiscalInteligente",
        usuario_id: user?.id || null,
        usuario_nome: user?.full_name || user?.email || "Usuario",
        data_hora: new Date().toISOString(),
        input_dados: { pedido_id: pedidoId, modo: "sugestao" },
        output_resultado: validacao,
        status: "Sugestao",
      });

      return { pedidoId, validacao };
    },
    onSuccess: ({ pedidoId, validacao }) => {
      setPedidoValidacao({ pedidoId, ...validacao });
      if (validacao.valido) {
        toast.success("Sugestao fiscal sem alertas criticos. Revise antes de emitir NF.");
      } else {
        toast.warning("Sugestao fiscal com alertas. IA nao emite NF.");
      }
    },
    onError: (error) => {
      toast.error(String(error?.message || "Falha na validacao fiscal com IA."));
    },
  });

  const pedidosProntos = pedidos.filter((p) =>
    p.status === "Aprovado" || p.status === "Pronto para Faturar"
  );

  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-auto" : "space-y-6 w-full h-full";

  return (
    <div className={containerClass} data-context-required="true">
      <div className={windowMode ? "p-6 space-y-6 flex-1 overflow-auto" : "space-y-6"}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Motor Fiscal Inteligente</h2>
            <p className="text-sm text-slate-600 mt-1">Validação assistida com IA (sugestão; emissão só no fluxo fiscal)</p>
          </div>
        </div>

        {!contextoValido && (
          <Alert className="border-amber-300 bg-amber-50">
            <AlertDescription>Selecione grupo e empresa para usar o motor fiscal com IA.</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Pedidos Prontos</p>
                  <p className="text-2xl font-bold">{pedidosProntos.length}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Ultima sugestao</p>
                  <p className="text-2xl font-bold text-green-600">{pedidoValidacao?.valido ? "OK" : pedidoValidacao ? "Alertas" : "—"}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Alertas na sugestao</p>
                  <p className="text-2xl font-bold text-orange-600">{pedidoValidacao?.alertas?.length || 0}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Produtos c/ NCM</p>
                  <p className="text-2xl font-bold">
                    {produtos.filter((p) => p.ncm).length}
                  </p>
                </div>
                <Shield className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {pedidoValidacao && (
          <Alert className={pedidoValidacao.valido ? "border-green-300 bg-green-50" : "border-orange-300 bg-orange-50"}>
            <AlertDescription>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Sugestão Fiscal - Pedido {pedidoValidacao.pedidoId}</h3>
                  <Badge className={pedidoValidacao.valido ? "bg-green-600" : "bg-orange-600"}>
                    {pedidoValidacao.valido ? "Sem alertas críticos" : "Com alertas"}
                  </Badge>
                </div>

                {pedidoValidacao.cfop_sugerido && (
                  <p className="text-sm">
                    <strong>CFOP Sugerido:</strong> {pedidoValidacao.cfop_sugerido}
                  </p>
                )}

                {pedidoValidacao.alertas?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Alertas Detectados:</p>
                    {pedidoValidacao.alertas.map((alerta, idx) => (
                      <div key={idx} className="p-3 bg-white rounded border">
                        <p className="text-sm font-semibold">{alerta.tipo}</p>
                        <p className="text-xs text-slate-600 mt-1">{alerta.descricao}</p>
                        {alerta.sugestao && (
                          <p className="text-xs text-blue-600 mt-2">{alerta.sugestao}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Pedidos Prontos para Validação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3 text-sm font-semibold">Pedido</th>
                    <th className="text-left p-3 text-sm font-semibold">Cliente</th>
                    <th className="text-right p-3 text-sm font-semibold">Valor</th>
                    <th className="text-left p-3 text-sm font-semibold">CFOP</th>
                    <th className="text-left p-3 text-sm font-semibold">Status</th>
                    <th className="text-center p-3 text-sm font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {!contextoValido || !canView ? (
                    <tr>
                      <td colSpan="6" className="text-center p-6 text-slate-500">
                        Contexto ou permissao insuficiente
                      </td>
                    </tr>
                  ) : pedidosProntos.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center p-6 text-slate-500">
                        Nenhum pedido pronto para validação
                      </td>
                    </tr>
                  ) : (
                    pedidosProntos.slice(0, 10).map((pedido) => (
                      <tr key={pedido.id} className="border-b hover:bg-slate-50">
                        <td className="p-3 text-sm font-semibold">{pedido.numero_pedido}</td>
                        <td className="p-3 text-sm">{pedido.cliente_nome}</td>
                        <td className="p-3 text-sm text-right">
                          R$ {(pedido.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-sm">
                          {pedido.cfop_pedido ? (
                            <Badge variant="outline">{pedido.cfop_pedido}</Badge>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge className="bg-blue-100 text-blue-800">{pedido.status}</Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            size="sm"
                            onClick={() => validarFiscalIAMutation.mutate({ pedidoId: pedido.id })}
                            disabled={validarFiscalIAMutation.isPending || !contextoValido}
                          >
                            <Zap className="w-3 h-3 mr-1" />
                            Validar IA
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
