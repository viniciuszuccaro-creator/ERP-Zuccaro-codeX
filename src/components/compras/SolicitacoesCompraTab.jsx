import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Plus, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ShoppingCart,
  AlertCircle,
  Download
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import useContextoVisual from "@/components/lib/useContextoVisual";
import SolicitacaoCompraForm from "./SolicitacaoCompraForm";
import { useWindow } from "@/components/lib/useWindow";
import usePermissions from "@/components/lib/usePermissions";
import { toast as sonnerToast } from "sonner";
import ERPDataTable from "@/components/ui/erp/DataTable";
import useEntityListSorted from "@/components/lib/useEntityListSorted";
import useBackendPagination from "@/components/lib/useBackendPagination";
import usePersistedSort from "@/components/lib/usePersistedSort";

export default function SolicitacoesCompraTab({ solicitacoes, windowMode = false }) {
  const { page, setPage, pageSize, setPageSize } = useBackendPagination('SolicitacaoCompra', 20);
  const [sortField, setSortField, sortDirection, setSortDirection] = usePersistedSort('SolicitacaoCompra', 'data_solicitacao', 'desc');
  const { data: solBackend = [] } = useEntityListSorted('SolicitacaoCompra', {}, { sortField, sortDirection, page, pageSize, limit: pageSize });
  const solList = Array.isArray(solicitacoes) && solicitacoes.length ? solicitacoes : solBackend;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const { openWindow } = useWindow();
  const { hasPermission } = usePermissions();
  // Seleção em massa + exportação
  const [selectedSolicitacoes, setSelectedSolicitacoes] = useState([]);
  const toggleSolicitacao = (id) => setSelectedSolicitacoes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAllSolicitacoes = (checked, lista) => setSelectedSolicitacoes(checked ? lista.map(s => s.id) : []);
  const exportarSolicitacoesCSV = (lista) => {
    const headers = ['numero_solicitacao','produto_descricao','quantidade_solicitada','unidade_medida','solicitante','data_solicitacao','prioridade','status'];
    const csv = [
      headers.join(','),
      ...lista.map(s => headers.map(h => JSON.stringify(s[h] ?? '')).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solicitacoes_compra_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const [formData, setFormData] = useState({
    numero_solicitacao: `SC-${Date.now()}`,
    data_solicitacao: new Date().toISOString().split('T')[0],
    solicitante: "",
    setor: "",
    produto_id: "",
    produto_descricao: "",
    quantidade_solicitada: 1,
    unidade_medida: "UN",
    justificativa: "",
    prioridade: "Média",
    data_necessidade: "",
    status: "Pendente",
    observacoes: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, contexto, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const canCreateSolicitacao = hasPermission('Compras','SolicitacaoCompra','criar') || hasPermission('Compras', null, 'criar');
  const canApproveSolicitacao = hasPermission('Compras','SolicitacaoCompra','aprovar') || hasPermission('Compras', null, 'aprovar');
  const canRejectSolicitacao = hasPermission('Compras','SolicitacaoCompra','rejeitar') || hasPermission('Compras', null, 'rejeitar');
  const canGerarOC = hasPermission('Compras','SolicitacaoCompra','gerar_oc') || hasPermission('Compras','OrdemCompra','criar');

  const auditSolicitacaoCompra = async ({ acao, sucesso = true, motivo = null, dados = {} }) => {
    try {
      await createInContext('AuditLog', {
        acao,
        modulo: 'Compras',
        entidade: 'SolicitacaoCompra',
        tipo_auditoria: sucesso ? 'entidade' : 'seguranca',
        descricao: motivo || 'Auditoria de solicitacao de compra.',
        usuario: user?.email || user?.full_name || 'Sistema',
        usuario_id: user?.id || null,
        group_id: groupId || dados.group_id || null,
        grupo_id: groupId || dados.group_id || null,
        empresa_id: empresaId || dados.empresa_id || null,
        dados_novos: dados,
        sucesso,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao auditar solicitacao de compra:', error);
    }
  };

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos', groupId, empresaId],
    queryFn: () => filterInContext('Produto', {}, '-updated_date', 9999),
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => createInContext('SolicitacaoCompra', {
      ...data,
      empresa_id: empresaId,
      group_id: groupId,
      grupo_id: groupId,
      solicitante: user?.full_name,
      solicitante_id: user?.id
    }),
    onSuccess: async (oc) => {
      await auditSolicitacaoCompra({
        acao: 'SolicitacaoCompra.ordem_compra_gerada',
        dados: { ordem_compra_id: oc?.id, numero_oc: oc?.numero_oc, solicitacao_compra_id: oc?.solicitacao_compra_id }
      });
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-compra'] });
      handleCloseDialog();
      toast({ title: "✅ Solicitação criada!" });
    },
  });

  const aprovarMutation = useMutation({
    mutationFn: ({ id }) => updateInContext('SolicitacaoCompra', id, {
      status: "Aprovada",
      aprovador: user?.full_name,
      data_aprovacao: new Date().toISOString().split('T')[0]
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-compra'] });
      toast({ title: "✅ Solicitação aprovada!" });
    },
  });

  const rejeitarMutation = useMutation({
    mutationFn: ({ id, motivo }) => updateInContext('SolicitacaoCompra', id, {
      status: "Rejeitada",
      aprovador: user?.full_name,
      data_aprovacao: new Date().toISOString().split('T')[0],
      observacoes: motivo
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-compra'] });
      toast({ title: "❌ Solicitação rejeitada" });
    },
  });

  const gerarOCMutation = useMutation({
    mutationFn: async (solicitacao) => {
      // Criar Ordem de Compra
      const oc = await createInContext('OrdemCompra', {
        numero_oc: `OC-${Date.now()}`,
        fornecedor_nome: "A definir",
        solicitacao_compra_id: solicitacao.id,
        data_solicitacao: new Date().toISOString().split('T')[0],
        valor_total: 0,
        status: "Solicitada",
        itens: [{
          produto_id: solicitacao.produto_id,
          descricao: solicitacao.produto_descricao,
          quantidade_solicitada: solicitacao.quantidade_solicitada,
          unidade: solicitacao.unidade_medida,
          valor_unitario: 0,
          valor_total: 0
        }],
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId
      });

      // Atualizar solicitação
      await updateInContext('SolicitacaoCompra', solicitacao.id, {
        status: "Compra Gerada",
        ordem_compra_id: oc.id
      });

      return oc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-compra'] });
      queryClient.invalidateQueries({ queryKey: ['ordensCompra'] });
      toast({ title: "✅ OC gerada!" });
    },
  });

  // BOTÃO IA - SUGERIR COMPRAS AUTOMÁTICAS
  const sugerirComprasIA = useMutation({
    mutationFn: async () => {
      // Buscar produtos com estoque baixo
      const todosProdutos = await filterInContext('Produto', {}, '-updated_date', 9999);
      const produtosBaixos = todosProdutos.filter(p => 
        p.status === 'Ativo' && 
        (p.estoque_disponivel || p.estoque_atual || 0) <= (p.estoque_minimo || 0)
      );

      if (produtosBaixos.length === 0) {
        throw new Error("Nenhum produto com estoque baixo");
      }

      // Criar prompt para IA
      const prompt = `
Analise os produtos com estoque baixo e sugira prioridades de compra.

PRODUTOS COM ESTOQUE BAIXO:
${produtosBaixos.map(p => `
- ${p.descricao} (${p.codigo})
  Estoque Atual: ${p.estoque_disponivel || p.estoque_atual || 0} ${p.unidade_medida}
  Estoque Mínimo: ${p.estoque_minimo || 0}
  Vendas 30 dias: ${p.quantidade_vendida_30dias || 0}
  Fornecedor: ${p.fornecedor_principal || 'Não definido'}
`).join('\n')}

Retorne JSON com:
- produtos prioritários (ordem de urgência)
- quantidade sugerida
- justificativa
- prioridade (Baixa/Média/Alta/Urgente)
      `.trim();

      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            sugestoes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  produto_codigo: { type: "string" },
                  quantidade_sugerida: { type: "number" },
                  justificativa: { type: "string" },
                  prioridade: { type: "string" }
                }
              }
            }
          }
        }
      });

      // Criar solicitações automaticamente
      const solicitacoesCriadas = [];
      for (const sug of resultado.sugestoes.slice(0, 10)) { // Limiting to 10 suggestions for practical reasons
        const produto = produtosBaixos.find(p => p.codigo === sug.produto_codigo);
        if (produto) {
          const sol = await createInContext('SolicitacaoCompra', {
            numero_solicitacao: `SC-IA-${Date.now()}-${solicitacoesCriadas.length}`,
            data_solicitacao: new Date().toISOString().split('T')[0],
            produto_id: produto.id,
            produto_descricao: produto.descricao,
            quantidade_solicitada: sug.quantidade_sugerida,
            unidade_medida: produto.unidade_medida,
            justificativa: `🤖 IA: ${sug.justificativa}`,
            prioridade: sug.prioridade,
            data_necessidade: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
            status: "Pendente",
            solicitante: "IA - Sistema Automático",
            setor: "Estoque",
            empresa_id: empresaId,
            group_id: groupId,
            grupo_id: groupId
          });
          solicitacoesCriadas.push(sol);
        }
      }

      return solicitacoesCriadas;
    },
    onSuccess: (solicitacoes) => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-compra'] });
      toast({ 
        title: "✅ IA criou solicitações!",
        description: `${solicitacoes.length} solicitações geradas automaticamente`
      });
    },
    onError: (error) => {
      toast({
        title: "⚠️ Nenhuma sugestão",
        description: error.message || "Não foi possível gerar sugestões de compra.",
        variant: "destructive"
      });
    }
  });


  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditando(null);
    setFormData({
      numero_solicitacao: `SC-${Date.now()}`,
      data_solicitacao: new Date().toISOString().split('T')[0],
      solicitante: "",
      setor: "",
      produto_id: "",
      produto_descricao: "",
      quantidade_solicitada: 1,
      unidade_medida: "UN",
      justificativa: "",
      prioridade: "Média",
      data_necessidade: "",
      status: "Pendente",
      observacoes: ""
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!contextoValido || !canCreateSolicitacao) {
      toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de criar' : 'Sem permissao para criar', variant: 'destructive' });
      auditSolicitacaoCompra({ acao: 'SolicitacaoCompra.criacao_bloqueada', sucesso: false, motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada', dados: { produto_id: formData.produto_id, produto_descricao: formData.produto_descricao } });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleAprovar = (solicitacao) => {
    if (!contextoValido || !canApproveSolicitacao) {
      toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de aprovar' : 'Sem permissao para aprovar', variant: 'destructive' });
      auditSolicitacaoCompra({ acao: 'SolicitacaoCompra.aprovacao_bloqueada', sucesso: false, motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada', dados: { solicitacao_id: solicitacao.id, numero_solicitacao: solicitacao.numero_solicitacao } });
      return;
    }
    if (confirm(`Aprovar solicitação de ${solicitacao.produto_descricao}?`)) {
      aprovarMutation.mutate({ id: solicitacao.id });
    }
  };

  const handleRejeitar = (solicitacao) => {
    if (!contextoValido || !canRejectSolicitacao) {
      toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de rejeitar' : 'Sem permissao para rejeitar', variant: 'destructive' });
      auditSolicitacaoCompra({ acao: 'SolicitacaoCompra.rejeicao_bloqueada', sucesso: false, motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada', dados: { solicitacao_id: solicitacao.id, numero_solicitacao: solicitacao.numero_solicitacao } });
      return;
    }
    const motivo = prompt("Motivo da rejeição:");
    if (motivo) {
      rejeitarMutation.mutate({ id: solicitacao.id, motivo });
    }
  };

  const handleGerarOC = (solicitacao) => {
    if (!contextoValido || !canGerarOC) {
      toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de gerar OC' : 'Sem permissao para gerar OC', variant: 'destructive' });
      auditSolicitacaoCompra({ acao: 'SolicitacaoCompra.geracao_oc_bloqueada', sucesso: false, motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada', dados: { solicitacao_id: solicitacao.id, numero_solicitacao: solicitacao.numero_solicitacao } });
      return;
    }
    if (confirm(`Gerar Ordem de Compra para ${solicitacao.produto_descricao}?`)) {
      gerarOCMutation.mutate(solicitacao);
    }
  };

  const statusColors = {
    'Pendente': 'bg-yellow-100 text-yellow-700',
    'Em Análise': 'bg-blue-100 text-blue-700',
    'Aprovada': 'bg-green-100 text-green-700',
    'Rejeitada': 'bg-red-100 text-red-700',
    'Compra Gerada': 'bg-purple-100 text-purple-700',
    'Finalizada': 'bg-gray-100 text-gray-700'
  };

  const content = (
    <div
      className="w-full h-full space-y-1.5"
      data-permission="Compras.SolicitacaoCompra.visualizar"
      data-context-required="group-or-company"
      data-context-mode={contexto}
    >
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Solicitações de Compra</h2>
        <div className="flex gap-1">
          <Button
            onClick={() => sugerirComprasIA.mutate()}
            disabled={sugerirComprasIA.isPending || !contextoValido || !canCreateSolicitacao}
            variant="outline"
            size="sm"
            className="border-purple-300 text-purple-700 hover:bg-purple-50"
            data-permission="Compras.SolicitacaoCompra.criar"
            data-action="Compras.SolicitacaoCompra.sugerirIA"
            data-context-required="group-or-company"
            data-sensitive="true"
          >
            {sugerirComprasIA.isPending ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600 mr-1" />
                <span className="text-xs">Analisando...</span>
              </>
            ) : (
              <span className="text-xs">🤖 IA</span>
            )}
          </Button>
          {canCreateSolicitacao && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              data-permission="Compras.SolicitacaoCompra.criar"
              data-action="Compras.SolicitacaoCompra.abrirFormulario"
              data-context-required="group-or-company"
              data-sensitive="true"
              disabled={!contextoValido}
              onClick={() => openWindow(SolicitacaoCompraForm, {
                windowMode: true,
                onSubmit: async (data) => {
                  try {
                    await createMutation.mutateAsync(data);
                    sonnerToast.success("✅ Solicitação criada!");
                  } catch (error) {
                    sonnerToast.error("Erro ao criar solicitação");
                  }
                }
              }, {
                title: '🛒 Nova Solicitação de Compra',
                width: 900,
                height: 650
              })}
            >
              <Plus className="w-3 h-3 mr-1" />
              Nova
            </Button>
          )}

          {/* BACKUP: Dialog removido */}
          <Dialog open={false}>
            <DialogTrigger asChild>
              <Button
                className="hidden"
                data-permission="Compras.SolicitacaoCompra.criar"
                data-action="Compras.SolicitacaoCompra.dialogLegado"
                data-context-required="group-or-company"
              >
                Removido
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nova Solicitação de Compra</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={handleSubmit}
                className="space-y-4"
                data-permission="Compras.SolicitacaoCompra.criar"
                data-action="Compras.SolicitacaoCompra.formularioLegado"
                data-context-required="group-or-company"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Produto *</Label>
                    <Select
                      value={formData.produto_id}
                      onValueChange={(v) => {
                        const prod = produtos.find(p => p.id === v);
                        setFormData({
                          ...formData,
                          produto_id: v,
                          produto_descricao: prod?.descricao || "",
                          unidade_medida: prod?.unidade_medida || "UN"
                        });
                      }}
                      required
                    >
                      <SelectTrigger
                        data-permission="Compras.SolicitacaoCompra.criar"
                        data-action="Compras.SolicitacaoCompra.produto"
                        data-context-required="group-or-company"
                      >
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {produtos.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.descricao} ({p.codigo})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Quantidade *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={formData.quantidade_solicitada}
                        onChange={(e) => setFormData({ ...formData, quantidade_solicitada: parseFloat(e.target.value) || 0 })}
                        required
                        data-permission="Compras.SolicitacaoCompra.criar"
                        data-action="Compras.SolicitacaoCompra.quantidade"
                        data-context-required="group-or-company"
                        data-sensitive="true"
                      />
                    </div>
                    <div>
                      <Label>Unidade</Label>
                      <Input
                        value={formData.unidade_medida}
                        readOnly
                        className="bg-slate-50"
                        data-permission="Compras.SolicitacaoCompra.visualizar"
                        data-action="Compras.SolicitacaoCompra.unidade"
                        data-context-required="group-or-company"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Prioridade</Label>
                    <Select
                      value={formData.prioridade}
                      onValueChange={(v) => setFormData({ ...formData, prioridade: v })}
                    >
                      <SelectTrigger
                        data-permission="Compras.SolicitacaoCompra.criar"
                        data-action="Compras.SolicitacaoCompra.prioridade"
                        data-context-required="group-or-company"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Baixa">Baixa</SelectItem>
                        <SelectItem value="Média">Média</SelectItem>
                        <SelectItem value="Alta">Alta</SelectItem>
                        <SelectItem value="Urgente">🔥 Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Data Necessidade</Label>
                    <Input
                      type="date"
                      value={formData.data_necessidade}
                      onChange={(e) => setFormData({ ...formData, data_necessidade: e.target.value })}
                      data-permission="Compras.SolicitacaoCompra.criar"
                      data-action="Compras.SolicitacaoCompra.dataNecessidade"
                      data-context-required="group-or-company"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Justificativa *</Label>
                    <Textarea
                      value={formData.justificativa}
                      onChange={(e) => setFormData({ ...formData, justificativa: e.target.value })}
                      placeholder="Explique o motivo da compra..."
                      required
                      rows={3}
                      data-permission="Compras.SolicitacaoCompra.criar"
                      data-action="Compras.SolicitacaoCompra.justificativa"
                      data-context-required="group-or-company"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                    data-permission="Compras.SolicitacaoCompra.criar"
                    data-action="Compras.SolicitacaoCompra.cancelar"
                    data-context-required="group-or-company"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || !contextoValido}
                    data-permission="Compras.SolicitacaoCompra.criar"
                    data-action="Compras.SolicitacaoCompra.confirmar"
                    data-context-required="group-or-company"
                    data-sensitive="true"
                  >
                    Criar Solicitação
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle>Lista de Solicitações ({solicitacoes.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {selectedSolicitacoes.length > 0 && (
            <Alert className="m-4 border-blue-300 bg-blue-50">
              <AlertDescription className="flex items-center justify-between">
                <div className="text-blue-900 font-semibold">{selectedSolicitacoes.length} solicita e7 e3o(ões) selecionada(s)</div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => exportarSolicitacoesCSV(solicitacoes.filter(s => selectedSolicitacoes.includes(s.id)))}>
                    <Download className="w-4 h-4 mr-2" /> Exportar CSV
                  </Button>
                  <Button variant="ghost" onClick={() => setSelectedSolicitacoes([])}>Limpar Seleção</Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          <ERPDataTable
            columns={[
              { key: 'numero_solicitacao', label: 'Nº Solicitação', render: (s) => <span className="font-medium">{s.numero_solicitacao}</span> },
              { key: 'produto_descricao', label: 'Produto' },
              { key: 'quantidade_solicitada', label: 'Qtd', isNumeric: true, render: (s) => `${s.quantidade_solicitada} ${s.unidade_medida}` },
              { key: 'solicitante', label: 'Solicitante' },
              { key: 'data_solicitacao', label: 'Data', render: (s) => new Date(s.data_solicitacao).toLocaleDateString('pt-BR') },
              { key: 'prioridade', label: 'Prioridade', render: (s) => (
                <Badge variant="outline" className={
                  s.prioridade === 'Urgente' ? 'border-red-300 text-red-700' :
                  s.prioridade === 'Alta' ? 'border-orange-300 text-orange-700' :
                  'border-slate-300 text-slate-700'
                }>
                  {s.prioridade}
                </Badge>
              ) },
              { key: 'status', label: 'Status', render: (s) => <Badge className={statusColors[s.status]}>{s.status}</Badge> },
              { key: 'actions', label: 'Ações', render: (s) => (
                <div className="flex gap-1">
                  {s.status === 'Pendente' && (
                    <>
                      {canApproveSolicitacao && (
                        <Button
                          variant="ghost"
                          size="icon"
                          data-permission="Compras.SolicitacaoCompra.aprovar"
                          data-action="Compras.SolicitacaoCompra.aprovar"
                          data-context-required="group-or-company"
                          data-sensitive="true"
                          onClick={() => handleAprovar(s)}
                          title="Aprovar"
                        >
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        </Button>
                      )}
                      {canRejectSolicitacao && (
                        <Button
                          variant="ghost"
                          size="icon"
                          data-permission="Compras.SolicitacaoCompra.rejeitar"
                          data-action="Compras.SolicitacaoCompra.rejeitar"
                          data-context-required="group-or-company"
                          data-sensitive="true"
                          onClick={() => handleRejeitar(s)}
                          title="Rejeitar"
                        >
                          <XCircle className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
                    </>
                  )}
                  {s.status === 'Aprovada' && canGerarOC && (
                    <Button
                      variant="ghost"
                      size="sm"
                      data-permission="Compras.SolicitacaoCompra.gerar_oc"
                      data-action="Compras.SolicitacaoCompra.gerarOC"
                      data-context-required="group-or-company"
                      data-sensitive="true"
                      onClick={() => handleGerarOC(s)}
                      className="text-purple-600"
                    >
                      <ShoppingCart className="w-4 h-4 mr-1" /> Gerar OC
                    </Button>
                  )}
                </div>
              ) }
            ]}
            data={solList}
            entityName="SolicitacaoCompra"
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={(sf, sd) => { setSortField(sf); setSortDirection(sd); }}
            selectedIds={selectedSolicitacoes}
            allSelected={selectedSolicitacoes.length === solList.length && solList.length > 0}
            onToggleSelectAll={() => {
              const all = selectedSolicitacoes.length === solList.length && solList.length > 0;
              setSelectedSolicitacoes(all ? [] : solList.map(s=>s.id));
            }}
            onToggleItem={(id) => toggleSolicitacao(id)}
            permission="Compras.SolicitacaoCompra.visualizar"
            page={page}
            pageSize={pageSize}
            totalItems={page * pageSize + (solBackend.length < pageSize ? 0 : 1)}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          />
        </CardContent>
      </Card>
    </div>
  );

  if (windowMode) {
    return <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-orange-50 overflow-auto p-1.5">{content}</div>;
  }

  return content;
}
