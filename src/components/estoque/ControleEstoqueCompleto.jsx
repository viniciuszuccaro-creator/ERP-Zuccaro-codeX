import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  Package,
  AlertTriangle,
  TrendingUp,
  Lock,
  Unlock,
  Calendar,
  BarChart3,
  FileText,
  CheckCircle,
  XCircle
} from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";

/**
 * Componente completo de controle de estoque com:
 * - Reserva automática
 * - Lote e validade
 * - Inventário rotativo
 * - Curva ABC
 * - Bloqueio de vencidos
 */
export default function ControleEstoqueCompleto({ empresaId }) {
  const [activeTab, setActiveTab] = useState("reservas");
  const [inventarioOpen, setInventarioOpen] = useState(false);
  const [produtoInventario, setProdutoInventario] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { canCreate, canEdit } = usePermissions();
  const empresaOperacionalId = empresaId || empresaAtual?.id || null;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextoValido = Boolean(empresaOperacionalId || groupId);
  const canAjustarInventario = canCreate('Estoque', 'Inventario') || canCreate('Estoque', 'InventÃ¡rio') || canEdit('Estoque', 'Inventario') || canEdit('Estoque', 'InventÃ¡rio');
  const canBloquearLote = canEdit('Estoque', 'Lotes') || canEdit('Estoque', 'Lotes e Validade');

  const auditEstoqueControle = async (acao, detalhes = {}, sucesso = true) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Usuario local',
        usuario_id: user?.id || null,
        acao,
        modulo: 'Estoque',
        tipo_auditoria: sucesso ? 'sensivel' : 'seguranca',
        entidade: 'ControleEstoque',
        descricao: `Controle de estoque: ${acao}`,
        detalhes,
        empresa_id: empresaOperacionalId,
        group_id: groupId,
        grupo_id: groupId,
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (_) {}
  };

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-controle', empresaOperacionalId, groupId],
    queryFn: async () => {
      return await filterInContext('Produto', {}, '-updated_date', 9999);
    },
    enabled: contextoValido,
  });

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['movimentacoes-controle', empresaOperacionalId, groupId],
    queryFn: async () => {
      return await filterInContext('MovimentacaoEstoque', {}, '-created_date', 200);
    },
    enabled: contextoValido,
  });

  // Reservas ativas
  const reservas = movimentacoes.filter(m => 
    m.tipo_movimento === "reserva" && 
    m.origem_movimento === "pedido"
  );

  // Produtos com lote
  const produtosComLote = produtos.filter(p => p.controla_lote && p.lotes?.length > 0);

  // Produtos vencidos ou próximos do vencimento
  const hoje = new Date();
  const em30Dias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);

  const produtosVencidos = [];
  const produtosVencendo = [];

  produtosComLote.forEach(produto => {
    (produto.lotes || []).forEach(lote => {
      if (!lote.data_validade) return;
      
      const dataVal = new Date(lote.data_validade);
      
      if (dataVal < hoje) {
        produtosVencidos.push({ ...produto, lote });
      } else if (dataVal < em30Dias) {
        produtosVencendo.push({ ...produto, lote });
      }
    });
  });

  // Produtos abaixo do mínimo
  const produtosBaixoEstoque = produtos.filter(p => 
    (p.estoque_atual || 0) <= (p.estoque_minimo || 0) && 
    p.status === "Ativo"
  );

  // Fazer inventário
  const fazerInventarioMutation = useMutation({
    mutationFn: async ({ produtoId, quantidadeContada, lote, observacao }) => {
      if (!contextoValido) throw new Error("Selecione grupo ou empresa antes de fazer inventario.");
      if (!canAjustarInventario) throw new Error("Sem permissao para ajustar inventario.");
      if (!Number.isFinite(quantidadeContada) || quantidadeContada < 0) throw new Error("Quantidade contada invalida.");
      const produto = produtos.find(p => p.id === produtoId);
      if (!produto) throw new Error("Produto não encontrado");

      const diferenca = quantidadeContada - (produto.estoque_atual || 0);

      // Criar movimentação de ajuste
      await createInContext('MovimentacaoEstoque', {
        empresa_id: empresaOperacionalId,
        tipo_movimento: "ajuste",
        origem_movimento: "inventario",
        produto_id: produtoId,
        produto_descricao: produto.descricao,
        codigo_produto: produto.codigo,
        quantidade: Math.abs(diferenca),
        unidade_medida: produto.unidade_medida,
        estoque_anterior: produto.estoque_atual || 0,
        estoque_atual: quantidadeContada,
        lote: lote,
        data_movimentacao: new Date().toISOString(),
        documento: `INV-${Date.now()}`,
        motivo: `Inventário rotativo - ${observacao || 'Contagem física'}`,
        responsavel: "Sistema",
        observacoes: `Diferença: ${diferenca > 0 ? '+' : ''}${diferenca}`
      });

      // Atualizar produto
      await updateInContext('Produto', produtoId, {
        estoque_atual: quantidadeContada
      });

      return { produto, diferenca };
    },
    onSuccess: ({ produto, diferenca }) => {
      queryClient.invalidateQueries({ queryKey: ['produtos-controle'] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoes-controle'] });
      
      toast({
        title: "✅ Inventário realizado",
        description: `${produto.descricao}: ${diferenca > 0 ? '+' : ''}${diferenca} un`
      });
      
      setInventarioOpen(false);
      setProdutoInventario(null);
      auditEstoqueControle('inventario_ajustado', {
        produto_id: produto.id,
        produto_descricao: produto.descricao,
        diferenca,
      });
    },
    onError: (error) => {
      auditEstoqueControle('inventario_bloqueado', { erro: error?.message }, false);
      toast({
        title: "Erro no inventario",
        description: error?.message || "Nao foi possivel ajustar o inventario",
        variant: "destructive",
      });
    },
  });

  // Bloquear lote vencido
  const bloquearLoteVencidoMutation = useMutation({
    mutationFn: async ({ produtoId, numeroLote }) => {
      if (!contextoValido) throw new Error("Selecione grupo ou empresa antes de bloquear lote.");
      if (!canBloquearLote) throw new Error("Sem permissao para bloquear lote.");
      const produto = produtos.find(p => p.id === produtoId);
      if (!produto) throw new Error("Produto não encontrado");

      const lotesAtualizados = (produto.lotes || []).map(l => {
        if (l.numero_lote === numeroLote) {
          return {
            ...l,
            bloqueado: true,
            quantidade_disponivel: 0,
            observacoes: (l.observacoes || '') + ' [BLOQUEADO POR VENCIMENTO]'
          };
        }
        return l;
      });

      await updateInContext('Produto', produtoId, {
        lotes: lotesAtualizados
      });

      return { produto, numeroLote };
    },
    onSuccess: ({ produto, numeroLote }) => {
      queryClient.invalidateQueries({ queryKey: ['produtos-controle'] });
      auditEstoqueControle('lote_bloqueado', {
        produto_id: produto.id,
        produto_descricao: produto.descricao,
        numero_lote: numeroLote,
      });
      toast({
        title: "🔒 Lote bloqueado",
        description: "Lote vencido bloqueado para uso"
      });
    },
  });

  return (
    <div
      className="space-y-6 w-full h-full"
      data-permission="Estoque.Controle.visualizar"
      data-context-required="group-or-company"
    >
      {/* Alertas Críticos */}
      {(produtosVencidos.length > 0 || produtosBaixoEstoque.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {produtosVencidos.length > 0 && (
            <Card className="border-red-300 bg-red-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-red-900">
                  <XCircle className="w-5 h-5" />
                  {produtosVencidos.length} Lote(s) Vencido(s)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {produtosVencidos.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{item.descricao} - Lote {item.lote.numero_lote}</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!contextoValido || !canBloquearLote}
                      data-permission="Estoque.Lotes.editar"
                      data-action="Estoque.Lotes.bloquearVencido"
                      data-context-required="group-or-company"
                      data-sensitive="true"
                      onClick={() => bloquearLoteVencidoMutation.mutate({
                        produtoId: item.id,
                        numeroLote: item.lote.numero_lote
                      })}
                    >
                      <Lock className="w-3 h-3 mr-1" />
                      Bloquear
                    </Button>
                  </div>
                ))}
                {produtosVencidos.length > 3 && (
                  <p className="text-xs text-red-700">+{produtosVencidos.length - 3} lotes vencidos</p>
                )}
              </CardContent>
            </Card>
          )}

          {produtosBaixoEstoque.length > 0 && (
            <Card className="border-orange-300 bg-orange-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-orange-900">
                  <AlertTriangle className="w-5 h-5" />
                  {produtosBaixoEstoque.length} Produto(s) Abaixo do Mínimo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {produtosBaixoEstoque.slice(0, 3).map((prod, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{prod.descricao}</span>
                    <Badge variant="destructive">
                      {prod.estoque_atual} / {prod.estoque_minimo}
                    </Badge>
                  </div>
                ))}
                {produtosBaixoEstoque.length > 3 && (
                  <p className="text-xs text-orange-700">+{produtosBaixoEstoque.length - 3} produtos</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full" data-permission="Estoque.Controle.visualizar" data-context-required="group-or-company">
        <TabsList className="bg-white border">
          <TabsTrigger value="reservas" data-action="Estoque.Controle.tab.reservas" data-permission="Estoque.Reservas.visualizar" data-context-required="group-or-company">
            <Lock className="w-4 h-4 mr-2" />
            Reservas ({reservas.length})
          </TabsTrigger>
          <TabsTrigger value="lotes" data-action="Estoque.Controle.tab.lotes" data-permission="Estoque.Lotes.visualizar" data-context-required="group-or-company">
            <Package className="w-4 h-4 mr-2" />
            Lotes/Validade
          </TabsTrigger>
          <TabsTrigger value="inventario" data-action="Estoque.Controle.tab.inventario" data-permission="Estoque.Inventario.visualizar" data-context-required="group-or-company">
            <FileText className="w-4 h-4 mr-2" />
            Inventário
          </TabsTrigger>
          <TabsTrigger value="abc" data-action="Estoque.Controle.tab.abc" data-permission="Estoque.Relatorios.visualizar" data-context-required="group-or-company">
            <BarChart3 className="w-4 h-4 mr-2" />
            Curva ABC
          </TabsTrigger>
        </TabsList>

        {/* ABA: Reservas */}
        <TabsContent value="reservas">
          <Card>
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle>Estoque Reservado</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Produto</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead className="text-right">Qtd Reservada</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservas.map(res => (
                    <TableRow key={res.id}>
                      <TableCell className="font-medium">{res.produto_descricao}</TableCell>
                      <TableCell>{res.documento}</TableCell>
                      <TableCell className="text-right">{res.quantidade} {res.unidade_medida}</TableCell>
                      <TableCell>{new Date(res.data_movimentacao).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>
                        <Badge className="bg-blue-100 text-blue-700">Reservado</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {reservas.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Lock className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Nenhuma reserva ativa</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: Lotes e Validade */}
        <TabsContent value="lotes">
          <div className="space-y-4">
            {produtosVencendo.length > 0 && (
              <Card className="border-yellow-300 bg-yellow-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-yellow-900">
                    ⚠️ Lotes Vencendo em 30 Dias ({produtosVencendo.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-yellow-100">
                        <TableHead>Produto</TableHead>
                        <TableHead>Lote</TableHead>
                        <TableHead>Validade</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead>Dias Restantes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {produtosVencendo.map((item, idx) => {
                        const diasRestantes = Math.floor((new Date(item.lote.data_validade) - hoje) / (1000 * 60 * 60 * 24));
                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.descricao}</TableCell>
                            <TableCell>{item.lote.numero_lote}</TableCell>
                            <TableCell>{new Date(item.lote.data_validade).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell className="text-right">{item.lote.quantidade} {item.unidade_medida}</TableCell>
                            <TableCell>
                              <Badge className={diasRestantes <= 7 ? "bg-red-600" : "bg-yellow-600"}>
                                {diasRestantes} dias
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle>Todos os Lotes Ativos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Produto</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Fabricação</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead className="text-right">Qtd Total</TableHead>
                      <TableHead className="text-right">Disponível</TableHead>
                      <TableHead className="text-right">Reservado</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtosComLote.flatMap(produto => 
                      (produto.lotes || []).map((lote, idx) => (
                        <TableRow key={`${produto.id}-${idx}`}>
                          <TableCell className="font-medium">{produto.descricao}</TableCell>
                          <TableCell>{lote.numero_lote}</TableCell>
                          <TableCell>
                            {lote.data_fabricacao ? new Date(lote.data_fabricacao).toLocaleDateString('pt-BR') : '-'}
                          </TableCell>
                          <TableCell>
                            {lote.data_validade ? new Date(lote.data_validade).toLocaleDateString('pt-BR') : '-'}
                          </TableCell>
                          <TableCell className="text-right">{lote.quantidade}</TableCell>
                          <TableCell className="text-right font-semibold">{lote.quantidade_disponivel || 0}</TableCell>
                          <TableCell className="text-right text-blue-600">{lote.quantidade_reservada || 0}</TableCell>
                          <TableCell>
                            {lote.bloqueado ? (
                              <Badge className="bg-red-600"><Lock className="w-3 h-3 mr-1" />Bloqueado</Badge>
                            ) : (
                              <Badge className="bg-green-600"><Unlock className="w-3 h-3 mr-1" />Disponível</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {produtosComLote.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>Nenhum produto com controle de lote</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ABA: Inventário Rotativo */}
        <TabsContent value="inventario">
          <Card>
            <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between">
              <CardTitle>Inventário Rotativo</CardTitle>
              <Dialog open={inventarioOpen} onOpenChange={setInventarioOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="bg-blue-600"
                    disabled={!contextoValido || !canAjustarInventario}
                    data-action="Estoque.Inventario.abrirContagemRotativa"
                    data-permission="Estoque.Inventario.criar"
                    data-context-required="group-or-company"
                    data-sensitive="true"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Fazer Contagem
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Contagem de Inventário</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    fazerInventarioMutation.mutate({
                      produtoId: formData.get('produto'),
                      quantidadeContada: parseFloat(formData.get('quantidade')),
                      lote: formData.get('lote'),
                      observacao: formData.get('observacao')
                    });
                  }} className="space-y-4">
                    <div>
                      <Label>Produto *</Label>
                      <Select name="produto" required>
                        <SelectTrigger
                          className="mt-2"
                          data-action="Estoque.Inventario.contagemRotativa.produto"
                          data-permission="Estoque.Inventario.criar"
                          data-context-required="group-or-company"
                        >
                          <SelectValue placeholder="Selecione o produto" />
                        </SelectTrigger>
                        <SelectContent>
                          {produtos.filter(p => p.status === 'Ativo').map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.codigo && `${p.codigo} - `}{p.descricao}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Quantidade Contada *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          name="quantidade"
                          required
                          className="mt-2"
                          data-action="Estoque.Inventario.contagemRotativa.quantidade"
                          data-permission="Estoque.Inventario.criar"
                          data-context-required="group-or-company"
                        />
                      </div>
                      <div>
                        <Label>Lote (se aplicável)</Label>
                        <Input
                          type="text"
                          name="lote"
                          className="mt-2"
                          data-action="Estoque.Inventario.contagemRotativa.lote"
                          data-permission="Estoque.Inventario.criar"
                          data-context-required="group-or-company"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Observação</Label>
                      <Input
                        type="text"
                        name="observacao"
                        placeholder="Ex: Contagem física mensal"
                        className="mt-2"
                        data-action="Estoque.Inventario.contagemRotativa.observacao"
                        data-permission="Estoque.Inventario.criar"
                        data-context-required="group-or-company"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setInventarioOpen(false)}
                        data-action="Estoque.Inventario.contagemRotativa.cancelar"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={fazerInventarioMutation.isPending || !contextoValido || !canAjustarInventario}
                        data-permission="Estoque.Inventario.criar"
                        data-action="Estoque.Inventario.contagemRotativa.confirmar"
                        data-context-required="group-or-company"
                        data-sensitive="true"
                      >
                        Confirmar Contagem
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-slate-600 mb-4">
                O inventário rotativo permite contar produtos de forma parcial e corrigir divergências.
              </p>

              <div className="grid md:grid-cols-3 gap-4">
                <Card className="bg-blue-50">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-blue-700">Produtos Ativos</p>
                    <p className="text-3xl font-bold text-blue-900">{produtos.filter(p => p.status === 'Ativo').length}</p>
                  </CardContent>
                </Card>

                <Card className="bg-green-50">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-green-700">Com Controle de Lote</p>
                    <p className="text-3xl font-bold text-green-900">{produtos.filter(p => p.controla_lote).length}</p>
                  </CardContent>
                </Card>

                <Card className="bg-purple-50">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-purple-700">Ajustes (30 dias)</p>
                    <p className="text-3xl font-bold text-purple-900">
                      {movimentacoes.filter(m => m.tipo_movimento === 'ajuste').length}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: Curva ABC */}
        <TabsContent value="abc">
          <Card>
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle>Classificação ABC por Valor</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Classe</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead className="text-right">Custo Unit.</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Giro (30d)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtos
                    .filter(p => p.status === 'Ativo')
                    .map(p => ({
                      ...p,
                      valor_total: (p.estoque_atual || 0) * (p.custo_aquisicao || 0)
                    }))
                    .sort((a, b) => b.valor_total - a.valor_total)
                    .slice(0, 30)
                    .map((prod, idx) => {
                      let classe = 'C';
                      if (idx < produtos.length * 0.2) classe = 'A';
                      else if (idx < produtos.length * 0.5) classe = 'B';

                      return (
                        <TableRow key={prod.id}>
                          <TableCell>
                            <Badge className={
                              classe === 'A' ? 'bg-blue-600' :
                              classe === 'B' ? 'bg-green-600' :
                              'bg-orange-600'
                            }>
                              {classe}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{prod.descricao}</TableCell>
                          <TableCell className="text-right">{prod.estoque_atual}</TableCell>
                          <TableCell className="text-right">
                            R$ {(prod.custo_aquisicao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            R$ {prod.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            {prod.quantidade_vendida_30dias || 0}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
