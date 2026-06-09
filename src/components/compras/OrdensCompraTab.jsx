import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, CheckCircle2, Send, Star, Printer, Eye, Download } from "lucide-react";
import OrdensCompraHeader from "./OrdensCompraHeader";
import OCSelecionadasBar from "./OCSelecionadasBar";
import OCTabela from "./OCTabela";
import OCPaginacao from "./OCPaginacao";
import ERPDataTable from "@/components/ui/erp/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import OrdemCompraForm from "./OrdemCompraForm";
import AvaliacaoFornecedorForm from "./AvaliacaoFornecedorForm";
import RecebimentoOCForm from "./RecebimentoOCForm";
import { useWindow } from "@/components/lib/useWindow";
import usePersistedSort from "@/components/lib/usePersistedSort";
import useBackendPagination from "@/components/lib/useBackendPagination";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import useEntityListSorted from "@/components/lib/useEntityListSorted";
import { toast as sonnerToast } from "sonner";
import { ImprimirOrdemCompra } from "@/components/lib/ImprimirOrdemCompra";
import { useUser } from "@/components/lib/UserContext";

export default function OrdensCompraTab({ ordensCompra, fornecedores, empresas = [], windowMode = false }) {
  const { createInContext, updateInContext, filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const { page, setPage, pageSize, setPageSize } = useBackendPagination('OrdemCompra', 20);
  const [sortField, setSortField, sortDirection, setSortDirection] = usePersistedSort('OrdemCompra', 'data_solicitacao', 'desc');

  // persistência de sort movida para usePersistedSort

  const { data: ocBackend = [] } = useEntityListSorted('OrdemCompra', {}, { sortField, sortDirection, page, pageSize, limit: pageSize });
  const ocList = Array.isArray(ordensCompra) && ordensCompra.length ? ordensCompra : ocBackend;
  const { user: authUser } = useUser();
  const { hasPermission } = usePermissions();
  const canCreateOC = hasPermission('Compras','OrdemCompra','criar') || hasPermission('Compras', null, 'criar');
  const canApproveOC = hasPermission('Compras','OrdemCompra','aprovar') || hasPermission('Compras', null, 'aprovar');
  const canSendOC = hasPermission('Compras','OrdemCompra','enviar_fornecedor') || hasPermission('Compras','OrdemCompra','editar');
  const canReceiveOC = hasPermission('Compras','OrdemCompra','receber') || hasPermission('Estoque','Movimentacoes','criar');
  const canEvaluateSupplier = hasPermission('Compras','OrdemCompra','avaliar_fornecedor') || hasPermission('Compras','Fornecedor','editar');
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOC, setEditingOC] = useState(null);
  const { openWindow } = useWindow();
  const [isAvaliacaoDialogOpen, setIsAvaliacaoDialogOpen] = useState(false);
  const [ocSelecionada, setOcSelecionada] = useState(null);
  const [isRecebimentoDialogOpen, setIsRecebimentoDialogOpen] = useState(false);
  // Seleção em massa + exportação
  const [selectedOCs, setSelectedOCs] = useState([]);
  const toggleOC = (id) => setSelectedOCs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAllOCs = (checked, lista) => setSelectedOCs(checked ? lista.map(o => o.id) : []);
  const exportarOCsCSV = (lista) => {
    const headers = ['numero_oc','fornecedor_nome','empresa_id','data_solicitacao','valor_total','status','lead_time_real'];
    const csv = [
      headers.join(','),
      ...lista.map(o => headers.map(h => JSON.stringify(o[h] ?? '')).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ordens_compra_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [formData, setFormData] = useState({
    numero_oc: "",
    fornecedor_id: "",
    fornecedor_nome: "",
    data_solicitacao: new Date().toISOString().split('T')[0],
    data_entrega_prevista: "",
    valor_total: "",
    prazo_entrega_acordado: "",
    condicao_pagamento: "À Vista",
    forma_pagamento: "Boleto",
    observacoes: "",
    itens: []
  });

  const [avaliacaoFormData, setAvaliacaoFormData] = useState({
    nota: 5,
    qualidade: 5,
    prazo: 5,
    preco: 5,
    atendimento: 5,
    comentario: ""
  });

  const [recebimentoFormData, setRecebimentoFormData] = useState({
    data_entrega_real: new Date().toISOString().split('T')[0],
    nota_fiscal_entrada: "",
    observacoes: ""
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const auditOrdemCompra = async ({ acao, sucesso = true, motivo = null, dados = {} }) => {
    try {
      await createInContext('AuditLog', {
        acao,
        modulo: 'Compras',
        entidade: 'OrdemCompra',
        tipo_auditoria: sucesso ? 'entidade' : 'seguranca',
        descricao: motivo || 'Auditoria de ordem de compra.',
        usuario: authUser?.email || authUser?.full_name || 'Sistema',
        usuario_id: authUser?.id || null,
        group_id: groupId || dados.group_id || null,
        grupo_id: groupId || dados.group_id || null,
        empresa_id: empresaId || dados.empresa_id || null,
        dados_novos: dados,
        sucesso,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao auditar ordem de compra:', error);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data) => createInContext('OrdemCompra', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['ordensCompra']);
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "✅ Ordem de Compra criada com sucesso!" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateInContext('OrdemCompra', id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['ordensCompra']);
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "✅ Ordem de Compra atualizada com sucesso!" });
    },
  });

  const aprovarMutation = useMutation({
    mutationFn: async ({ id, oc }) => {
      if (!contextoValido || !canApproveOC) {
        await auditOrdemCompra({
          acao: 'OrdemCompra.aprovacao_bloqueada',
          sucesso: false,
          motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada',
          dados: { ordem_compra_id: id, numero_oc: oc?.numero_oc }
        });
        throw new Error(!contextoValido ? 'Selecione grupo ou empresa antes de aprovar OC.' : 'Sem permissao para aprovar OC.');
      }
      const hoje = new Date().toISOString().split('T')[0];
      await updateInContext('OrdemCompra', id, {
        status: 'Aprovada',
        data_aprovacao: hoje,
        historico: [
          ...(oc.historico || []),
          {
            data: new Date().toISOString(),
            status_anterior: oc.status,
            status_novo: 'Aprovada',
            usuario: (authUser?.full_name || authUser?.email || 'Sistema'),
            observacao: 'Ordem de compra aprovada'
          }
        ]
      });
      return { id, oc };
    },
    onSuccess: async ({ id, oc }) => {
      await auditOrdemCompra({
        acao: 'OrdemCompra.aprovada',
        dados: { ordem_compra_id: id, numero_oc: oc?.numero_oc, status_anterior: oc?.status, status_novo: 'Aprovada' }
      });
      queryClient.invalidateQueries(['ordensCompra']);
      toast({ title: "Ordem de Compra aprovada!" });
    },
  });

  const enviarFornecedorMutation = useMutation({
    mutationFn: async ({ id, oc }) => {
      if (!contextoValido || !canSendOC) {
        await auditOrdemCompra({
          acao: 'OrdemCompra.envio_bloqueado',
          sucesso: false,
          motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada',
          dados: { ordem_compra_id: id, numero_oc: oc?.numero_oc }
        });
        throw new Error(!contextoValido ? 'Selecione grupo ou empresa antes de enviar OC.' : 'Sem permissao para enviar OC ao fornecedor.');
      }
      const hoje = new Date().toISOString().split('T')[0];
      await updateInContext('OrdemCompra', id, {
        status: 'Enviada ao Fornecedor',
        data_envio_fornecedor: hoje,
        historico: [
          ...(oc.historico || []),
          {
            data: new Date().toISOString(),
            status_anterior: oc.status,
            status_novo: 'Enviada ao Fornecedor',
            usuario: (authUser?.full_name || authUser?.email || 'Sistema'),
            observacao: 'Ordem enviada ao fornecedor'
          }
        ]
      });
      return { id, oc };
    },
    onSuccess: async ({ id, oc }) => {
      await auditOrdemCompra({
        acao: 'OrdemCompra.enviada_fornecedor',
        dados: { ordem_compra_id: id, numero_oc: oc?.numero_oc, status_anterior: oc?.status, status_novo: 'Enviada ao Fornecedor' }
      });
      queryClient.invalidateQueries(['ordensCompra']);
      toast({
        title: "OC enviada ao fornecedor!",
        description: "E-mail enviado (se configurado)"
      });
    },
  });

  const receberMutation = useMutation({
    mutationFn: async ({ id, oc, dados }) => {
      if (!contextoValido || !canReceiveOC) {
        await auditOrdemCompra({
          acao: 'OrdemCompra.recebimento_bloqueado',
          sucesso: false,
          motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada',
          dados: { ordem_compra_id: id, numero_oc: oc?.numero_oc }
        });
        throw new Error(!contextoValido ? 'Selecione grupo ou empresa antes de receber OC.' : 'Sem permissao para receber OC.');
      }
      const dataEnvio = new Date(oc.data_envio_fornecedor);
      const dataRecebimento = new Date(dados.data_entrega_real);
      const leadTimeReal = Math.floor((dataRecebimento - dataEnvio) / (1000 * 60 * 60 * 24));

      // Atualizar OC
      await updateInContext('OrdemCompra', id, {
        status: 'Recebida',
        data_entrega_real: dados.data_entrega_real,
        nota_fiscal_entrada: dados.nota_fiscal_entrada,
        lead_time_real: leadTimeReal,
        historico: [
          ...(oc.historico || []),
          {
            data: new Date().toISOString(),
            status_anterior: oc.status,
            status_novo: 'Recebida',
            usuario: (authUser?.full_name || authUser?.email || 'Sistema'),
            observacao: `Recebida. Lead time: ${leadTimeReal} dias`
          }
        ]
      });

      // Atualizar estatísticas do fornecedor
      const fornecedor = fornecedores.find(f => f.id === oc.fornecedor_id);
      if (fornecedor) {
        const qtdCompras = (fornecedor.quantidade_compras || 0) + 1;
        const valorTotal = (fornecedor.valor_total_compras || 0) + (oc.valor_total || 0);
        
        // Calcular lead time médio
        const leadTimesAnteriores = fornecedor.lead_time_medio ? [fornecedor.lead_time_medio] : [];
        const leadTimes = [...leadTimesAnteriores, leadTimeReal];
        const leadTimeMedio = leadTimes.reduce((sum, lt) => sum + lt, 0) / leadTimes.length;

        // Calcular % entregas no prazo
        const prazoAcordado = oc.prazo_entrega_acordado || fornecedor.prazo_entrega_padrao || 0;
        const noPrazo = leadTimeReal <= prazoAcordado;
        const totalEntregasPrazo = (fornecedor.percentual_entregas_prazo || 0) * (qtdCompras - 1);
        const novoPercentual = ((totalEntregasPrazo + (noPrazo ? 1 : 0)) / qtdCompras) * 100;

        await updateInContext('Fornecedor',fornecedor.id, {
          quantidade_compras: qtdCompras,
          valor_total_compras: valorTotal,
          ultima_compra: dados.data_entrega_real,
          lead_time_medio: Math.round(leadTimeMedio),
          percentual_entregas_prazo: Math.round(novoPercentual)
        });
      }

      // Criar movimentação de estoque (entrada) para cada item
      if (oc.itens && oc.itens.length > 0) {
        for (const item of oc.itens) {
          await createInContext('MovimentacaoEstoque', {
            produto_id: item.produto_id,
            produto_descricao: item.descricao,
            tipo_movimentacao: 'Entrada',
            quantidade: item.quantidade_solicitada,
            data_movimentacao: dados.data_entrega_real,
            documento: `OC-${oc.numero_oc}`,
            motivo: `Recebimento de Ordem de Compra`,
            valor_unitario: item.valor_unitario,
            valor_total: item.valor_total,
            responsavel: 'Sistema',
            observacoes: dados.observacoes
          });

          // Atualizar estoque do produto
          if (item.produto_id) {
            const produto = await filterInContext('Produto', { id: item.produto_id }, 'descricao', 1);
            if (produto && produto.length > 0) {
              const produtoAtual = produto[0];
              await updateInContext('Produto', item.produto_id, {
                estoque_atual: (Number(produtoAtual.estoque_atual) || 0) + Number(item.quantidade_solicitada || 0),
                ultima_compra: dados.data_entrega_real,
                ultimo_preco_compra: item.valor_unitario,
                group_id: produtoAtual.group_id || groupId,
                grupo_id: produtoAtual.grupo_id || groupId,
                empresa_id: produtoAtual.empresa_id || empresaId
              });
            }
          }
        }
      }

      return { leadTimeReal, fornecedorNome: oc.fornecedor_nome, ordemCompraId: id, numeroOC: oc.numero_oc, itensRecebidos: oc.itens?.length || 0 };
    },
    onSuccess: async ({ leadTimeReal, fornecedorNome, ordemCompraId, numeroOC, itensRecebidos }) => {
      await auditOrdemCompra({
        acao: 'OrdemCompra.recebida',
        dados: { ordem_compra_id: ordemCompraId, numero_oc: numeroOC, lead_time_real: leadTimeReal, itens_recebidos: itensRecebidos }
      });
      queryClient.invalidateQueries(['ordensCompra']);
      queryClient.invalidateQueries(['fornecedores']);
      queryClient.invalidateQueries(['movimentacoes']);
      queryClient.invalidateQueries(['produtos']);
      
      setIsRecebimentoDialogOpen(false);
      
      toast({ 
        title: "✅ Recebimento Registrado!",
        description: `Lead time: ${leadTimeReal} dias | Estoque atualizado`
      });

      // Abrir dialog de avaliação
      setTimeout(() => {
        setOcSelecionada(ocSelecionada); // Manter OC selecionada
        setIsAvaliacaoDialogOpen(true);
      }, 500);
    },
  });

  const avaliarFornecedorMutation = useMutation({
    mutationFn: async ({ oc, avaliacao }) => {
      const notaMedia = (
        avaliacao.qualidade +
        avaliacao.prazo +
        avaliacao.preco +
        avaliacao.atendimento
      ) / 4;

      // Atualizar OC com avaliação
      await updateInContext('OrdemCompra', oc.id, {
        avaliacao_fornecedor: {
          realizada: true,
          data: new Date().toISOString(),
          nota: notaMedia,
          criterios: {
            qualidade: avaliacao.qualidade,
            prazo: avaliacao.prazo,
            preco: avaliacao.preco,
            atendimento: avaliacao.atendimento
          },
          comentario: avaliacao.comentario
        }
      });

      // Adicionar avaliação ao histórico do fornecedor
      const fornecedor = fornecedores.find(f => f.id === oc.fornecedor_id);
      if (fornecedor) {
        const novasAvaliacoes = [
          ...(fornecedor.avaliacoes || []),
          {
            data: new Date().toISOString(),
            nota: notaMedia,
            criterios: {
              qualidade: avaliacao.qualidade,
              prazo: avaliacao.prazo,
              preco: avaliacao.preco,
              atendimento: avaliacao.atendimento
            },
            ordem_compra_id: oc.id,
            avaliador: 'Sistema',
            comentario: avaliacao.comentario
          }
        ];

        // Calcular nota média do fornecedor
        const somaNotas = novasAvaliacoes.reduce((sum, av) => sum + av.nota, 0);
        const notaMediaFornecedor = somaNotas / novasAvaliacoes.length;

        await updateInContext('Fornecedor',fornecedor.id, {
          avaliacoes: novasAvaliacoes,
          nota_media: parseFloat(notaMediaFornecedor.toFixed(2))
        });
      }

      return { notaMedia, fornecedorNome: oc.fornecedor_nome };
    },
    onSuccess: ({ notaMedia, fornecedorNome }) => {
      queryClient.invalidateQueries(['ordensCompra']);
      queryClient.invalidateQueries(['fornecedores']);
      setIsAvaliacaoDialogOpen(false);
      setAvaliacaoFormData({
        nota: 5,
        qualidade: 5,
        prazo: 5,
        preco: 5,
        atendimento: 5,
        comentario: ""
      });
      toast({ 
        title: "✅ Avaliação Registrada!",
        description: `${fornecedorNome}: ${notaMedia.toFixed(1)} estrelas`
      });
    },
  });

  const resetForm = () => {
    setFormData({
      numero_oc: "",
      fornecedor_id: "",
      fornecedor_nome: "",
      data_solicitacao: new Date().toISOString().split('T')[0],
      data_entrega_prevista: "",
      valor_total: "",
      prazo_entrega_acordado: "",
      condicao_pagamento: "À Vista",
      forma_pagamento: "Boleto",
      observacoes: "",
      itens: []
    });
    setEditingOC(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const fornecedorSelecionado = fornecedores.find(f => f.id === formData.fornecedor_id);
    
    const data = {
      ...formData,
      fornecedor_nome: fornecedorSelecionado?.nome || formData.fornecedor_nome,
      valor_total: parseFloat(formData.valor_total),
      prazo_entrega_acordado: parseInt(formData.prazo_entrega_acordado) || null
    };

    if (editingOC) {
      updateMutation.mutate({ id: editingOC.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (oc) => {
    setEditingOC(oc);
    setFormData({
      numero_oc: oc.numero_oc || "",
      fornecedor_id: oc.fornecedor_id || "",
      fornecedor_nome: oc.fornecedor_nome || "",
      data_solicitacao: oc.data_solicitacao || new Date().toISOString().split('T')[0],
      data_entrega_prevista: oc.data_entrega_prevista || "",
      valor_total: oc.valor_total || "",
      prazo_entrega_acordado: oc.prazo_entrega_acordado || "",
      condicao_pagamento: oc.condicao_pagamento || "À Vista",
      forma_pagamento: oc.forma_pagamento || "Boleto",
      observacoes: oc.observacoes || "",
      itens: oc.itens || []
    });
    setIsDialogOpen(true);
  };

  const handleReceberClick = (oc) => {
    if (!contextoValido || !canReceiveOC) { toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de receber' : 'Sem permissao para receber', variant: 'destructive' }); return; }
    openWindow(RecebimentoOCForm, {
      ordemCompra: oc,
      windowMode: true,
      onSubmit: async (dados) => {
        try {
          const confirmado = window.confirm(`Confirma receber a OC ${oc.numero_oc} e atualizar estoque/produto?`);
          if (!confirmado) {
            await auditOrdemCompra({ acao: 'OrdemCompra.recebimento_cancelado', sucesso: false, motivo: 'confirmacao_cancelada', dados: { ordem_compra_id: oc.id, numero_oc: oc.numero_oc } });
            return;
          }
          await receberMutation.mutateAsync({ id: oc.id, oc, dados });
          sonnerToast.success("✅ Recebimento registrado!");
        } catch (error) {
          sonnerToast.error("Erro ao registrar recebimento");
        }
      }
    }, {
      title: `📦 Receber: ${oc.numero_oc}`,
      width: 800,
      height: 600
    });
  };

  const filteredOCs = ocList.filter(oc => {
    const searchLower = searchTerm.toLowerCase();
    return oc.numero_oc?.toLowerCase().includes(searchLower) ||
      oc.fornecedor_nome?.toLowerCase().includes(searchLower) ||
      oc.status?.toLowerCase().includes(searchLower) ||
      oc.solicitante?.toLowerCase().includes(searchLower) ||
      oc.aprovador?.toLowerCase().includes(searchLower) ||
      oc.centro_custo?.toLowerCase().includes(searchLower) ||
      oc.condicao_pagamento?.toLowerCase().includes(searchLower) ||
      oc.forma_pagamento?.toLowerCase().includes(searchLower) ||
      oc.nota_fiscal_entrada?.includes(searchLower) ||
      oc.observacoes?.toLowerCase().includes(searchLower);
  });

  const statusColors = {
    'Solicitada': 'bg-blue-100 text-blue-700',
    'Aprovada': 'bg-purple-100 text-purple-700',
    'Enviada ao Fornecedor': 'bg-indigo-100 text-indigo-700',
    'Em Processo': 'bg-yellow-100 text-yellow-700',
    'Parcialmente Recebida': 'bg-cyan-100 text-cyan-700',
    'Recebida': 'bg-green-100 text-green-700',
    'Cancelada': 'bg-gray-100 text-gray-700'
  };

  const content = (
    <div className="space-y-1.5 w-full h-full" data-permission="Compras.OrdemCompra" data-context-required="group-or-company" data-context-mode={contexto}>
      {!contextoValido && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertDescription className="text-sm text-amber-800">Selecione grupo ou empresa antes de criar, aprovar, enviar ou receber ordens de compra.</AlertDescription>
        </Alert>
      )}
      <OrdensCompraHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onNovaOC={() => {
          if (!contextoValido || !canCreateOC) { toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de criar' : 'Sem permissao para criar', variant: 'destructive' }); return; }
          openWindow(OrdemCompraForm, {
            windowMode: true,
            onSubmit: async (data) => {
              try {
                await createMutation.mutateAsync(data);
                sonnerToast.success("✅ Ordem de Compra criada!");
              } catch (error) {
                sonnerToast.error("Erro ao criar OC");
              }
            }
          }, {
            title: '🛒 Nova Ordem de Compra',
            width: 1100,
            height: 700
          })
        }}
      />

        {/* BACKUP: Dialog removido */}
        <Dialog open={false}>
          <DialogTrigger asChild>
            <Button
              className="hidden"
              data-permission="Compras.OrdemCompra.criar"
              data-action="Compras.OrdemCompra.dialogLegado"
              data-context-required="group-or-company"
            >
              Removido
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingOC ? 'Editar OC' : 'Nova Ordem de Compra'}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
              data-permission="Compras.OrdemCompra.criar"
              data-action="Compras.OrdemCompra.formularioLegado"
              data-context-required="group-or-company"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="numero_oc">Número da OC *</Label>
                  <Input
                    id="numero_oc"
                    value={formData.numero_oc}
                    onChange={(e) => setFormData({...formData, numero_oc: e.target.value})}
                    required
                    data-permission="Compras.OrdemCompra.criar"
                    data-action="Compras.OrdemCompra.numero"
                    data-context-required="group-or-company"
                  />
                </div>
                <div>
                  <Label htmlFor="fornecedor">Fornecedor *</Label>
                  <Select
                    value={formData.fornecedor_id}
                    onValueChange={(value) => setFormData({...formData, fornecedor_id: value})}
                  >
                    <SelectTrigger
                      data-permission="Compras.OrdemCompra.criar"
                      data-action="Compras.OrdemCompra.fornecedor"
                      data-context-required="group-or-company"
                    >
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {fornecedores.filter(f => f.status === 'Ativo').map(fornecedor => (
                        <SelectItem key={fornecedor.id} value={fornecedor.id}>
                          {fornecedor.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="data_solicitacao">Data Solicitação *</Label>
                  <Input
                    id="data_solicitacao"
                    type="date"
                    value={formData.data_solicitacao}
                    onChange={(e) => setFormData({...formData, data_solicitacao: e.target.value})}
                    required
                    data-permission="Compras.OrdemCompra.criar"
                    data-action="Compras.OrdemCompra.dataSolicitacao"
                    data-context-required="group-or-company"
                  />
                </div>
                <div>
                  <Label htmlFor="data_entrega_prevista">Entrega Prevista</Label>
                  <Input
                    id="data_entrega_prevista"
                    type="date"
                    value={formData.data_entrega_prevista}
                    onChange={(e) => setFormData({...formData, data_entrega_prevista: e.target.value})}
                    data-permission="Compras.OrdemCompra.criar"
                    data-action="Compras.OrdemCompra.entregaPrevista"
                    data-context-required="group-or-company"
                  />
                </div>
                <div>
                  <Label htmlFor="valor_total">Valor Total *</Label>
                  <Input
                    id="valor_total"
                    type="number"
                    step="0.01"
                    value={formData.valor_total}
                    onChange={(e) => setFormData({...formData, valor_total: e.target.value})}
                    required
                    data-permission="Compras.OrdemCompra.criar"
                    data-action="Compras.OrdemCompra.valorTotal"
                    data-context-required="group-or-company"
                    data-sensitive="true"
                  />
                </div>
                <div>
                  <Label htmlFor="prazo_entrega">Prazo Entrega (dias)</Label>
                  <Input
                    id="prazo_entrega"
                    type="number"
                    value={formData.prazo_entrega_acordado}
                    onChange={(e) => setFormData({...formData, prazo_entrega_acordado: e.target.value})}
                    data-permission="Compras.OrdemCompra.criar"
                    data-action="Compras.OrdemCompra.prazoEntrega"
                    data-context-required="group-or-company"
                  />
                </div>
                <div>
                  <Label htmlFor="condicao_pagamento">Condição Pagamento</Label>
                  <Select
                    value={formData.condicao_pagamento}
                    onValueChange={(value) => setFormData({...formData, condicao_pagamento: value})}
                  >
                    <SelectTrigger
                      data-permission="Compras.OrdemCompra.criar"
                      data-action="Compras.OrdemCompra.condicaoPagamento"
                      data-context-required="group-or-company"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="À Vista">À Vista</SelectItem>
                      <SelectItem value="30 dias">30 dias</SelectItem>
                      <SelectItem value="60 dias">60 dias</SelectItem>
                      <SelectItem value="90 dias">90 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="forma_pagamento">Forma Pagamento</Label>
                  <Select
                    value={formData.forma_pagamento}
                    onValueChange={(value) => setFormData({...formData, forma_pagamento: value})}
                  >
                    <SelectTrigger
                      data-permission="Compras.OrdemCompra.criar"
                      data-action="Compras.OrdemCompra.formaPagamento"
                      data-context-required="group-or-company"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Boleto">Boleto</SelectItem>
                      <SelectItem value="Transferência">Transferência</SelectItem>
                      <SelectItem value="Cartão">Cartão</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                    rows={3}
                    data-permission="Compras.OrdemCompra.criar"
                    data-action="Compras.OrdemCompra.observacoes"
                    data-context-required="group-or-company"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-permission="Compras.OrdemCompra.criar"
                  data-action="Compras.OrdemCompra.cancelar"
                  data-context-required="group-or-company"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  data-permission="Compras.OrdemCompra.criar"
                  data-action="Compras.OrdemCompra.confirmar"
                  data-context-required="group-or-company"
                  data-sensitive="true"
                >
                  {editingOC ? 'Atualizar' : 'Criar'} OC
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

      <Card className="border-0 shadow-sm">
        <OCSelecionadasBar
          selectedCount={selectedOCs.length}
          onExportCSV={() => exportarOCsCSV(filteredOCs.filter(o => selectedOCs.includes(o.id)))}
          onClear={() => setSelectedOCs([])}
        />
        <CardContent className="p-0">
          <OCTabela
            ocs={filteredOCs}
            selectedOCs={selectedOCs}
            onToggleOC={toggleOC}
            onSort={(field) => { setSortField(field); setSortDirection(prev => (sortField===field && prev==='asc')?'desc':'asc'); }}
            statusColors={statusColors}
            onImprimir={(oc)=>{ const empresa = empresas?.find(e => e.id === oc.empresa_id); const fornecedor = fornecedores?.find(f => f.id === oc.fornecedor_id); ImprimirOrdemCompra({ oc, empresa, fornecedor }); }}
            onVer={(oc)=> openWindow(OrdemCompraForm, { ordemCompra: oc, windowMode: true, onSubmit: async (data) => { try { await updateMutation.mutateAsync({ id: oc.id, data }); sonnerToast.success('✅ OC atualizada!'); } catch { sonnerToast.error('Erro ao atualizar OC'); } } }, { title: `👁️ Ver: ${oc.numero_oc}`, width: 1100, height: 700 })}
            onEditar={handleEdit}
            onAprovar={(oc)=> { if (!contextoValido || !canApproveOC) { toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de aprovar' : 'Sem permissao para aprovar', variant: 'destructive' }); return; } if (!window.confirm(`Confirma aprovar a OC ${oc.numero_oc}?`)) { auditOrdemCompra({ acao: 'OrdemCompra.aprovacao_cancelada', sucesso: false, motivo: 'confirmacao_cancelada', dados: { ordem_compra_id: oc.id, numero_oc: oc.numero_oc } }); return; } aprovarMutation.mutate({ id: oc.id, oc }); }}
            onEnviar={(oc)=> { if (!contextoValido || !canSendOC) { toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de enviar' : 'Sem permissao para enviar', variant: 'destructive' }); return; } if (!window.confirm(`Confirma enviar a OC ${oc.numero_oc} ao fornecedor?`)) { auditOrdemCompra({ acao: 'OrdemCompra.envio_cancelado', sucesso: false, motivo: 'confirmacao_cancelada', dados: { ordem_compra_id: oc.id, numero_oc: oc.numero_oc } }); return; } enviarFornecedorMutation.mutate({ id: oc.id, oc }); }}
            onReceber={handleReceberClick}
            onAvaliar={(oc)=> { if (!contextoValido || !canEvaluateSupplier) { toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de avaliar' : 'Sem permissao para avaliar', variant: 'destructive' }); return; } openWindow(AvaliacaoFornecedorForm, { ordemCompra: oc, windowMode: true, onSubmit: async (avaliacao) => { try { await avaliarFornecedorMutation.mutateAsync({ oc, avaliacao }); sonnerToast.success('⭐ Avaliação registrada!'); } catch { sonnerToast.error('Erro ao avaliar fornecedor'); } } }, { title: `⭐ Avaliar: ${oc.fornecedor_nome}`, width: 800, height: 650 }); }}
          />

          <OCPaginacao
            page={page}
            pageSize={pageSize}
            setPage={setPage}
            setPageSize={setPageSize}
            hasNext={ocBackend.length >= pageSize}
          />

          {filteredOCs.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-slate-500">Nenhuma ordem de compra encontrada</p>
            </div>
          )}
          </CardContent>
        </Card>

        {/* DIALOGS REMOVIDOS - Agora usam Windows */}
      </div>
  );

  if (windowMode) {
    return <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-cyan-50 overflow-auto p-1.5">{content}</div>;
  }

  return content;
}
