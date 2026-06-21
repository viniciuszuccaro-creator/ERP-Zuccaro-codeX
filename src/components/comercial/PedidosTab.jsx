import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import BadgeOrigemPedido from "./BadgeOrigemPedido";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


import { 
  Plus, 
  Edit2, 
  FileText, 
  Truck, 
  CheckCircle2, 
  Factory, 
  Eye, 
  Trash2,
  ShieldCheck,
  AlertCircle,
  Clock,
  XCircle,
  Printer,
  Download,
  MoreVertical
 } from "lucide-react";
import ERPDataTable from "@/components/ui/erp/DataTable";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ImprimirPedido } from "@/components/lib/impressao";
import { useToast } from "@/components/ui/use-toast";

import SearchInput from "../ui/SearchInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWindow } from "@/components/lib/useWindow";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import CentralAprovacoesManager from "./CentralAprovacoesManager";
import usePermissions from "@/components/lib/usePermissions";
import useEntityListSorted from "@/components/lib/useEntityListSorted";
import usePersistedSort from "@/components/lib/usePersistedSort";
import AutomacaoFluxoPedido from "./AutomacaoFluxoPedido";
import useBackendPagination from "@/components/lib/useBackendPagination";
import { ProtectedAction } from "@/components/ProtectedAction";

