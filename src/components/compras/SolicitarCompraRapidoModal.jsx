import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShoppingCart, Package, TrendingUp, Calendar } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function SolicitarCompraRapidoModal({ produto, isOpen, onClose, windowMode = false }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const { canCreate, hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = !!(empresaAtual?.id || groupId);
  const podeCriarSolicitacao = canCreate('Compras', 'SolicitacaoCompra') ||
    canCreate('Compras', 'Solicitação Compra') ||
    hasPermission('Compras', 'Solicitações de Compra', 'criar');
  const controlesBloqueados = !contextoValido || !podeCriarSolicitacao;

  const auditSolicitacaoRapida = async ({ acao, sucesso = true, motivo = null, dados = {} }) => {
    try {
      await createInContext('AuditLog', {
        acao,
        modulo: 'Compras',
        entidade: 'SolicitacaoCompra',
        tipo_auditoria: sucesso ? 'entidade' : 'seguranca',
        descricao: motivo || 'Auditoria de solicitacao rapida por estoque baixo.',
        dados_novos: dados,
        group_id: groupId,
        grupo_id: groupId,
        empresa_id: empresaId,
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Falha ao auditar solicitacao rapida de compra:', error);
    }
  };

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  // Calcular quantidade sugerida
  const faltando = (produto.estoque_minimo || 0) - (produto.estoque_disponivel || produto.estoque_atual || 0);
  const sugestaoQuantidade = Math.max(faltando, produto.estoque_maximo || produto.estoque_minimo || 10);

  const [formData, setFormData] = useState({
    numero_solicitacao: `SC-${Date.now()}`,
    data_solicitacao: new Date().toISOString().split('T')[0],
    produto_id: produto.id,
    produto_descricao: produto.descricao,
    quantidade_solicitada: sugestaoQuantidade,
    unidade_medida: produto.unidade_medida,
    justificativa: `Estoque baixo: ${produto.estoque_disponivel || produto.estoque_atual || 0} ${produto.unidade_medida} (mínimo: ${produto.estoque_minimo})`,
    prioridade: faltando > (produto.estoque_minimo || 0) * 0.5 ? 'Alta' : 'Média',
    data_necessidade: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +7 dias
    status: "Pendente"
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const criada = await createInContext('SolicitacaoCompra', {
        ...data,
        ...(empresaId ? { empresa_id: empresaId } : {}),
        ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
        solicitante: user?.full_name,
        solicitante_id: user?.id,
        setor: "Estoque"
      });
      await auditSolicitacaoRapida({
        acao: 'SolicitacaoCompraRapida.criada',
        dados: {
          solicitacao_id: criada?.id,
          produto_id: data.produto_id,
          quantidade_solicitada: data.quantidade_solicitada,
          prioridade: data.prioridade
        }
      });
      return criada;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-compra'] });
      toast({ title: "✅ Solicitação de compra criada!" });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Solicitacao nao criada",
        description: error?.message || "Erro ao criar solicitacao de compra.",
        variant: "destructive"
      });
    },
  });
  const controlesDesabilitados = controlesBloqueados || createMutation.isPending;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contextoValido || !podeCriarSolicitacao) {
      await auditSolicitacaoRapida({
        acao: 'SolicitacaoCompraRapida.criar_bloqueada',
        sucesso: false,
        motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada',
        dados: {
          produto_id: produto.id,
          quantidade_solicitada: formData.quantidade_solicitada
        }
      });
      toast({
        title: "Ação bloqueada",
        description: "Selecione um grupo/empresa e confirme sua permissão para criar solicitações.",
        variant: "destructive"
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const content = (
    <form
      onSubmit={handleSubmit}
      className={`space-y-6 ${windowMode ? 'p-6 h-full overflow-auto' : ''}`}
      data-permission="Compras.SolicitacaoCompra.criar"
      data-action="Compras.SolicitacaoCompraRapida.formulario"
      data-context-required="group-or-company"
      data-context-mode={empresaId ? 'empresa' : 'grupo'}
    >
      {!windowMode && (
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart className="w-5 h-5 text-orange-600" />
          <h2 className="text-xl font-bold">Solicitar Compra - Estoque Baixo</h2>
        </div>
      )}
          {/* ALERTA DE ESTOQUE */}
          <Card className="border-red-300 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-900">Estoque Crítico!</p>
                  <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                    <div>
                      <p className="text-red-700">Atual:</p>
                      <p className="font-bold text-red-900">
                        {produto.estoque_disponivel || produto.estoque_atual || 0} {produto.unidade_medida}
                      </p>
                    </div>
                    <div>
                      <p className="text-red-700">Mínimo:</p>
                      <p className="font-bold text-red-900">
                        {produto.estoque_minimo || 0} {produto.unidade_medida}
                      </p>
                    </div>
                    <div>
                      <p className="text-red-700">Faltando:</p>
                      <p className="font-bold text-red-900">
                        {faltando} {produto.unidade_medida}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PRODUTO */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-blue-600" />
                <div className="flex-1">
                  <p className="font-semibold text-blue-900">{produto.descricao}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <Badge variant="outline" className="text-xs">{produto.codigo}</Badge>
                    <span className="text-xs text-blue-700">Unidade: {produto.unidade_medida}</span>
                    {produto.fornecedor_principal && (
                      <span className="text-xs text-blue-700">
                        Fornecedor: {produto.fornecedor_principal}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QUANTIDADE SUGERIDA */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Quantidade Sugerida *</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.quantidade_solicitada}
                  onChange={(e) => setFormData({ ...formData, quantidade_solicitada: parseFloat(e.target.value) || 0 })}
                  disabled={controlesDesabilitados}
                  required
                  className="pr-16"
                  data-permission="Compras.SolicitacaoCompra.criar"
                  data-action="Compras.SolicitacaoCompraRapida.quantidade"
                  data-context-required="group-or-company"
                  data-sensitive="true"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                  {formData.unidade_medida}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                💡 Sugestão: {sugestaoQuantidade} {produto.unidade_medida} 
                (para atingir estoque máximo)
              </p>
            </div>

            <div>
              <Label>Data Necessidade *</Label>
              <div className="relative">
                <Input
                  type="date"
                  value={formData.data_necessidade}
                  onChange={(e) => setFormData({ ...formData, data_necessidade: e.target.value })}
                  disabled={controlesDesabilitados}
                  required
                  data-permission="Compras.SolicitacaoCompra.criar"
                  data-action="Compras.SolicitacaoCompraRapida.dataNecessidade"
                  data-context-required="group-or-company"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* PRIORIDADE */}
          <div>
            <Label>Prioridade *</Label>
            <Select
              value={formData.prioridade}
              onValueChange={(v) => setFormData({ ...formData, prioridade: v })}
              disabled={controlesDesabilitados}
            >
              <SelectTrigger
                data-permission="Compras.SolicitacaoCompra.criar"
                data-action="Compras.SolicitacaoCompraRapida.prioridade"
                data-context-required="group-or-company"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Baixa">Baixa</SelectItem>
                <SelectItem value="Média">Média</SelectItem>
                <SelectItem value="Alta">🔶 Alta</SelectItem>
                <SelectItem value="Urgente">🔥 Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* JUSTIFICATIVA */}
          <div>
            <Label>Justificativa *</Label>
            <Textarea
              value={formData.justificativa}
              onChange={(e) => setFormData({ ...formData, justificativa: e.target.value })}
              disabled={controlesDesabilitados}
              required
              rows={3}
              placeholder="Detalhe o motivo da compra..."
              data-permission="Compras.SolicitacaoCompra.criar"
              data-action="Compras.SolicitacaoCompraRapida.justificativa"
              data-context-required="group-or-company"
              data-sensitive="true"
            />
          </div>

          {/* CUSTO ESTIMADO */}
          {(produto.custo_medio || produto.custo_aquisicao) && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-700">Custo Estimado Total:</p>
                    <p className="text-2xl font-bold text-green-900">
                      R$ {((produto.custo_medio || produto.custo_aquisicao) * formData.quantidade_solicitada).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-xs text-green-700 mt-2">
                  Base: R$ {(produto.custo_medio || produto.custo_aquisicao).toFixed(2)} × {formData.quantidade_solicitada} {produto.unidade_medida}
                </p>
              </CardContent>
            </Card>
          )}

      {/* BOTÕES */}
      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
        {!windowMode && (
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-permission="Compras.SolicitacaoCompra.criar"
            data-action="Compras.SolicitacaoCompraRapida.cancelar"
            data-context-required="group-or-company"
          >
            Cancelar
          </Button>
        )}
        <Button 
          type="submit" 
          disabled={controlesDesabilitados}
          className="bg-orange-600 hover:bg-orange-700"
          data-permission="Compras.SolicitacaoCompra.criar"
          data-action="Compras.SolicitacaoCompraRapida.confirmar"
          data-context-required="group-or-company"
          data-sensitive="true"
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          {createMutation.isPending ? 'Criando...' : 'Criar Solicitação'}
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div
        className="w-full h-full bg-white"
        data-permission="Compras.SolicitacaoCompra.criar"
        data-context-required="group-or-company"
      >
        {content}
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-2xl"
        data-permission="Compras.SolicitacaoCompra.criar"
        data-action="Compras.SolicitacaoCompraRapida.dialog"
        data-context-required="group-or-company"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-orange-600" />
            Solicitar Compra - Estoque Baixo
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
