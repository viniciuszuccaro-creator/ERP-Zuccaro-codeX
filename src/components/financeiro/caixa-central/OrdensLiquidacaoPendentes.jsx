import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import useContextoVisual from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { useToast } from '@/components/ui/use-toast';
import { useUser } from '@/components/lib/UserContext';
import { Clock, TrendingUp, TrendingDown, CheckCircle2, XCircle, Wallet } from 'lucide-react';

export default function OrdensLiquidacaoPendentes() {
  const { filterInContext, empresaAtual, grupoAtual, updateInContext } = useContextoVisual();
  const { canEdit, hasPermission } = usePermissions();
  const { toast } = useToast();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [liquidacaoDialogOpen, setLiquidacaoDialogOpen] = useState(false);
  const [ordemSelecionada, setOrdemSelecionada] = useState(null);
  const [formaPagamentoLiquidacao, setFormaPagamentoLiquidacao] = useState("");
  const [observacoesLiquidacao, setObservacoesLiquidacao] = useState("");
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaAtual?.id || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const podeLiquidar = canEdit('Financeiro', 'Caixa') || canEdit('Financeiro', 'Caixa Central') || hasPermission('Financeiro', null, 'baixar');

  const auditarOrdem = async ({ acao, ordem, descricao, dadosAnteriores, dadosNovos, sucesso = true }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: 'Financeiro',
        entidade: 'CaixaOrdemLiquidacao',
        registro_id: ordem?.id || null,
        descricao,
        usuario_id: user?.id || null,
        usuario: user?.full_name || user?.email || 'Usuario local',
        empresa_id: ordem?.empresa_id || empresaId,
        group_id: ordem?.group_id || groupId,
        grupo_id: ordem?.grupo_id || ordem?.group_id || groupId,
        tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        sucesso,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao auditar ordem de liquidacao:', error);
    }
  };

  const { data: ordensLiquidacao = [], isLoading } = useQuery({
    queryKey: ['caixa-ordens-liquidacao', contextKey],
    queryFn: () => filterInContext('CaixaOrdemLiquidacao', {}, '-created_date'),
    enabled: contextoValido
  });

  const liquidarOrdemMutation = useMutation({
    mutationFn: async ({ ordemId, dados }) => {
      const ordem = ordensLiquidacao.find(o => o.id === ordemId);
      if (!contextoValido || !podeLiquidar) throw new Error("Sem contexto ou permissÃ£o para liquidar.");
      
      if (ordem.titulos_vinculados && ordem.titulos_vinculados.length > 0) {
        for (const titulo of ordem.titulos_vinculados) {
          if (ordem.tipo_operacao === 'Recebimento') {
            await updateInContext('ContaReceber', titulo.titulo_id, {
              group_id: ordem.group_id || groupId,
              grupo_id: ordem.grupo_id || ordem.group_id || groupId,
              empresa_id: ordem.empresa_id || empresaId,
              status: 'Recebido',
              data_recebimento: new Date().toISOString(),
              valor_recebido: titulo.valor_titulo,
              forma_recebimento: dados.forma_pagamento
            });
          } else if (ordem.tipo_operacao === 'Pagamento') {
            await updateInContext('ContaPagar', titulo.titulo_id, {
              group_id: ordem.group_id || groupId,
              grupo_id: ordem.grupo_id || ordem.group_id || groupId,
              empresa_id: ordem.empresa_id || empresaId,
              status: 'Pago',
              data_pagamento: new Date().toISOString(),
              valor_pago: titulo.valor_titulo,
              forma_pagamento: dados.forma_pagamento
            });
          }
        }
      }

      await updateInContext('CaixaOrdemLiquidacao', ordemId, {
        group_id: ordem.group_id || groupId,
        grupo_id: ordem.grupo_id || ordem.group_id || groupId,
        empresa_id: ordem.empresa_id || empresaId,
        status: "Liquidado",
        data_processamento: new Date().toISOString(),
        usuario_processou_id: dados.usuario_id,
        detalhes_processamento: {
          forma_pagamento: dados.forma_pagamento,
          observacoes: dados.observacoes,
          usuario: user?.full_name || user?.email
        }
      });
      return ordem;
    },
    onSuccess: async (ordem) => {
      await auditarOrdem({
        acao: 'Liquidacao',
        ordem,
        descricao: 'Ordem de liquidacao processada com baixa dos titulos vinculados.',
        dadosAnteriores: ordem,
        dadosNovos: { status: 'Liquidado', forma_pagamento: formaPagamentoLiquidacao, observacoes: observacoesLiquidacao }
      });
      queryClient.invalidateQueries({ queryKey: ['caixa-ordens-liquidacao'] });
      queryClient.invalidateQueries({ queryKey: ['liquidacao'] });
      queryClient.invalidateQueries({ queryKey: ['contasReceber'] });
      queryClient.invalidateQueries({ queryKey: ['contasPagar'] });
      toast({ title: "✅ Liquidação realizada com sucesso!" });
      setLiquidacaoDialogOpen(false);
      setOrdemSelecionada(null);
      setFormaPagamentoLiquidacao("");
      setObservacoesLiquidacao("");
    }
  });

  const cancelarOrdemMutation = useMutation({
    mutationFn: async (ordemId) => {
      if (!contextoValido || !podeLiquidar) throw new Error("Sem contexto ou permissÃ£o para cancelar.");
      const ordem = ordensLiquidacao.find(o => o.id === ordemId);
      await updateInContext('CaixaOrdemLiquidacao', ordemId, {
        group_id: ordem?.group_id || groupId,
        grupo_id: ordem?.grupo_id || ordem?.group_id || groupId,
        empresa_id: ordem?.empresa_id || empresaId,
        status: "Cancelado",
        data_cancelamento: new Date().toISOString(),
        usuario_cancelou_id: user?.id || null,
        usuario_cancelou: user?.full_name || user?.email
      });
      return ordem;
    },
    onSuccess: async (ordem) => {
      await auditarOrdem({
        acao: 'Cancelamento',
        ordem,
        descricao: 'Ordem de liquidacao cancelada pelo usuario.',
        dadosAnteriores: ordem,
        dadosNovos: { status: 'Cancelado' }
      });
      queryClient.invalidateQueries({ queryKey: ['caixa-ordens-liquidacao'] });
      toast({ title: "✅ Ordem cancelada" });
    }
  });

  const ordensPendentes = ordensLiquidacao.filter(o => o.status === "Pendente");

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-slate-500">
          Carregando ordens...
        </CardContent>
      </Card>
    );
  }

  const handleLiquidar = (ordem) => {
    setOrdemSelecionada(ordem);
    setFormaPagamentoLiquidacao(ordem.forma_pagamento_pretendida || "");
    setLiquidacaoDialogOpen(true);
  };

  const confirmarLiquidacao = async () => {
    if (!formaPagamentoLiquidacao) {
      toast({ title: "⚠️ Selecione a forma de pagamento", variant: "destructive" });
      return;
    }

    if (!window.confirm('Confirmar liquidacao desta ordem e baixa dos titulos vinculados?')) {
      await auditarOrdem({
        acao: 'Cancelamento',
        ordem: ordemSelecionada,
        descricao: 'Usuario cancelou a confirmacao de liquidacao da ordem.',
        dadosNovos: { forma_pagamento: formaPagamentoLiquidacao, observacoes: observacoesLiquidacao },
        sucesso: false
      });
      return;
    }

    liquidarOrdemMutation.mutate({
      ordemId: ordemSelecionada.id,
      dados: {
        forma_pagamento: formaPagamentoLiquidacao,
        observacoes: observacoesLiquidacao,
        usuario_id: user?.id
      }
    });
  };

  return (
    <>
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-orange-50 border-b">
          <CardTitle className="text-orange-900 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Ordens Pendentes de Liquidação ({ordensPendentes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Títulos Vinculados</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordensPendentes.map(ordem => (
                  <TableRow key={ordem.id} className="hover:bg-slate-50">
                    <TableCell className="text-sm">{new Date(ordem.created_date).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      <Badge className={ordem.tipo_operacao === "Recebimento" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                        {ordem.tipo_operacao === "Recebimento" ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                        {ordem.tipo_operacao}
                      </Badge>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{ordem.origem}</Badge></TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {ordem.titulos_vinculados?.map((titulo, idx) => (
                          <div key={idx} className="text-xs">
                            <span className="font-semibold">{titulo.numero_titulo}</span>
                            <span className="text-slate-500"> • {titulo.cliente_fornecedor_nome}</span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-base">R$ {(ordem.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell><Badge className="bg-blue-100 text-blue-700">{ordem.forma_pagamento_pretendida}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" disabled={!contextoValido || !podeLiquidar || liquidarOrdemMutation.isPending} onClick={() => handleLiquidar(ordem)} className="bg-emerald-600 hover:bg-emerald-700" data-action="OrdensLiquidacao.liquidar" data-permission="Financeiro.Caixa.baixar" data-context-required="true" data-sensitive>
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Liquidar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {
                            if (!window.confirm('Cancelar esta ordem de liquidacao?')) {
                              auditarOrdem({ acao: 'Cancelamento', ordem, descricao: 'Usuario cancelou a confirmacao de cancelamento da ordem.', sucesso: false });
                              return;
                            }
                            cancelarOrdemMutation.mutate(ordem.id);
                          }}
                          className="border-red-300 text-red-600"
                          disabled={!contextoValido || !podeLiquidar || cancelarOrdemMutation.isPending}
                          data-action="OrdensLiquidacao.cancelar"
                          data-permission="Financeiro.Caixa.cancelar"
                          data-context-required="true"
                          data-sensitive
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {ordensPendentes.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Clock className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhuma ordem pendente de liquidação</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Liquidação */}
      <Dialog open={liquidacaoDialogOpen} onOpenChange={setLiquidacaoDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-600" />
              Confirmar Liquidação
            </DialogTitle>
          </DialogHeader>

          {ordemSelecionada && (
            <div className="space-y-4">
              <Card className="bg-slate-50">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-slate-600">Tipo</Label>
                      <p className="font-semibold">{ordemSelecionada.tipo_operacao}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Origem</Label>
                      <p className="font-semibold">{ordemSelecionada.origem}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Valor Total</Label>
                      <p className="text-xl font-bold text-emerald-600">
                        R$ {(ordemSelecionada.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Títulos Vinculados</Label>
                      <p className="font-semibold">{ordemSelecionada.titulos_vinculados?.length || 0}</p>
                    </div>
                  </div>

                  {ordemSelecionada.titulos_vinculados?.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <Label className="text-xs text-slate-600 mb-2 block">Títulos:</Label>
                      <div className="space-y-1">
                        {ordemSelecionada.titulos_vinculados.map((titulo, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{titulo.numero_titulo} - {titulo.cliente_fornecedor_nome}</span>
                            <span className="font-semibold">R$ {(titulo.valor_titulo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <div>
                  <Label>Forma de Pagamento *</Label>
                  <Select value={formaPagamentoLiquidacao} onValueChange={setFormaPagamentoLiquidacao} disabled={!contextoValido || !podeLiquidar || liquidarOrdemMutation.isPending}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dinheiro">💵 Dinheiro</SelectItem>
                      <SelectItem value="Cartão Crédito">💳 Cartão Crédito</SelectItem>
                      <SelectItem value="Cartão Débito">💳 Cartão Débito</SelectItem>
                      <SelectItem value="PIX">⚡ PIX</SelectItem>
                      <SelectItem value="Boleto">📄 Boleto</SelectItem>
                      <SelectItem value="Transferência">🏦 Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={observacoesLiquidacao}
                    onChange={(e) => setObservacoesLiquidacao(e.target.value)}
                    placeholder="Observações sobre a liquidação..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setLiquidacaoDialogOpen(false)} data-action="OrdensLiquidacao.dialog_cancelar">Cancelar</Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={confirmarLiquidacao}
                  disabled={!contextoValido || !podeLiquidar || liquidarOrdemMutation.isPending}
                  data-action="OrdensLiquidacao.confirmar_liquidacao"
                  data-permission="Financeiro.Caixa.baixar"
                  data-context-required="true"
                  data-sensitive
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {liquidarOrdemMutation.isPending ? "Liquidando..." : "Confirmar Liquidação"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