export default function PedidosTab({ pedidos, clientes, isLoading, empresas, onCreatePedido, onEditPedido, empresaId = null }) {
  const { user } = useUser();
  const { canEdit, canCreate, canApprove, canDelete, hasPermission } = usePermissions();
  const { openWindow, closeWindow } = useWindow();
  const { empresaAtual, grupoAtual, updateInContext, deleteInContext, createInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaContextoId = empresaId || empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaContextoId);
  const canViewPedido = hasPermission('Comercial', 'Pedido', 'visualizar') || hasPermission('Comercial', 'Pedidos', 'visualizar') || hasPermission('Comercial', null, 'visualizar');
  const canCreatePedido = canCreate('Comercial', 'Pedido') || canCreate('Comercial', 'Pedidos') || hasPermission('Comercial', null, 'criar');
  const canEditPedido = canEdit('Comercial', 'Pedido') || canEdit('Comercial', 'Pedidos') || hasPermission('Comercial', null, 'editar');
  const canApprovePedido = (canApprove && canApprove('Comercial', 'Pedido')) || hasPermission('Comercial', 'Pedido', 'aprovar') || hasPermission('Comercial', null, 'aprovar');
  const canDeletePedido = canDelete('Comercial', 'Pedido') || canDelete('Comercial', 'Pedidos') || hasPermission('Comercial', null, 'excluir');
  const canPrintPedido = hasPermission('Comercial', 'Pedido', 'imprimir') || hasPermission('Comercial', 'Pedidos', 'imprimir') || hasPermission('Comercial', null, 'exportar');
  const canExportPedido = hasPermission('Comercial', 'Pedido', 'exportar') || hasPermission('Comercial', 'Pedidos', 'exportar') || hasPermission('Comercial', null, 'exportar');
  const canNotifyPedido = hasPermission('Comercial', 'Pedido', 'notificar') || hasPermission('Comercial', 'Pedidos', 'notificar') || hasPermission('Comercial', null, 'notificar') || canApprovePedido;
  const canMarcarProntoFaturar = hasPermission('Comercial', 'Pedido', 'marcarProntoFaturar') || canEditPedido;
  const canFecharPedido = hasPermission('Comercial', 'Pedido', 'fechar') || hasPermission('Comercial', 'Pedidos', 'fechar') || canEditPedido;
  const canGerarNFe = hasPermission('Comercial', 'Pedido', 'gerarNFe') || hasPermission('Fiscal', 'NotaFiscal', 'criar') || hasPermission('Fiscal', null, 'criar');
  const canCriarEntrega = hasPermission('Comercial', 'Pedido', 'criarEntrega') || hasPermission('ExpediÃ§Ã£o', 'Entrega', 'criar') || hasPermission('ExpediÃ§Ã£o', null, 'criar');
  const canGerarOP = hasPermission('Comercial', 'Pedido', 'gerarOP') || hasPermission('ProduÃ§Ã£o', 'OrdemProducao', 'criar') || hasPermission('ProduÃ§Ã£o', null, 'criar');
  const { page, setPage, pageSize, setPageSize } = useBackendPagination('Pedido', 20);
  const [sortField, setSortField, sortDirection, setSortDirection] = usePersistedSort('Pedido', 'data_pedido', 'desc');

  // persistÃªncia de sort movida para usePersistedSort

  const { data: pedidosBackend = [] } = useEntityListSorted('Pedido', {}, { sortField, sortDirection, page, pageSize, limit: pageSize, campo: 'empresa_id', enabled: contextoValido && canViewPedido });
  const pedidosList = Array.isArray(pedidos) && pedidos.length ? pedidos : pedidosBackend;
  // V21.6: Multi-empresa
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auditPedido = async ({ acao, pedido = null, descricao, sucesso = true, detalhes = {} }) => {
    try {
      await createInContext("AuditLog", {
        usuario: user?.full_name || user?.email || 'Sistema',
        usuario_id: user?.id || null,
        acao,
        modulo: 'Comercial',
        entidade: 'Pedido',
        registro_id: pedido?.id || detalhes?.pedido_id || null,
        descricao,
        empresa_id: pedido?.empresa_id || empresaContextoId,
        group_id: pedido?.group_id || pedido?.grupo_id || groupId,
        grupo_id: pedido?.grupo_id || pedido?.group_id || groupId,
        tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
        sucesso,
        detalhes: {
          origem: 'PedidosTab',
          numero_pedido: pedido?.numero_pedido,
          status_anterior: pedido?.status,
          status_aprovacao_anterior: pedido?.status_aprovacao,
          ...detalhes
        },
        data_hora: new Date().toISOString()
      });
    } catch (_) {}
  };

  // SeleÃ§Ã£o em massa + exportaÃ§Ã£o
  const [selectedPedidos, setSelectedPedidos] = useState([]);
  const togglePedido = (id) => setSelectedPedidos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAllPedidos = (checked, lista) => setSelectedPedidos(checked ? lista.map(p => p.id) : []);
  const exportarPedidosCSV = (lista) => {
    const headers = ['numero_pedido','cliente_nome','empresa_id','data_pedido','valor_total','status','status_aprovacao'];
    const csv = [
      headers.join(','),
      ...lista.map(p => headers.map(h => JSON.stringify(p[h] ?? '')).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedidos_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteMutation = useMutation({
    mutationFn: async (pedido) => {
      if (!contextoValido || !canDeletePedido) {
        await auditPedido({
          acao: 'Exclusao bloqueada',
          pedido,
          descricao: !contextoValido ? 'Exclusao de pedido bloqueada por falta de contexto' : 'Exclusao de pedido bloqueada por RBAC',
          sucesso: false,
          detalhes: { motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada' }
        });
        throw new Error(!contextoValido ? 'Selecione grupo ou empresa antes de excluir.' : 'Sem permissao para excluir pedido.');
      }
      await auditPedido({
        acao: 'Exclusao solicitada',
        pedido,
        descricao: 'Exclusao solicitada via UI',
        detalhes: { dados_anteriores: pedido }
      });
      return deleteInContext('Pedido', pedido.id);
    },
    onSuccess: async (_data, pedido) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      await auditPedido({ acao: 'Exclusao', pedido, descricao: 'Pedido excluido', detalhes: { dados_anteriores: pedido } });
      toast({ title: 'Pedido excluido!' });
    },
    onError: (error) => {
      toast({ title: error.message || 'Falha ao excluir pedido', variant: 'destructive' });
    },
  });

  const solicitarExclusaoPedido = (pedido) => {
    if (!confirm('Excluir pedido?')) return;
    deleteMutation.mutate(pedido);
  };

  const executarAcaoSensivelPedido = async ({ pedido, permitido, acao, descricao, toastTitle }) => {
    if (!contextoValido || !permitido) {
      await auditPedido({
        acao: `${acao} bloqueada`,
        pedido,
        descricao: !contextoValido ? `${descricao} bloqueada por falta de contexto` : `${descricao} bloqueada por RBAC`,
        sucesso: false,
        detalhes: { motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada' }
      });
      toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de continuar' : 'Sem permissao para executar esta acao', variant: 'destructive' });
      return;
    }
    toast({ title: toastTitle });
    await auditPedido({ acao, pedido, descricao, detalhes: { status: pedido?.status } });
  };

  const visualizarPedidoSeguro = async (pedido) => {
    if (!contextoValido || !canViewPedido) {
      await auditPedido({
        acao: 'Visualizacao bloqueada',
        pedido,
        descricao: !contextoValido ? 'Visualizacao de pedido bloqueada por falta de contexto' : 'Visualizacao de pedido bloqueada por RBAC',
        sucesso: false,
        detalhes: { motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada' }
      });
      toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de visualizar' : 'Sem permissao para visualizar pedido', variant: 'destructive' });
      return;
    }
    await auditPedido({ acao: 'Visualizacao', pedido, descricao: 'Abrir visualizacao do pedido' });
    onEditPedido(pedido);
  };

  const imprimirPedidoSeguro = async (pedido) => {
    if (!contextoValido || !canPrintPedido) {
      await auditPedido({
        acao: 'Impressao bloqueada',
        pedido,
        descricao: !contextoValido ? 'Impressao de pedido bloqueada por falta de contexto' : 'Impressao de pedido bloqueada por RBAC',
        sucesso: false,
        detalhes: { motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada' }
      });
      toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de imprimir' : 'Sem permissao para imprimir pedido', variant: 'destructive' });
      return;
    }
    const empresa = empresas?.find(e => e.id === pedido.empresa_id);
    await auditPedido({ acao: 'Impressao', pedido, descricao: 'Imprimir pedido' });
    ImprimirPedido({ pedido, empresa });
  };

  const exportarPedidosSeguro = async (lista) => {
    if (!contextoValido || !canExportPedido) {
      await auditPedido({
        acao: 'Exportacao bloqueada',
        descricao: !contextoValido ? 'Exportacao de pedidos bloqueada por falta de contexto' : 'Exportacao de pedidos bloqueada por RBAC',
        sucesso: false,
        detalhes: { motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada', total: lista.length }
      });
      toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de exportar' : 'Sem permissao para exportar pedidos', variant: 'destructive' });
      return;
    }
    exportarPedidosCSV(lista);
    await auditPedido({ acao: 'Exportacao', descricao: `Exportados ${lista.length} pedidos`, detalhes: { total: lista.length } });
  };

  const editarPedidoSeguro = async (pedido) => {
    const bloqueadoPorAprovacao = pedido.status_aprovacao === 'pendente' && !canApprovePedido;
    if (!contextoValido || !canEditPedido || bloqueadoPorAprovacao) {
      await auditPedido({
        acao: 'Edicao bloqueada',
        pedido,
        descricao: !contextoValido ? 'Edicao de pedido bloqueada por falta de contexto' : 'Edicao de pedido bloqueada por RBAC ou aprovacao pendente',
        sucesso: false,
        detalhes: { motivo: !contextoValido ? 'contexto_obrigatorio' : bloqueadoPorAprovacao ? 'aprovacao_pendente' : 'permissao_negada' }
      });
      toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de editar' : 'Sem permissao para editar este pedido', variant: 'destructive' });
      return;
    }
    await auditPedido({ acao: 'Edicao', pedido, descricao: 'Abrir editor de pedido' });
    onEditPedido(pedido);
  };

  const marcarProntoParaFaturarSeguro = async (pedido) => {
    if (!contextoValido || !canMarcarProntoFaturar) {
      await auditPedido({
        acao: 'Alteracao de status bloqueada',
        pedido,
        descricao: !contextoValido ? 'Mudanca para Pronto para Faturar bloqueada por falta de contexto' : 'Mudanca para Pronto para Faturar bloqueada por RBAC',
        sucesso: false,
        detalhes: { motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada', status_anterior: pedido?.status, status_novo: 'Pronto para Faturar' }
      });
      toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de alterar o status' : 'Sem permissao para alterar o status', variant: 'destructive' });
      return;
    }
    try {
      await updateInContext('Pedido', pedido.id, { status: 'Pronto para Faturar' });
      toast({ title: 'Pedido fechado para entrega!' });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      await auditPedido({ acao: 'Alteracao de status', pedido, descricao: 'Status alterado para Pronto para Faturar', detalhes: { status_anterior: pedido?.status, status_novo: 'Pronto para Faturar' } });
    } catch {
      await auditPedido({ acao: 'Alteracao de status falhou', pedido, descricao: 'Falha ao alterar status para Pronto para Faturar', sucesso: false, detalhes: { status_anterior: pedido?.status, status_novo: 'Pronto para Faturar' } });
      toast({ title: 'Erro ao fechar pedido', variant: 'destructive' });
    }
  };

  const analisarAprovacaoSeguro = async (pedido) => {
    if (!contextoValido || !canApprovePedido) {
      await auditPedido({
        acao: 'Analise de aprovacao bloqueada',
        pedido,
        descricao: !contextoValido ? 'Abertura da Central de Aprovacoes bloqueada por falta de contexto' : 'Abertura da Central de Aprovacoes bloqueada por RBAC',
        sucesso: false,
        detalhes: { motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada' }
      });
      toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de analisar' : 'Sem permissao para analisar aprovacao', variant: 'destructive' });
      return;
    }
    await auditPedido({ acao: 'Analise de aprovacao', pedido, descricao: 'Abrir Central de Aprovacoes' });
    openWindow(CentralAprovacoesManager, { windowMode: true, initialTab: 'descontos' }, { title: 'Central de Aprovações', width: 1200, height: 700 });
  };

  const abrirAutomacaoFechamentoSeguro = async (pedido) => {
    if (!contextoValido || !canFecharPedido) {
      await auditPedido({
        acao: 'Fechamento bloqueado',
        pedido,
        descricao: !contextoValido ? 'Automacao de fechamento bloqueada por falta de contexto' : 'Automacao de fechamento bloqueada por RBAC',
        sucesso: false,
        detalhes: { motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada', status: pedido?.status }
      });
      toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de fechar o pedido' : 'Sem permissao para fechar pedido', variant: 'destructive' });
      return;
    }
    await auditPedido({ acao: 'Fechamento iniciado', pedido, descricao: 'Abrir automacao de fechamento do pedido', detalhes: { status: pedido?.status } });
    openWindow(
      AutomacaoFluxoPedido,
      {
        pedido,
        empresaId: pedido.empresa_id,
        windowMode: true,
        onComplete: async () => {
          queryClient.invalidateQueries({ queryKey: ['pedidos'] });
          queryClient.invalidateQueries({ queryKey: ['produtos'] });
          queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
          queryClient.invalidateQueries({ queryKey: ['contas-receber'] });
          queryClient.invalidateQueries({ queryKey: ['entregas'] });
          await auditPedido({ acao: 'Fechamento concluido', pedido, descricao: 'Automacao de fechamento concluida', detalhes: { status_anterior: pedido?.status } });
          toast({ title: 'Pedido fechado com sucesso!' });
        }
      },
      { title: `Automacao - Pedido ${pedido.numero_pedido}`, width: 1200, height: 700 }
    );
  };

  const criarPedidoSeguro = async () => {
    if (!contextoValido || !canCreatePedido) {
      await auditPedido({
        acao: 'Criacao bloqueada',
        descricao: !contextoValido ? 'Criacao de pedido bloqueada por falta de contexto' : 'Criacao de pedido bloqueada por RBAC',
        sucesso: false,
        detalhes: { motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada' }
      });
      toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de criar pedido' : 'Sem permissao para criar pedido', variant: 'destructive' });
      return;
    }
    await auditPedido({ acao: 'Criacao iniciada', descricao: 'Abrir formulario de novo pedido' });
    onCreatePedido();
  };

  const filteredPedidos = pedidosList.filter(p => {
    const matchStatus = statusFilter === "todos" || p.status === statusFilter;
    const searchLower = searchTerm.toLowerCase();
    const matchSearch = 
      p.numero_pedido?.toLowerCase().includes(searchLower) ||
      p.cliente_nome?.toLowerCase().includes(searchLower) ||
      p.vendedor?.toLowerCase().includes(searchLower) ||
      p.tipo_pedido?.toLowerCase().includes(searchLower) ||
      p.origem_pedido?.toLowerCase().includes(searchLower) ||
      p.status?.toLowerCase().includes(searchLower) ||
      p.observacoes_publicas?.toLowerCase().includes(searchLower) ||
      p.observacoes_internas?.toLowerCase().includes(searchLower) ||
      p.indicador_nome?.toLowerCase().includes(searchLower) ||
      p.obra_destino_nome?.toLowerCase().includes(searchLower);
    const matchEmpresa = !empresaId || p.empresa_id === empresaId;
    return matchStatus && matchSearch && matchEmpresa;
  });

  // ETAPA 4: EstatÃ­sticas de aprovaÃ§Ã£o
  const pedidosPendentesAprovacao = pedidosList.filter(p => p.status_aprovacao === "pendente");
  const pedidosAprovados = pedidosList.filter(p => p.status_aprovacao === "aprovado");
  const pedidosNegados = pedidosList.filter(p => p.status_aprovacao === "negado");

  // SeleÃ§Ã£o padronizada (todos os registros visÃ­veis)
  const allSelected = React.useMemo(() => selectedPedidos.length === filteredPedidos.length && filteredPedidos.length > 0, [selectedPedidos, filteredPedidos]);
  const onToggleSelectAll = () => {
    if (!allSelected) setSelectedPedidos(filteredPedidos.map(p => p.id));
    else setSelectedPedidos([]);
  };

  const notifyWhatsAppPendentes = async (ids) => {
    const alvo = (Array.isArray(ids) && ids.length ? ids : pedidosPendentesAprovacao.map(p=>p.id)).slice(0,50);
    if (!alvo.length) { toast({ title: 'Sem pendentes selecionados' }); return; }
    if (!contextoValido || !canNotifyPedido) {
      await auditPedido({
        acao: 'Notificacao bloqueada',
        descricao: !contextoValido ? 'WhatsApp de aprovacao bloqueado por falta de contexto' : 'WhatsApp de aprovacao bloqueado por RBAC',
        sucesso: false,
        detalhes: { canal: 'whatsapp', pedido_ids: alvo, motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada' }
      });
      toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de notificar' : 'Sem permissao para notificar pedidos', variant: 'destructive' });
      return;
    }
    try {
      await base44.functions.invoke('whatsappSend', { template: 'aprovacao_pendente', pedido_ids: alvo });
      toast({ title: 'ðŸ“² WhatsApp enviado', description: `${alvo.length} pedido(s)` });
      await auditPedido({ acao: 'Notificacao', descricao: `WhatsApp aprovacao pendente (${alvo.length})`, detalhes: { canal: 'whatsapp', pedido_ids: alvo, total: alvo.length } });
    } catch {
      await auditPedido({ acao: 'Notificacao falhou', descricao: 'Falha ao notificar aprovacao pendente por WhatsApp', sucesso: false, detalhes: { canal: 'whatsapp', pedido_ids: alvo, total: alvo.length } });
      toast({ title: 'Falha ao notificar WhatsApp', variant: 'destructive' });
    }
  };
  const notifyEmailPendentes = async (ids) => {
    const alvo = (Array.isArray(ids) && ids.length ? ids : pedidosPendentesAprovacao.map(p=>p.id)).slice(0,50);
    if (!alvo.length) { toast({ title: 'Sem pendentes selecionados' }); return; }
    if (!contextoValido || !canNotifyPedido) {
      await auditPedido({
        acao: 'Notificacao bloqueada',
        descricao: !contextoValido ? 'Email de aprovacao bloqueado por falta de contexto' : 'Email de aprovacao bloqueado por RBAC',
        sucesso: false,
        detalhes: { canal: 'email', pedido_ids: alvo, motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada' }
      });
      toast({ title: !contextoValido ? 'Selecione grupo ou empresa antes de notificar' : 'Sem permissao para notificar pedidos', variant: 'destructive' });
      return;
    }
    try {
      await base44.functions.invoke('sendEmailProvider', { tipo: 'aprovacao_pendente', pedido_ids: alvo });
      toast({ title: 'âœ‰ï¸ E-mails enviados', description: `${alvo.length} pedido(s)` });
      await auditPedido({ acao: 'Notificacao', descricao: `Email aprovacao pendente (${alvo.length})`, detalhes: { canal: 'email', pedido_ids: alvo, total: alvo.length } });
    } catch {
      await auditPedido({ acao: 'Notificacao falhou', descricao: 'Falha ao notificar aprovacao pendente por email', sucesso: false, detalhes: { canal: 'email', pedido_ids: alvo, total: alvo.length } });
      toast({ title: 'Falha ao notificar por email', variant: 'destructive' });
    }
  };

  const columns = React.useMemo(() => ([
    { key: 'numero_pedido', label: 'NÂ° Pedido', render: (r) => <span className="font-semibold">{r.numero_pedido}</span> },
    { key: 'cliente_nome', label: 'Cliente' },
    { key: 'data_pedido', label: 'Data', render: (r) => new Date(r.data_pedido).toLocaleDateString('pt-BR') },
    { key: 'origem_pedido', label: 'Origem', render: (r) => <BadgeOrigemPedido origemPedido={r.origem_pedido} showLock={true} /> },
    { key: 'valor_total', label: 'Valor', isNumeric: true, render: (r) => <span className="font-bold text-green-600">R$ {(r.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> },
    { key: 'status', label: 'Status', render: (r) => (
      <Badge className={
        r.status === 'Entregue' ? 'bg-green-600 text-white' :
        r.status === 'Em TrÃ¢nsito' ? 'bg-purple-600 text-white' :
        r.status === 'Em ExpediÃ§Ã£o' ? 'bg-orange-600 text-white' :
        r.status === 'Faturado' ? 'bg-blue-600 text-white' :
        r.status === 'Pronto para Faturar' ? 'bg-indigo-600 text-white' :
        r.status === 'Aprovado' ? 'bg-green-500 text-white' :
        r.status === 'Aguardando AprovaÃ§Ã£o' ? 'bg-yellow-500 text-white' :
        r.status === 'Cancelado' ? 'bg-red-600 text-white' :
        'bg-slate-500 text-white'
      }>
        {r.status}
      </Badge>
    ) },
    { key: 'aprovacao', label: 'AprovaÃ§Ã£o', render: (r) => (
      r.status_aprovacao === 'pendente' ? (
        <Badge className="bg-orange-100 text-orange-700"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>
      ) : r.status_aprovacao === 'aprovado' ? (
        <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" />Aprovado</Badge>
      ) : r.status_aprovacao === 'negado' ? (
        <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Negado</Badge>
      ) : (
        <Badge variant="outline" className="text-xs">-</Badge>
      )
    ) },
    { key: 'actions', label: 'AÃ§Ãµes RÃ¡pidas', render: (pedido) => (
      <div className="flex items-center gap-1">
        {pedido.status === 'Rascunho' && (
          <Button 
            variant="ghost" size="sm"
            data-permission="Comercial.Pedido.fechar"
            data-sensitive
            onClick={() => abrirAutomacaoFechamentoSeguro(pedido)}
            disabled={!contextoValido || !canFecharPedido}
            className="h-8 px-2 bg-gradient-to-r from-green-600 to-blue-600 text-white hover:from-green-700 hover:to-blue-700 font-semibold shadow-lg"
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            <span className="text-xs">ðŸš€ Fechar Pedido</span>
          </Button>
        )}

        <Button
           variant="ghost"
           size="sm"
           data-permission="Comercial.Pedido.editar"
           data-sensitive
           disabled={!contextoValido || !canEditPedido || (pedido.status_aprovacao === 'pendente' && !canApprovePedido)}
           onClick={() => editarPedidoSeguro(pedido)}
           title={pedido.status_aprovacao === 'pendente' ? 'EdiÃ§Ã£o bloqueada atÃ© aprovaÃ§Ã£o' : 'Editar Pedido'}
           className="h-8 px-2"
         >
          <Edit2 className="w-3 h-3 mr-1" />
          <span className="text-xs">Editar</span>
        </Button>

        {pedido.status === 'Aprovado' && (
          <>
            <Button 
               variant="ghost" size="sm"
               data-permission="Comercial.Pedido.marcarProntoFaturar"
               onClick={() => marcarProntoParaFaturarSeguro(pedido)}
              disabled={!contextoValido || !canMarcarProntoFaturar}
              className="h-8 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold border border-blue-200"
            >
              <Truck className="w-4 h-4 mr-1" />
              <span className="text-xs">ðŸšš Fechar p/ Entrega</span>
            </Button>
            <Button variant="ghost" size="sm" data-permission="Comercial.Pedido.gerarNFe" data-sensitive onClick={() => executarAcaoSensivelPedido({ pedido, permitido: canGerarNFe, acao: 'Emissao NF-e', descricao: 'Acionada geracao de NF-e', toastTitle: 'Gerando NF-e...' })} disabled={!contextoValido || !canGerarNFe} title="Gerar NF-e" className="h-8 px-2 text-green-600">
              <FileText className="w-3 h-3 mr-1" />
              <span className="text-xs">NF-e</span>
            </Button>
          </>
        )}

        {pedido.status === 'Pronto para Faturar' && (
          <Button variant="ghost" size="sm" data-permission="Comercial.Pedido.gerarNFe" data-sensitive onClick={() => executarAcaoSensivelPedido({ pedido, permitido: canGerarNFe, acao: 'Emissao NF-e', descricao: 'Acionada geracao de NF-e', toastTitle: 'Gerando NF-e...' })} disabled={!contextoValido || !canGerarNFe} title="Gerar NF-e" className="h-8 px-2 text-green-600">
            <FileText className="w-3 h-3 mr-1" />
            <span className="text-xs">NF-e</span>
          </Button>
        )}

        {pedido.status === 'Faturado' && (
          <Button variant="ghost" size="sm" data-permission="Comercial.Pedido.criarEntrega" data-sensitive onClick={() => executarAcaoSensivelPedido({ pedido, permitido: canCriarEntrega, acao: 'Criacao Entrega', descricao: 'Acionada criacao de entrega', toastTitle: 'Criando entrega...' })} disabled={!contextoValido || !canCriarEntrega} title="Criar Entrega" className="h-8 px-2 text-blue-600">
            <Truck className="w-3 h-3 mr-1" />
            <span className="text-xs">Entrega</span>
          </Button>
        )}

        {(pedido.tipo_pedido === 'ProduÃ§Ã£o Sob Medida' || pedido.itens_corte_dobra?.length > 0 || pedido.itens_armado_padrao?.length > 0) && pedido.status !== 'Cancelado' && (
          <Button variant="ghost" size="sm" data-permission="Comercial.Pedido.gerarOP" data-sensitive onClick={() => executarAcaoSensivelPedido({ pedido, permitido: canGerarOP, acao: 'Gerar OP', descricao: 'Acionada geracao de OP', toastTitle: 'Criando OP...' })} disabled={!contextoValido || !canGerarOP} title="Gerar Ordem de Produção" className="h-8 px-2 text-purple-600">
            <Factory className="w-3 h-3 mr-1" />
            <span className="text-xs">OP</span>
          </Button>
        )}

        <Button variant="ghost" size="sm" data-permission="Comercial.Pedido.imprimir" onClick={() => imprimirPedidoSeguro(pedido)} disabled={!contextoValido || !canPrintPedido} title="Imprimir Pedido" className="h-8 px-2 text-slate-600">
          <Printer className="w-3 h-3 mr-1" />
          <span className="text-xs">Imprimir</span>
        </Button>

        <Button variant="ghost" size="sm" data-permission="Comercial.Pedido.visualizar" onClick={() => visualizarPedidoSeguro(pedido)} disabled={!contextoValido || !canViewPedido} title="Visualizar" className="h-8 px-2">
          <Eye className="w-3 h-3 mr-1" />
          <span className="text-xs">Ver</span>
        </Button>

        {pedido.status_aprovacao === 'pendente' && (
          <Button variant="ghost" size="sm" data-permission="Comercial.Pedido.aprovar" data-sensitive onClick={() => analisarAprovacaoSeguro(pedido)} disabled={!contextoValido || !canApprovePedido} title="Analisar AprovaÃ§Ã£o" className="h-8 px-2 text-orange-600 animate-pulse">
            <ShieldCheck className="w-3 h-3 mr-1" />
            <span className="text-xs">Analisar</span>
          </Button>
        )}

        <Button variant="ghost" size="sm" data-permission="Comercial.Pedido.excluir" data-sensitive onClick={() => solicitarExclusaoPedido(pedido)} disabled={!contextoValido || !canDeletePedido || deleteMutation.isPending} title="Excluir" className="h-8 px-2 text-red-600">
          <Trash2 className="w-3 h-3 mr-1" />
          <span className="text-xs">Excluir</span>
        </Button>
      </div>
    )}
]), [queryClient, toast, contextoValido, canEditPedido, canApprovePedido, canViewPedido, canPrintPedido, canDeletePedido, canFecharPedido, canMarcarProntoFaturar, canGerarNFe, canCriarEntrega, canGerarOP, deleteMutation.isPending, onEditPedido, empresas, openWindow, updateInContext]);

  const menuItems = (pedido) => {
    const items = [];
    if (contextoValido && canViewPedido) {
      items.push({ key: 'ver', label: 'Visualizar', action: async () => visualizarPedidoSeguro(pedido) });
    }
    if (contextoValido && canPrintPedido) {
      items.push({ key: 'imprimir', label: 'Imprimir', action: async () => imprimirPedidoSeguro(pedido) });
    }
    if (contextoValido && canGerarNFe && (pedido.status === 'Aprovado' || pedido.status === 'Pronto para Faturar')) {
      items.push({ key: 'nfe', label: 'Gerar NF-e', action: async () => executarAcaoSensivelPedido({ pedido, permitido: canGerarNFe, acao: 'Emissao NF-e', descricao: 'Acionada geracao de NF-e', toastTitle: 'Gerando NF-e...' }) });
    }
    if (contextoValido && canCriarEntrega && pedido.status === 'Faturado') {
      items.push({ key: 'entrega', label: 'Criar Entrega', action: async () => executarAcaoSensivelPedido({ pedido, permitido: canCriarEntrega, acao: 'Criacao Entrega', descricao: 'Acionada criacao de entrega', toastTitle: 'Criando entrega...' }) });
    }
    if (contextoValido && canGerarOP && (pedido.tipo_pedido === 'ProduÃ§Ã£o Sob Medida' || pedido.itens_corte_dobra?.length > 0 || pedido.itens_armado_padrao?.length > 0) && pedido.status !== 'Cancelado') {
      items.push({ key: 'op', label: 'Gerar OP', action: async () => executarAcaoSensivelPedido({ pedido, permitido: canGerarOP, acao: 'Gerar OP', descricao: 'Acionada geracao de OP', toastTitle: 'Criando OP...' }) });
    }
    if (contextoValido && canDeletePedido) {
      items.push({ key: 'excluir', label: 'Excluir', action: async () => solicitarExclusaoPedido(pedido) });
    }
    if (contextoValido && canApprovePedido && pedido.status_aprovacao === 'pendente') {
      items.push({ key: 'aprovar', label: 'Analisar AprovaÃ§Ã£o', action: async () => analisarAprovacaoSeguro(pedido) });
    }
    return items;
  };

  return (
    <div className="w-full h-full flex flex-col space-y-6">
      {/* ETAPA 4: ALERTA DE APROVAÃ‡Ã•ES PENDENTES */}
      {pedidosPendentesAprovacao.length > 0 && (
        <Alert className="border-orange-300 bg-orange-50">
          <AlertDescription className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-orange-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {pedidosPendentesAprovacao.length} pedido(s) aguardando aprovaÃ§Ã£o
                </p>
                <p className="text-xs text-orange-700 mt-1">
                Pedidos com descontos ou outras pendÃªncias financeiras aguardam sua anÃ¡lise.
                </p>
                </div>
                <Button
                data-permission="Comercial.Pedido.aprovar"
                data-sensitive
                onClick={() => analisarAprovacaoSeguro(null)}
                disabled={!contextoValido || !canApprovePedido}
                className="bg-orange-600 hover:bg-orange-600/90"
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              Gerenciar AprovaÃ§Ãµes
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Bloco Resumido de AprovaÃ§Ã£o + NotificaÃ§Ãµes */}
      {pedidosPendentesAprovacao.length > 0 && (
        <Card className="bg-white/60 backdrop-blur-md border-white/40 shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="text-sm text-slate-700">
              HÃ¡ <span className="font-semibold">{pedidosPendentesAprovacao.length}</span> pedido(s) aguardando aprovaÃ§Ã£o.
            </div>
            <div className="flex items-center gap-2">
              <Button data-permission="Comercial.Pedido.aprovar" data-sensitive onClick={() => analisarAprovacaoSeguro(null)} disabled={!contextoValido || !canApprovePedido} className="bg-orange-600 hover:bg-orange-600/90">
                Central de AprovaÃ§Ãµes
              </Button>
              <Button variant="outline" data-permission="Comercial.Pedido.notificar" onClick={() => notifyWhatsAppPendentes(selectedPedidos)} disabled={!contextoValido || !canNotifyPedido}>
                Notificar WhatsApp
              </Button>
              <Button variant="outline" data-permission="Comercial.Pedido.notificar" onClick={() => notifyEmailPendentes(selectedPedidos)} disabled={!contextoValido || !canNotifyPedido}>
                Notificar Email
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ESTATÃSTICAS DE APROVAÃ‡ÃƒO */}
      {(pedidosAprovados.length > 0 || pedidosNegados.length > 0 || pedidosPendentesAprovacao.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white/60 backdrop-blur-md border-white/40 shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700">Pendentes AprovaÃ§Ã£o</p>
                <p className="text-2xl font-bold text-orange-900">{pedidosPendentesAprovacao.length}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-400" />
            </CardContent>
          </Card>

          <Card className="bg-white/60 backdrop-blur-md border-white/40 shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Descontos Aprovados</p>
                <p className="text-2xl font-bold text-green-900">{pedidosAprovados.length}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </CardContent>
          </Card>

          <Card className="bg-white/60 backdrop-blur-md border-white/40 shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700">Descontos Negados</p>
                <p className="text-2xl font-bold text-red-900">{pedidosNegados.length}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Pedidos</h2>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={criarPedidoSeguro} data-permission="Comercial.Pedido.criar" data-sensitive disabled={!contextoValido || !canCreatePedido}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Pedido
        </Button>
      </div>

      <ResizablePanelGroup direction="vertical" className="w-full h-full">
        <ResizablePanel defaultSize={25} minSize={15}>
          <Card className="border-0 shadow-md rounded-sm">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <SearchInput
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Buscar por nÃºmero, cliente, vendedor, tipo, origem, status..."
                  className="flex-1"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent className="z-[99999]">
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="Rascunho">Rascunho</SelectItem>
                    <SelectItem value="Aguardando AprovaÃ§Ã£o">Aguardando AprovaÃ§Ã£o</SelectItem>
                    <SelectItem value="Aprovado">Aprovado</SelectItem>
                    <SelectItem value="Pronto para Faturar">Pronto para Faturar</SelectItem>
                    <SelectItem value="Faturado">Faturado</SelectItem>
                    <SelectItem value="Em ExpediÃ§Ã£o">Em ExpediÃ§Ã£o</SelectItem>
                    <SelectItem value="Entregue">Entregue</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={75} minSize={40}>
          <Card className="border-0 shadow-md rounded-sm h-full">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle>Lista de Pedidos ({filteredPedidos.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {selectedPedidos.length > 0 && (
            <Alert className="m-4 border-blue-300 bg-blue-50">
              <AlertDescription className="flex items-center justify-between">
                <div className="text-blue-900 font-semibold">{selectedPedidos.length} pedido(s) selecionado(s)</div>
                <div className="flex gap-2">
                  <ProtectedAction module="Comercial" section="Pedido" action="exportar" mode="disable">
                  <Button variant="outline" data-permission="Comercial.Pedido.exportar" onClick={() => exportarPedidosSeguro(filteredPedidos.filter(p => selectedPedidos.includes(p.id)))} disabled={!contextoValido || !canExportPedido}>
                    <Download className="w-4 h-4 mr-2" /> Exportar CSV
                  </Button>
                  </ProtectedAction>
                  <Button variant="outline" data-permission="Comercial.Pedido.notificar" onClick={() => notifyWhatsAppPendentes(selectedPedidos)} disabled={!contextoValido || !canNotifyPedido}>WhatsApp</Button>
                  <Button variant="outline" data-permission="Comercial.Pedido.notificar" onClick={() => notifyEmailPendentes(selectedPedidos)} disabled={!contextoValido || !canNotifyPedido}>Email</Button>
                  <Button variant="ghost" onClick={() => setSelectedPedidos([])}>Limpar SeleÃ§Ã£o</Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          <ERPDataTable
            columns={columns}
            data={filteredPedidos}
            entityName="Pedido"
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={(sf, sd) => { setSortField(sf); setSortDirection(sd); }}
            selectedIds={selectedPedidos}
            allSelected={allSelected}
            onToggleSelectAll={onToggleSelectAll}
            onToggleItem={(id) => togglePedido(id)}
            permission="Comercial.Pedido.visualizar"
            rowContextMenuItems={menuItems}
            page={page}
            pageSize={pageSize}
            totalItems={page * pageSize + (pedidosBackend.length < pageSize ? 0 : 1)}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          />

{/* paginaÃ§Ã£o integrada ao ERPDataTable */}

          {filteredPedidos.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhum pedido encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </ResizablePanel>
  </ResizablePanelGroup>
</div>
  );
}
