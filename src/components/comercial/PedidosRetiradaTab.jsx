import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { isHttpExpedicaoEnabled } from "@/api/runtimeBackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Package,
  CheckCircle2,
  Clock,
  Search,
  Eye,
  User,
  Calendar,
  AlertCircle,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * 📦 PEDIDOS PARA RETIRADA V21.5
 * Gestão de pedidos que o cliente irá retirar
 * - Notificação quando pronto
 * - Confirmação de retirada com assinatura
 * - Baixa automática de estoque na retirada
 */
export default function PedidosRetiradaTab({ windowMode = false }) {
  const modoHttpExpedicao = isHttpExpedicaoEnabled();
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [nomeRecebedor, setNomeRecebedor] = useState("");
  const [docRecebedor, setDocRecebedor] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const queryClient = useQueryClient();

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos'],
    queryFn: () => base44.entities.Pedido.list('-created_date'),
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Filtrar pedidos para retirada (tipo_frete = Retirada, status = Aprovado ou posterior)
  const pedidosParaRetirada = useMemo(() => {
    return pedidos.filter(p => 
      p.tipo_frete === 'Retirada' &&
      ['Aprovado', 'Pronto para Faturar', 'Faturado', 'Pronto para Retirada'].includes(p.status)
    );
  }, [pedidos]);

  // Aplicar filtros
  const pedidosFiltrados = useMemo(() => {
    let resultado = pedidosParaRetirada;
    
    if (busca) {
      resultado = resultado.filter(p =>
        p.numero_pedido?.toLowerCase().includes(busca.toLowerCase()) ||
        p.cliente_nome?.toLowerCase().includes(busca.toLowerCase())
      );
    }
    
    if (statusFiltro !== "todos") {
      resultado = resultado.filter(p => p.status === statusFiltro);
    }
    
    return resultado;
  }, [pedidosParaRetirada, busca, statusFiltro]);

  const prontoParaRetirada = pedidos.filter(p => p.status === 'Pronto para Retirada').length;
  const retirados = pedidos.filter(p => p.status === 'Entregue' && p.tipo_frete === 'Retirada').length;

  const atualizarStatusMutation = useMutation({
    mutationFn: ({ pedidoId, novoStatus }) => 
      base44.entities.Pedido.update(pedidoId, { status: novoStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success("✅ Status atualizado!");
    }
  });

  const confirmarRetiradaMutation = useMutation({
    mutationFn: async ({ pedido }) => {
      if (isHttpExpedicaoEnabled()) {
        throw new Error("Retirada com baixa local indisponível no modo HTTP. Use o fluxo de Expedição.");
      }
      // Baixar estoque automaticamente
      if (pedido.itens_revenda?.length > 0) {
        for (const item of pedido.itens_revenda) {
          if (item.produto_id) {
            const produtos = await base44.entities.Produto.filter({ 
              id: item.produto_id,
              empresa_id: pedido.empresa_id 
            });
            
            const produto = produtos[0];
            if (produto && (produto.estoque_atual || 0) >= (item.quantidade || 0)) {
              const novoEstoque = (produto.estoque_atual || 0) - (item.quantidade || 0);
              
              await base44.entities.MovimentacaoEstoque.create({
                empresa_id: pedido.empresa_id,
                tipo_movimento: "saida",
                origem_movimento: "pedido",
                origem_documento_id: pedido.id,
                produto_id: item.produto_id,
                produto_descricao: item.descricao || item.produto_descricao,
                quantidade: item.quantidade,
                unidade_medida: item.unidade,
                estoque_anterior: produto.estoque_atual || 0,
                estoque_atual: novoEstoque,
                data_movimentacao: new Date().toISOString(),
                documento: pedido.numero_pedido,
                motivo: `Retirada confirmada - ${nomeRecebedor}`,
                responsavel: user?.full_name || "Sistema",
                aprovado: true
              });
              
              await base44.entities.Produto.update(item.produto_id, {
                estoque_atual: novoEstoque
              });
            }
          }
        }
      }

      // Atualizar pedido
      await base44.entities.Pedido.update(pedido.id, {
        status: 'Entregue',
        data_entrega_real: new Date().toISOString()
      });

      // Criar registro de entrega
      await base44.entities.Entrega.create({
        pedido_id: pedido.id,
        numero_pedido: pedido.numero_pedido,
        cliente_id: pedido.cliente_id,
        cliente_nome: pedido.cliente_nome,
        empresa_id: pedido.empresa_id,
        tipo_frete: 'Retirada',
        status: 'Entregue',
        data_entrega: new Date().toISOString(),
        comprovante_entrega: {
          nome_recebedor: nomeRecebedor,
          documento_recebedor: docRecebedor,
          data_hora_recebimento: new Date().toISOString(),
          observacoes_recebimento: observacoes
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['entregas'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
      toast.success("✅ Retirada confirmada e estoque baixado!");
      setDetalhesOpen(false);
      setPedidoSelecionado(null);
      setNomeRecebedor("");
      setDocRecebedor("");
      setObservacoes("");
    }
  });

  const handleConfirmarRetirada = () => {
    if (isHttpExpedicaoEnabled()) {
      toast.error("Use o fluxo de Expedição para confirmar a retirada no modo HTTP.");
      return;
    }
    if (!nomeRecebedor.trim()) {
      toast.error("⚠️ Informe quem retirou o pedido");
      return;
    }
    
    confirmarRetiradaMutation.mutate({ pedido: pedidoSelecionado });
  };

  const containerClass = windowMode ? "w-full h-full overflow-auto p-6" : "space-y-6";

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-7 h-7 text-green-600" />
            Pedidos para Retirada
          </h2>
          <p className="text-slate-600 text-sm">Pedidos que o cliente irá buscar no local</p>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">Total para Retirar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{pedidosParaRetirada.length}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">Prontos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{prontoParaRetirada}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">Já Retirados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-600">{retirados}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por pedido ou cliente..."
                className="pl-10"
              />
            </div>

            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="Aprovado">Aprovado</SelectItem>
                <SelectItem value="Pronto para Faturar">Pronto p/ Faturar</SelectItem>
                <SelectItem value="Faturado">Faturado</SelectItem>
                <SelectItem value="Pronto para Retirada">Pronto p/ Retirada</SelectItem>
                <SelectItem value="Entregue">Retirado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Pedidos */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Data Pedido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidosFiltrados.map(pedido => (
                <TableRow key={pedido.id} className="hover:bg-slate-50">
                  <TableCell className="font-semibold">{pedido.numero_pedido}</TableCell>
                  <TableCell>{pedido.cliente_nome}</TableCell>
                  <TableCell className="font-bold">
                    R$ {(pedido.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(pedido.data_pedido).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      pedido.status === 'Entregue' ? 'bg-green-600' :
                      pedido.status === 'Pronto para Retirada' ? 'bg-blue-600' :
                      'bg-orange-600'
                    }>
                      {pedido.status === 'Entregue' ? '✅ Retirado' : pedido.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {pedido.status !== 'Entregue' && (
                        <>
                          {pedido.status !== 'Pronto para Retirada' && (
                            <Button
                              size="sm"
                              onClick={() => {
                                atualizarStatusMutation.mutate({
                                  pedidoId: pedido.id,
                                  novoStatus: 'Pronto para Retirada'
                                });
                              }}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Bell className="w-4 h-4 mr-1" />
                              Avisar Pronto
                            </Button>
                          )}
                          
                          <Button
                            size="sm"
                            onClick={() => {
                              setPedidoSelecionado(pedido);
                              setDetalhesOpen(true);
                            }}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Confirmar Retirada
                          </Button>
                        </>
                      )}
                      
                      {pedido.status === 'Entregue' && (
                        <Badge className="bg-green-100 text-green-700">
                          ✅ Retirado
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {pedidosFiltrados.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhum pedido para retirada encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Confirmação de Retirada */}
      <Dialog open={detalhesOpen} onOpenChange={setDetalhesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              📦 Confirmar Retirada - {pedidoSelecionado?.numero_pedido}
            </DialogTitle>
          </DialogHeader>
          
          {pedidoSelecionado && (
            <div className="space-y-4">
              <Card className="bg-blue-50">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-600">Cliente</p>
                      <p className="font-semibold">{pedidoSelecionado.cliente_nome}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Valor Total</p>
                      <p className="font-bold text-green-600">
                        R$ {(pedidoSelecionado.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <div>
                  <Label>Nome de Quem Retirou *</Label>
                  <Input
                    value={nomeRecebedor}
                    onChange={(e) => setNomeRecebedor(e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>

                <div>
                  <Label>CPF/RG de Quem Retirou</Label>
                  <Input
                    value={docRecebedor}
                    onChange={(e) => setDocRecebedor(e.target.value)}
                    placeholder="Documento"
                  />
                </div>

                <div>
                  <Label>Observações da Retirada</Label>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Ex: Retirado pessoalmente pelo responsável..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-300 rounded-lg p-3">
                <div className="flex items-start gap-2 text-orange-800 text-sm">
                  <AlertCircle className="w-5 h-5 mt-0.5" />
                  <div>
                    <p className="font-semibold">Atenção:</p>
                    <p>Ao confirmar a retirada, o estoque será baixado automaticamente e não poderá ser desfeito.</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDetalhesOpen(false);
                    setPedidoSelecionado(null);
                    setNomeRecebedor("");
                    setDocRecebedor("");
                    setObservacoes("");
                  }}
                >
                  Cancelar
                </Button>
                {modoHttpExpedicao ? (
                  <p role="alert" className="text-sm text-amber-900">
                    A baixa local de estoque está indisponível no modo HTTP. Confirme pelo fluxo de Expedição.
                  </p>
                ) : (
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleConfirmarRetirada}
                  disabled={confirmarRetiradaMutation.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {confirmarRetiradaMutation.isPending ? 'Confirmando...' : 'Confirmar Retirada'}
                </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
