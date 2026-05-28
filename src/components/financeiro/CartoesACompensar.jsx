import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreditCard, CheckCircle, AlertCircle, DollarSign } from "lucide-react";
import { toast } from "sonner";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";

export default function CartoesACompensar() {
  const queryClient = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const { filterInContext, updateInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaId || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const canViewCartoes = hasPermission("Financeiro", "Cartoes", "visualizar") ||
    hasPermission("Financeiro", "Caixa Central", "visualizar") ||
    hasPermission("Financeiro", null, "visualizar");
  const canConciliarCartoes = hasPermission("Financeiro", "Cartoes", "conciliar") ||
    hasPermission("Financeiro", "Caixa Central", "editar") ||
    hasPermission("Financeiro", null, "editar");

  const { data: cartoes = [], isLoading } = useQuery({
    queryKey: ["movimento-cartao", contextKey],
    queryFn: () => filterInContext("MovimentoCartao", {}, "-created_date", 500),
    enabled: contextoValido && canViewCartoes,
  });

  const auditarCartao = async ({ acao, cartao, descricao, dadosAnteriores, dadosNovos, sucesso = true }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: "Financeiro",
        entidade: "MovimentoCartao",
        registro_id: cartao?.id || null,
        descricao,
        usuario_id: user?.id || null,
        usuario: user?.full_name || user?.email || "Usuario local",
        empresa_id: cartao?.empresa_id || empresaId,
        group_id: cartao?.group_id || groupId,
        grupo_id: cartao?.grupo_id || cartao?.group_id || groupId,
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        sucesso,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar cartao a compensar:", error);
    }
  };

  const conciliarMutation = useMutation({
    mutationFn: async ({ cartao }) => {
      if (!contextoValido || !canConciliarCartoes) {
        throw new Error("Sem contexto ou permissao para conciliar cartao.");
      }
      return updateInContext("MovimentoCartao", cartao.id, {
        group_id: cartao.group_id || groupId,
        grupo_id: cartao.grupo_id || cartao.group_id || groupId,
        empresa_id: cartao.empresa_id || empresaId,
        status_compensacao: "Compensado",
        data_recebimento_efetivo: new Date().toISOString().split("T")[0]
      });
    },
    onSuccess: async (updated, { cartao }) => {
      await auditarCartao({
        acao: "Conciliacao",
        cartao,
        descricao: "Cartao compensado manualmente.",
        dadosAnteriores: cartao,
        dadosNovos: updated
      });
      queryClient.invalidateQueries({ queryKey: ["movimento-cartao"] });
      toast.success("Cartao compensado com sucesso!");
    },
    onError: (error) => {
      toast.error(error.message || "Falha ao conciliar cartao.");
    }
  });

  const handleConciliar = async (cartao) => {
    if (!contextoValido || !canConciliarCartoes) {
      await auditarCartao({
        acao: "Bloqueio",
        cartao,
        descricao: "Conciliacao de cartao bloqueada por falta de contexto ou permissao.",
        dadosAnteriores: cartao,
        sucesso: false
      });
      toast.error("Selecione grupo/empresa e confirme permissao para conciliar.");
      return;
    }
    if (!window.confirm("Confirmar compensacao deste cartao?")) {
      await auditarCartao({
        acao: "Cancelamento",
        cartao,
        descricao: "Usuario cancelou a compensacao do cartao.",
        dadosAnteriores: cartao,
        sucesso: false
      });
      return;
    }
    conciliarMutation.mutate({ cartao });
  };

  const cartoesFiltrados = filtroStatus === "todos"
    ? cartoes
    : cartoes.filter(c => c.status_compensacao === filtroStatus);

  const totalEmTransito = cartoes
    .filter(c => c.status_compensacao === "Em Transito" || c.status_compensacao === "Em TrÃ¢nsito" || c.status_compensacao === "A Compensar")
    .reduce((acc, c) => acc + (c.valor_liquido || 0), 0);

  const totalCompensado = cartoes
    .filter(c => c.status_compensacao === "Compensado")
    .reduce((acc, c) => acc + (c.valor_liquido || 0), 0);

  if (isLoading) return <div className="p-6">Carregando cartoes...</div>;

  return (
    <div className="space-y-6 w-full h-full" data-permission="Financeiro.Cartoes.visualizar" data-context-required="group-or-company">
      {(!contextoValido || !canViewCartoes) && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <AlertDescription>Selecione grupo ou empresa e confirme permissao para visualizar cartoes a compensar.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Em Transito</p>
                <p className="text-2xl font-bold">
                  R$ {totalEmTransito.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <CreditCard className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Compensado</p>
                <p className="text-2xl font-bold text-green-600">
                  R$ {totalCompensado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Transacoes</p>
                <p className="text-2xl font-bold">{cartoes.length}</p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Cartoes a Compensar</CardTitle>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg"
              data-action="CartoesACompensar.filtroStatus"
              data-permission="Financeiro.Cartoes.visualizar"
            >
              <option value="todos">Todos</option>
              <option value="Em TrÃ¢nsito">Em Transito</option>
              <option value="A Compensar">A Compensar</option>
              <option value="Compensado">Compensado</option>
              <option value="Divergente">Divergente</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 text-sm font-semibold">Data</th>
                  <th className="text-left p-3 text-sm font-semibold">Cliente</th>
                  <th className="text-left p-3 text-sm font-semibold">Bandeira</th>
                  <th className="text-left p-3 text-sm font-semibold">Adquirente</th>
                  <th className="text-left p-3 text-sm font-semibold">NSU</th>
                  <th className="text-right p-3 text-sm font-semibold">Valor Bruto</th>
                  <th className="text-right p-3 text-sm font-semibold">Taxa</th>
                  <th className="text-right p-3 text-sm font-semibold">Valor Liquido</th>
                  <th className="text-left p-3 text-sm font-semibold">Previsao</th>
                  <th className="text-left p-3 text-sm font-semibold">Status</th>
                  <th className="text-center p-3 text-sm font-semibold">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {cartoesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="text-center p-6 text-slate-500">
                      Nenhum cartao encontrado
                    </td>
                  </tr>
                ) : (
                  cartoesFiltrados.map((cartao) => (
                    <tr key={cartao.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 text-sm">
                        {cartao.data_transacao ? new Date(cartao.data_transacao).toLocaleDateString("pt-BR") : "-"}
                      </td>
                      <td className="p-3 text-sm">{cartao.cliente_nome}</td>
                      <td className="p-3 text-sm">
                        <Badge variant="outline">{cartao.bandeira}</Badge>
                      </td>
                      <td className="p-3 text-sm">{cartao.adquirente}</td>
                      <td className="p-3 text-sm font-mono text-xs">{cartao.nsu}</td>
                      <td className="p-3 text-sm text-right">
                        R$ {(cartao.valor_bruto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-sm text-right text-red-600">
                        {cartao.taxa_mdr_percentual}% (-R$ {(cartao.valor_taxa || 0).toFixed(2)})
                      </td>
                      <td className="p-3 text-sm text-right font-semibold">
                        R$ {(cartao.valor_liquido || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-sm">
                        {cartao.previsao_recebimento
                          ? new Date(cartao.previsao_recebimento).toLocaleDateString("pt-BR")
                          : "-"}
                      </td>
                      <td className="p-3">
                        <Badge
                          className={
                            cartao.status_compensacao === "Compensado" ? "bg-green-100 text-green-800" :
                            cartao.status_compensacao === "Divergente" ? "bg-red-100 text-red-800" :
                            "bg-yellow-100 text-yellow-800"
                          }
                        >
                          {cartao.status_compensacao}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        {cartao.status_compensacao !== "Compensado" && (
                          <Button
                            size="sm"
                            onClick={() => handleConciliar(cartao)}
                            disabled={conciliarMutation.isPending || !contextoValido || !canConciliarCartoes}
                            data-action="CartoesACompensar.conciliar"
                            data-permission="Financeiro.Cartoes.conciliar"
                            data-context-required="group-or-company"
                            data-sensitive="true"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Conciliar
                          </Button>
                        )}
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
  );
}
