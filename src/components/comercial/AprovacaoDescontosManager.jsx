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
  User,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWindow } from "@/components/lib/useWindow";
import AnalisePedidoAprovacao from "./AnalisePedidoAprovacao";
import { useUser } from "@/components/lib/UserContext";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * 🔐 APROVAÇÃO DE DESCONTOS MANAGER V21.6 - DEPRECATED
 * ⚠️ ESTE COMPONENTE FOI SUBSTITUÍDO POR CentralAprovacoesManager.jsx
 * 
 * NOVO COMPONENTE (V21.6):
 * - CentralAprovacoesManager.jsx - Aprovação unificada + Fechamento automático
 * - AnalisePedidoAprovacao.jsx - Análise detalhada com toggle automação
 * 
 * RAZÃO DA MUDANÇA:
 * - Integração com sistema de fechamento automático
 * - Interface mais completa e moderna
 * - Suporte a fechamento simultâneo
 * - Multi-empresa melhorado
 * - w-full h-full responsivo
 * 
 * REGRA-MÃE: Mantido para compatibilidade, mas uso não recomendado
 */
function AprovacaoDescontosManager({ windowMode = false, empresaId = null }) {
  // V21.6: REDIRECIONAMENTO PARA NOVO COMPONENTE
  console.warn('⚠️ AprovacaoDescontosManager está DEPRECATED. Use CentralAprovacoesManager.jsx');
  const [aprovacaoDialogOpen, setAprovacaoDialogOpen] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [comentariosAprovacao, setComentariosAprovacao] = useState("");
  const [descontoAprovado, setDescontoAprovado] = useState(0);

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

  // V21.6: Multi-empresa
  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-aprovacao-legacy-contexto", empresaContextoId, groupId, contexto],
    queryFn: () => filterInContext("Pedido", empresaContextoId ? { empresa_id: empresaContextoId } : {}, "-created_date", 500),
    enabled: consultaHabilitada,
  });

  // MUTATIONS
  const aprovarPedidoMutation = useMutation({
    mutationFn: async ({ pedidoId, dados }) => {
      if (!contextoValido || !podeEditarAprovacoes) {
        throw new Error("Sem contexto ou permissao para aprovar pedido.");
      }

      // Preparar itens atualizados com descontos
      const itensRevendaAtualizados = [];
      const itensArmadoAtualizados = [];
      const itensCorteAtualizados = [];

      if (dados.itensAtualizados) {
        dados.itensAtualizados.forEach(item => {
          if (item.tipo === "Revenda") {
            itensRevendaAtualizados.push(item);
          } else if (item.tipo === "Armado Padrão") {
            itensArmadoAtualizados.push(item);
          } else if (item.tipo === "Corte e Dobra") {
            itensCorteAtualizados.push(item);
          }
        });
      }

      await updateInContext("Pedido", pedidoId, {
        status_aprovacao: "aprovado",
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-aprovacao-legacy-contexto"] });
      toast({ title: "✅ Desconto aprovado com sucesso!" });
      setAprovacaoDialogOpen(false);
      setPedidoSelecionado(null);
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
      queryClient.invalidateQueries({ queryKey: ["pedidos-aprovacao-legacy-contexto"] });
      toast({ title: "❌ Desconto negado" });
      setAprovacaoDialogOpen(false);
      setPedidoSelecionado(null);
    }
  });

  // FILTROS
  const pedidosPendentes = pedidos.filter(p => p.status_aprovacao === "pendente");
  const pedidosAprovados = pedidos.filter(p => p.status_aprovacao === "aprovado");
  const pedidosNegados = pedidos.filter(p => p.status_aprovacao === "negado");

  const handleAbrirAprovacao = (pedido) => {
    setPedidoSelecionado(pedido);
    setDescontoAprovado(pedido.desconto_solicitado_percentual || 0);
    setComentariosAprovacao("");
    setAprovacaoDialogOpen(true);
  };

  const handleAprovar = () => {
    aprovarPedidoMutation.mutate({
      pedidoId: pedidoSelecionado.id,
      dados: {
        desconto_aprovado_percentual: descontoAprovado,
        comentarios_aprovacao: comentariosAprovacao
      }
    });
  };

  const handleNegar = () => {
    if (!comentariosAprovacao.trim()) {
      toast({ title: "⚠️ Informe o motivo da negação", variant: "destructive" });
      return;
    }
    negarPedidoMutation.mutate({
      pedidoId: pedidoSelecionado.id,
      comentarios: comentariosAprovacao
    });
  };

  // V21.6: w-full h-full responsivo
  const containerClass = windowMode 
    ? 'w-full h-full flex flex-col overflow-hidden' 
    : 'w-full h-full space-y-6';

  const contentClass = windowMode 
    ? 'flex-1 overflow-y-auto p-6 space-y-6' 
    : 'space-y-6';

  const Wrapper = ({ children }) => windowMode ? (
    <div className={containerClass} data-context-required="true" data-permission="Comercial.Pedido.aprovar">
      <div className={contentClass}>{children}</div>
    </div>
  ) : (
    <div className={containerClass} data-context-required="true" data-permission="Comercial.Pedido.aprovar">{children}</div>
  );

  return (
    <Wrapper>
      {/* V21.6: ALERTA DE COMPONENTE DEPRECATED */}
      <Card className="border-2 border-yellow-400 bg-yellow-50 mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600" />
            <div>
              <p className="font-semibold text-yellow-900">
                ⚠️ Componente Deprecated
              </p>
              <p className="text-sm text-yellow-800 mt-1">
                Este componente foi substituído por <strong>CentralAprovacoesManager.jsx</strong> que inclui 
                fechamento automático integrado. Recomendamos usar o novo componente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-orange-600" />
            Aprovação de Descontos (Legacy V21.4)
          </h2>
          <p className="text-slate-600 text-sm">
            Gestão hierárquica de aprovações comerciais • Use CentralAprovacoesManager para recursos V21.6
          </p>
        </div>
      </div>

      {/* CARDS RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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

      {/* TABELA DE PENDENTES */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-orange-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            Pedidos Pendentes de Aprovação
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
                                  dados
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
                        data-action="analisar-aprovacao-desconto-legacy"
                        data-sensitive="true"
                      >
                        <ShieldCheck className="w-4 h-4 mr-1" />
                        Analisar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {pedidosPendentes.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Clock className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhum pedido pendente de aprovação</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* HISTÓRICO DE APROVAÇÕES */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle>Histórico de Aprovações</CardTitle>
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
              <p>Nenhuma aprovação registrada ainda</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOG DE APROVAÇÃO */}
      <Dialog open={aprovacaoDialogOpen} onOpenChange={setAprovacaoDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-orange-600" />
              Analisar Solicitação de Desconto
            </DialogTitle>
          </DialogHeader>

          {pedidoSelecionado && (
            <div className="space-y-4">
              {/* INFORMAÇÕES DO PEDIDO */}
              <Card className="bg-slate-50">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-slate-600">Pedido</Label>
                      <p className="font-semibold text-lg">{pedidoSelecionado.numero_pedido}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Cliente</Label>
                      <p className="font-semibold">{pedidoSelecionado.cliente_nome}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Valor Total</Label>
                      <p className="text-xl font-bold text-green-600">
                        R$ {(pedidoSelecionado.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Vendedor</Label>
                      <p className="font-semibold">{pedidoSelecionado.vendedor || '-'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ANÁLISE DE DESCONTO */}
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs text-orange-700">Margem Mínima</Label>
                      <p className="text-2xl font-bold text-orange-900">
                        {pedidoSelecionado.margem_minima_produto || 0}%
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-orange-700">Desconto Solicitado</Label>
                      <p className="text-2xl font-bold text-orange-600">
                        {pedidoSelecionado.desconto_solicitado_percentual || 0}%
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-orange-700">Margem Após Desconto</Label>
                      <p className={`text-2xl font-bold ${
                        (pedidoSelecionado.margem_aplicada_vendedor || 0) < 5 ? 'text-red-600' :
                        (pedidoSelecionado.margem_aplicada_vendedor || 0) < 10 ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {(pedidoSelecionado.margem_aplicada_vendedor || 0).toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  {(pedidoSelecionado.margem_aplicada_vendedor || 0) < 5 && (
                    <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                      <div className="flex items-center gap-2 text-red-800">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-semibold">Atenção: Margem abaixo de 5% - Risco Alto</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* COMENTÁRIOS */}
              <div>
                <Label>Comentários da Aprovação/Negação</Label>
                <Textarea
                  value={comentariosAprovacao}
                  onChange={(e) => setComentariosAprovacao(e.target.value)}
                  placeholder="Informe o motivo da decisão..."
                  rows={4}
                />
              </div>

              {/* AÇÕES */}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setAprovacaoDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="outline"
                  onClick={handleNegar}
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  disabled={negarPedidoMutation.isPending}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Negar Desconto
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleAprovar}
                  disabled={aprovarPedidoMutation.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Aprovar Desconto
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
}

export default AprovacaoDescontosManager;