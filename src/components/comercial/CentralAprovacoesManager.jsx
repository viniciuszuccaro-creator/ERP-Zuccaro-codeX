import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingDown,
  ShieldCheck,
  DollarSign,
  Zap,
  Shield
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWindow } from "@/components/lib/useWindow";
import AnalisePedidoAprovacao from "./AnalisePedidoAprovacao";
import AutomacaoFluxoPedido from "./AutomacaoFluxoPedido";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/components/lib/UserContext";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * 🔐 CENTRAL DE APROVAÇÕES V21.5
 * Gerenciamento unificado de aprovações (descontos, crédito, duplicatas)
 */
function CentralAprovacoesManager({ windowMode = false, initialTab = "descontos", empresaId = null }) {
  // V21.6: Multi-empresa
  const [activeTab, setActiveTab] = useState(initialTab);
  const [aprovacaoDialogOpen, setAprovacaoDialogOpen] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [comentariosAprovacao, setComentariosAprovacao] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { openWindow } = useWindow();
  const { user } = useUser();
  const { filterInContext, updateInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaContextoId = empresaId || (contexto === "empresa" ? empresaAtual?.id : null);
  const contextoValido = Boolean(groupId || empresaContextoId);
  const podeVisualizarAprovacoes =
    user?.role === "admin" ||
    user?.role === "gerente" ||
    hasPermission("Comercial.Pedido.visualizar") ||
    hasPermission("Comercial.Pedido.aprovar");
  const podeEditarAprovacoes =
    user?.role === "admin" ||
    user?.role === "gerente" ||
    hasPermission("Comercial.Pedido.aprovar") ||
    hasPermission("Comercial.Pedido.editar");
  const consultaHabilitada = Boolean(contextoValido && podeVisualizarAprovacoes);

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-aprovacoes-contexto", empresaContextoId, groupId, contexto],
    queryFn: () => filterInContext("Pedido", empresaContextoId ? { empresa_id: empresaContextoId } : {}, "-created_date", 500),
    enabled: consultaHabilitada,
  });


  // V21.6: APROVAÇÃO COM FECHAMENTO AUTOMÁTICO OPCIONAL
  const aprovarPedidoMutation = useMutation({
    mutationFn: async ({ pedidoId, dados, executarFechamento = false }) => {
      if (!contextoValido || !podeEditarAprovacoes) {
        throw new Error("Sem contexto ou permissao para aprovar pedido.");
      }

      const pedidosCompletos = await filterInContext("Pedido", { id: pedidoId }, undefined, 1);
      const pedido = pedidosCompletos[0];
      
      const itensRevendaAtualizados = [];
      const itensArmadoAtualizados = [];
      const itensCorteAtualizados = [];

      if (dados.itensAtualizados) {
        dados.itensAtualizados.forEach(item => {
          if (item.tipo === "Revenda") itensRevendaAtualizados.push(item);
          else if (item.tipo === "Armado Padrão") itensArmadoAtualizados.push(item);
          else if (item.tipo === "Corte e Dobra") itensCorteAtualizados.push(item);
        });
      }

      // Atualizar pedido com aprovação
      await updateInContext("Pedido", pedidoId, {
        status_aprovacao: "aprovado",
        status: "Aprovado",
        usuario_aprovador_id: user?.id,
        data_aprovacao: new Date().toISOString(),
        desconto_aprovado_percentual: dados.descontoGeralPercentual || 0,
        desconto_geral_pedido_percentual: dados.descontoGeralPercentual || 0,
        desconto_geral_pedido_valor: dados.descontoGeralValor || 0,
        valor_total: dados.valorFinal || 0,
        margem_aplicada_vendedor: dados.margemMedia || 0,
        comentarios_aprovacao: dados.comentarios || "",
        ...(itensRevendaAtualizados.length > 0 && { itens_revenda: itensRevendaAtualizados }),
        ...(itensArmadoAtualizados.length > 0 && { itens_armado_padrao: itensArmadoAtualizados }),
        ...(itensCorteAtualizados.length > 0 && { itens_corte_dobra: itensCorteAtualizados }),
      });

      // V21.6: Se solicitado, executar fechamento completo
      if (executarFechamento) {
        const pedidoAtualizado = await filterInContext("Pedido", { id: pedidoId }, undefined, 1);
        return { pedido: pedidoAtualizado[0], executarFechamento: true };
      }

      return { pedido: null, executarFechamento: false };
    },
    onSuccess: (resultado) => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-aprovacoes-contexto"] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['contas-receber'] });
      queryClient.invalidateQueries({ queryKey: ['entregas'] });
      
      toast({ title: "✅ Desconto aprovado!" });
      setAprovacaoDialogOpen(false);
      setPedidoSelecionado(null);

      // V21.6: Se deve executar fechamento, abrir modal de automação
      if (resultado.executarFechamento && resultado.pedido) {
        setTimeout(() => {
          if (window.__currentOpenWindow) {
            window.__currentOpenWindow(
              AutomacaoFluxoPedido,
              { 
                pedido: resultado.pedido,
                windowMode: true,
                autoExecute: true,
                onComplete: () => {
                  toast({ title: "✅ Pedido fechado automaticamente!" });
                }
              },
              {
                title: `🚀 Automação - ${resultado.pedido.numero_pedido}`,
                width: 1200,
                height: 700
              }
            );
          }
        }, 200);
      }
    },
    onError: (error) => {
      toast({ title: "❌ Erro ao aprovar", description: error.message, variant: "destructive" });
    }
  });

  const negarPedidoMutation = useMutation({
    mutationFn: async ({ pedidoId, comentarios }) => {
      if (!contextoValido || !podeEditarAprovacoes) {
        throw new Error("Sem contexto ou permissao para negar pedido.");
      }

      await updateInContext("Pedido", pedidoId, {
        status_aprovacao: "negado",
        usuario_aprovador_id: user?.id,
        data_aprovacao: new Date().toISOString(),
        comentarios_aprovacao: comentarios
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-aprovacoes-contexto"] });
      toast({ title: "❌ Desconto negado" });
      setAprovacaoDialogOpen(false);
      setPedidoSelecionado(null);
    }
  });

  const pedidosPendentes = pedidos.filter(p => p.status_aprovacao === "pendente");
  const pedidosAprovados = pedidos.filter(p => p.status_aprovacao === "aprovado");
  const pedidosNegados = pedidos.filter(p => p.status_aprovacao === "negado");

  // V21.6: Responsividade w-full h-full
  const containerClass = windowMode 
    ? 'w-full h-full flex flex-col overflow-hidden' 
    : 'w-full h-full space-y-6';

  const contentClass = windowMode 
    ? 'flex-1 overflow-y-auto p-6' 
    : '';

  const Wrapper = ({ children }) => windowMode ? (
    <div className={containerClass} data-context-required="true" data-permission="Comercial.Pedido.aprovar">
      <div className={contentClass}>{children}</div>
    </div>
  ) : (
    <div className="w-full h-full space-y-6" data-context-required="true" data-permission="Comercial.Pedido.aprovar">{children}</div>
  );

  return (
    <Wrapper>
      
      {/* V21.6: Controle de Acesso */}
      {(!contextoValido || !podeVisualizarAprovacoes) && (
        <Alert className="border-red-300 bg-red-50 mb-6">
          <Shield className="w-4 h-4 text-red-600" />
          <AlertDescription>
            <p className="font-semibold text-red-900">🔒 Acesso Negado</p>
            <p className="text-sm text-red-700 mt-1">
              Apenas <strong>Administradores</strong> e <strong>Gerentes</strong> podem acessar a Central de Aprovações.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-orange-600" />
            Central de Aprovações V21.6
          </h2>
          <p className="text-slate-600 text-sm">Gerencie aprovações com fechamento automático integrado</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="descontos">Descontos</TabsTrigger>
          <TabsTrigger value="limite">Limite de Crédito</TabsTrigger>
          <TabsTrigger value="duplicatas">Duplicatas Vencidas</TabsTrigger>
        </TabsList>
        
        <TabsContent value="descontos">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 mt-4">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-600 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-600" />
                  Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">
                  {pedidosPendentes.length}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-600 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Aprovados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {pedidosAprovados.length}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-600 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  Negados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {pedidosNegados.length}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-orange-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                Pedidos Pendentes de Aprovação de Desconto
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Desconto Solicitado</TableHead>
                    <TableHead>Margem Após Desconto</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidosPendentes.map(pedido => {
                    const margemAposDesconto = pedido.margem_aplicada_vendedor || 0;
                    const corMargem = margemAposDesconto < 5 ? "text-red-600" : margemAposDesconto < 10 ? "text-yellow-600" : "text-green-600";
                    
                    return (
                      <TableRow key={pedido.id} className="hover:bg-slate-50">
                        <TableCell className="font-semibold">{pedido.numero_pedido}</TableCell>
                        <TableCell>{pedido.cliente_nome}</TableCell>
                        <TableCell className="font-bold">
                          R$ {(pedido.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-orange-100 text-orange-700">
                            <TrendingDown className="w-3 h-3 mr-1" />
                            {pedido.desconto_solicitado_percentual || 0}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`font-bold ${corMargem}`}>
                            {margemAposDesconto.toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {pedido.vendedor || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(pedido.created_date).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                openWindow(
                                  AnalisePedidoAprovacao,
                                  {
                                    pedido,
                                    onAprovar: (dados) => {
                                      aprovarPedidoMutation.mutate({
                                        pedidoId: pedido.id,
                                        dados,
                                        executarFechamento: false
                                      });
                                    },
                                    onNegar: (comentarios) => {
                                      if (!comentarios.trim()) {
                                        toast({ title: "⚠️ Informe o motivo da negação", variant: "destructive" });
                                        return;
                                      }
                                      negarPedidoMutation.mutate({
                                        pedidoId: pedido.id,
                                        comentarios
                                      });
                                    },
                                    windowMode: true
                                  },
                                  {
                                    title: `🔐 Análise: ${pedido.numero_pedido}`,
                                    width: 1400,
                                    height: 800
                                  }
                                );
                              }}
                              className="bg-orange-600 hover:bg-orange-700"
                              disabled={!contextoValido || !podeEditarAprovacoes}
                              data-permission="Comercial.Pedido.aprovar"
                              data-action="analisar-aprovacao-desconto"
                              data-sensitive="true"
                            >
                              <ShieldCheck className="w-4 h-4 mr-1" />
                              Analisar
                            </Button>

                            {/* V21.6 NOVO: Aprovar + Fechar Automático */}
                            <Button
                              size="sm"
                              onClick={() => {
                                openWindow(
                                  AnalisePedidoAprovacao,
                                  {
                                    pedido,
                                    onAprovar: (dados) => {
                                      aprovarPedidoMutation.mutate({
                                        pedidoId: pedido.id,
                                        dados,
                                        executarFechamento: true
                                      });
                                    },
                                    onNegar: (comentarios) => {
                                      if (!comentarios.trim()) {
                                        toast({ title: "⚠️ Informe o motivo da negação", variant: "destructive" });
                                        return;
                                      }
                                      negarPedidoMutation.mutate({
                                        pedidoId: pedido.id,
                                        comentarios
                                      });
                                    },
                                    windowMode: true
                                  },
                                  {
                                    title: `🔐 Análise: ${pedido.numero_pedido}`,
                                    width: 1400,
                                    height: 800
                                  }
                                );
                              }}
                              className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                              disabled={!contextoValido || !podeEditarAprovacoes}
                              title="Aprovar e Fechar Pedido Automaticamente"
                              data-permission="Comercial.Pedido.aprovar"
                              data-action="aprovar-e-fechar-pedido"
                              data-sensitive="true"
                            >
                              <Zap className="w-4 h-4 mr-1" />
                              Aprovar + Fechar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {pedidosPendentes.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Clock className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Nenhum pedido pendente de aprovação de desconto</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md mt-6">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle>Histórico de Aprovações de Desconto</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Desconto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aprovador</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...pedidosAprovados, ...pedidosNegados].slice(0, 20).map(pedido => (
                    <TableRow key={pedido.id} className="hover:bg-slate-50">
                      <TableCell className="font-semibold">{pedido.numero_pedido}</TableCell>
                      <TableCell>{pedido.cliente_nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {pedido.desconto_aprovado_percentual || pedido.desconto_solicitado_percentual || 0}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {pedido.status_aprovacao === "aprovado" ? (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Aprovado
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700">
                            <XCircle className="w-3 h-3 mr-1" />
                            Negado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {pedido.usuario_aprovador_id || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {pedido.data_aprovacao ? new Date(pedido.data_aprovacao).toLocaleString('pt-BR') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {[...pedidosAprovados, ...pedidosNegados].length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <ShieldCheck className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Nenhuma aprovação registrada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="limite">
          <Card className="border-0 shadow-md mt-4">
            <CardHeader className="bg-purple-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-purple-600" />
                Aprovações de Limite de Crédito
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-slate-600">
              <p>Funcionalidade em desenvolvimento.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="duplicatas">
          <Card className="border-0 shadow-md mt-4">
            <CardHeader className="bg-red-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                Aprovações de Duplicatas Vencidas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-slate-600">
              <p>Funcionalidade em desenvolvimento.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Wrapper>
  );
}

export default CentralAprovacoesManager;