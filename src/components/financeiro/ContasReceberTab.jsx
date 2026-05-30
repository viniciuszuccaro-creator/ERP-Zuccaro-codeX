import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { ImprimirBoleto } from "@/components/lib/ImprimirBoleto";
import GerarCobrancaModal from "./GerarCobrancaModal";
import SimularPagamentoModal from "./SimularPagamentoModal";
import GerarLinkPagamentoModal from "./GerarLinkPagamentoModal";
import ContaReceberForm from "./ContaReceberForm";
import { useWindow } from "@/components/lib/useWindow";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useFormasPagamento } from "@/components/lib/useFormasPagamento";
import { useUser } from "@/components/lib/UserContext";
import usePermissions from "@/components/lib/usePermissions";
import HeaderReceberCompacto from "./contas-receber/HeaderReceberCompacto";
import KPIsReceber from "./contas-receber/KPIsReceber";
import FiltrosReceber from "./contas-receber/FiltrosReceber";
import TabelaReceber from "./contas-receber/TabelaReceber";
import useEntityListSorted from "@/components/lib/useEntityListSorted";
import useBackendPagination from "@/components/lib/useBackendPagination";
import usePersistedSort from "@/components/lib/usePersistedSort";

export default function ContasReceberTab({ contas, empresas = [], windowMode = false }) {
  const { createInContext, updateInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { page, setPage, pageSize, setPageSize } = useBackendPagination('ContaReceber', 20);
  const [sortField, setSortField, sortDirection, setSortDirection] = usePersistedSort('ContaReceber', 'data_vencimento', 'asc');

  // persistência de sort movida para usePersistedSort

  const { data: contasBackend = [] } = useEntityListSorted('ContaReceber', {}, { sortField, sortDirection, page, pageSize, limit: pageSize });
  const contasList = Array.isArray(contas) && contas.length ? contas : contasBackend;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { openWindow } = useWindow();
  const { formasPagamento } = useFormasPagamento();
  const { user: authUser } = useUser();
  const { hasPermission } = usePermissions();
  const empresaId = empresaAtual?.id || null;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeBaixarReceber = hasPermission('Financeiro','ContaReceber','baixar') || hasPermission('Financeiro','ContaReceber','liquidar');
  const podeEnviarCaixaReceber = hasPermission('Financeiro','ContaReceber','enviar_caixa') || hasPermission('Financeiro','ContaReceber','editar');
  const podeExportarReceber = hasPermission('Financeiro','ContaReceber','exportar');
  const sanitizeText = (value) => String(value || "")
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/javascript:\s*/gi, "")
    .trim();
  const isSafeUrl = (value) => {
    try {
      const url = new URL(String(value || ""));
      return ['http:', 'https:'].includes(url.protocol);
    } catch (_) {
      return false;
    }
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todas");
  const [gerarCobrancaDialogOpen, setGerarCobrancaDialogOpen] = useState(false);
  const [simularPagamentoDialogOpen, setSimularPagamentoDialogOpen] = useState(false);
  const [gerarLinkDialogOpen, setGerarLinkDialogOpen] = useState(false);
  const [contaParaCobranca, setContaParaCobranca] = useState(null);
  const [contaParaSimulacao, setContaParaSimulacao] = useState(null);
  const [contaParaLink, setContaParaLink] = useState(null);
  const [dialogBaixaOpen, setDialogBaixaOpen] = useState(false);
  const [contasSelecionadas, setContasSelecionadas] = useState([]);
  const [contaAtual, setContaAtual] = useState(null);
  const [dadosBaixa, setDadosBaixa] = useState({
    data_recebimento: new Date().toISOString().split('T')[0],
    valor_recebido: 0,
    forma_recebimento: "PIX",
    juros: 0,
    multa: 0,
    desconto: 0,
    observacoes: ""
  });

  const { data: empresasQuery = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list(),
  });

  const { data: configsCobranca = [] } = useQuery({
    queryKey: ['configs-cobranca'],
    queryFn: () => base44.entities.ConfiguracaoCobrancaEmpresa.list(),
  });

  const empresasData = empresas.length > 0 ? empresas : empresasQuery;

  const auditarFinanceiro = async ({ acao, entidade, registroId, descricao, dadosAnteriores, dadosNovos, sucesso = true }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: 'Financeiro',
        entidade,
        registro_id: registroId || null,
        descricao,
        usuario_id: authUser?.id || null,
        usuario: authUser?.full_name || authUser?.email || 'Usuario local',
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        sucesso,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao auditar financeiro receber:', error);
    }
  };

  const enviarParaCaixaMutation = useMutation({
    mutationFn: async (titulos) => {
      if (!contextoValido) throw new Error('Selecione grupo ou empresa antes de enviar titulos ao Caixa.');
      if (!podeEnviarCaixaReceber) throw new Error('Sem permissao para enviar titulos ao Caixa.');
      if (!Array.isArray(titulos) || titulos.length === 0) throw new Error('Selecione ao menos um titulo para enviar ao Caixa.');
      const total = titulos.reduce((sum, titulo) => sum + Number(titulo.valor || 0), 0);
      if (total <= 0) throw new Error('Valor total invalido para enviar ao Caixa.');
      if (!window.confirm(`Enviar ${titulos.length} titulo(s) a receber para o Caixa no total de R$ ${total.toFixed(2)}?`)) {
        await auditarFinanceiro({
          acao: 'Cancelamento',
          entidade: 'CaixaOrdemLiquidacao',
          descricao: 'Envio de contas a receber ao Caixa cancelado pelo usuario',
          dadosNovos: { quantidade: titulos.length, valor_total: total },
          sucesso: false
        });
        throw new Error('Envio ao Caixa cancelado pelo usuario.');
      }
      const ordens = await Promise.all(titulos.map(async (titulo) => {
        return await createInContext('CaixaOrdemLiquidacao', {
          group_id: titulo.group_id || groupId,
          grupo_id: titulo.grupo_id || titulo.group_id || groupId,
          empresa_id: titulo.empresa_id || empresaId,
          tipo_operacao: 'Recebimento',
          origem: 'Contas a Receber',
          valor_total: Number(titulo.valor || 0),
          forma_pagamento_pretendida: 'PIX',
          status: 'Pendente',
          titulos_vinculados: [{
            titulo_id: titulo.id,
            tipo_titulo: 'ContaReceber',
            numero_titulo: sanitizeText(titulo.numero_documento || titulo.descricao),
            cliente_fornecedor_nome: sanitizeText(titulo.cliente),
            valor_titulo: Number(titulo.valor || 0),
            group_id: titulo.group_id || groupId,
            grupo_id: titulo.grupo_id || titulo.group_id || groupId,
            empresa_id: titulo.empresa_id || empresaId
          }],
          data_ordem: new Date().toISOString(),
          criado_por: authUser?.full_name || authUser?.email,
          criado_por_id: authUser?.id
        });
      }));
      return ordens;
    },
    onSuccess: async (ordens) => {
      await auditarFinanceiro({
        acao: 'Criacao',
        entidade: 'CaixaOrdemLiquidacao',
        descricao: `${ordens.length} titulo(s) a receber enviados para o Caixa`,
        dadosNovos: { quantidade: ordens.length, ordens_ids: ordens.map(ordem => ordem?.id).filter(Boolean) }
      });
      queryClient.invalidateQueries({ queryKey: ['caixa-ordens-liquidacao'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-liquidacao'] });
      toast({ title: `✅ ${ordens.length} título(s) enviado(s) para o Caixa!` });
      setContasSelecionadas([]);
    },
    onError: (error) => {
      toast({ title: error?.message || 'Falha ao enviar titulos ao Caixa', variant: 'destructive' });
    }
  });

  const baixarTituloMutation = useMutation({
    mutationFn: async ({ id, dados }) => {
      if (!contextoValido) throw new Error('Selecione grupo ou empresa antes de baixar titulo.');
      if (!podeBaixarReceber) throw new Error('Sem permissao para baixar titulo.');
      const conta = contasList.find(c => c.id === id);
      if (!conta) throw new Error('Titulo nao encontrado para baixa.');
      const dadosSanitizados = {
        ...dados,
        juros: Number(dados.juros || 0),
        multa: Number(dados.multa || 0),
        desconto: Number(dados.desconto || 0),
        valor_recebido: Number(dados.valor_recebido || 0),
        forma_recebimento: sanitizeText(dados.forma_recebimento),
        observacoes: sanitizeText(dados.observacoes)
      };
      const titulo = await updateInContext('ContaReceber', id, {
        group_id: conta.group_id || groupId,
        grupo_id: conta.grupo_id || conta.group_id || groupId,
        empresa_id: conta.empresa_id || empresaId,
        status: "Recebido",
        data_recebimento: dadosSanitizados.data_recebimento,
        valor_recebido: dadosSanitizados.valor_recebido,
        forma_recebimento: dadosSanitizados.forma_recebimento,
        juros: dadosSanitizados.juros,
        multa: dadosSanitizados.multa,
        desconto: dadosSanitizados.desconto,
        observacoes: dadosSanitizados.observacoes
      });

      if (conta.cliente_id) {
        await createInContext('HistoricoCliente', {
          group_id: conta.group_id || groupId,
          grupo_id: conta.grupo_id || conta.group_id || groupId,
          empresa_id: conta.empresa_id || empresaId,
          cliente_id: conta.cliente_id,
          cliente_nome: sanitizeText(conta.cliente),
          modulo_origem: "Financeiro",
          referencia_id: id,
          referencia_tipo: "ContaReceber",
          tipo_evento: "Recebimento",
          titulo_evento: `Recebimento de R$ ${dadosSanitizados.valor_recebido.toFixed(2)}`,
          descricao_detalhada: `Titulo ${sanitizeText(conta.descricao)} recebido via ${dadosSanitizados.forma_recebimento}`,
          usuario_responsavel: authUser?.full_name || authUser?.email,
          usuario_responsavel_id: authUser?.id,
          data_evento: new Date().toISOString(),
          valor_relacionado: dadosSanitizados.valor_recebido,
          resolvido: true
        });
      }
      return titulo;
    },
    onSuccess: async (_data, vars) => {
      const contaAntes = contasList.find(c => c.id === vars?.id);
      await auditarFinanceiro({
        acao: 'Edicao',
        entidade: 'ContaReceber',
        registroId: vars?.id,
        descricao: 'Baixa de titulo registrada',
        dadosAnteriores: contaAntes,
        dadosNovos: { ...vars?.dados, status: 'Recebido' }
      });
      queryClient.invalidateQueries({ queryKey: ['contasReceber'] });
      setDialogBaixaOpen(false);
      setContaAtual(null);
      toast({ title: "✅ Título baixado com sucesso!" });
    },
    onError: (error) => {
      toast({ title: error?.message || 'Falha ao baixar titulo', variant: 'destructive' });
    }
  });

  const baixarMultiplaMutation = useMutation({
    mutationFn: async (dados) => {
      if (!contextoValido) throw new Error('Selecione grupo ou empresa antes da baixa multipla.');
      if (!podeBaixarReceber) throw new Error('Sem permissao para baixa multipla.');
      if (contasSelecionadas.length === 0) throw new Error('Selecione ao menos um titulo para baixa multipla.');
      await Promise.all(contasSelecionadas.map(async (contaId) => {
        const conta = contasList.find(c => c.id === contaId);
        if (conta) {
          const valorTotal = Number(conta.valor || 0) + Number(dados.juros || 0) + Number(dados.multa || 0) - Number(dados.desconto || 0);
          await baixarTituloMutation.mutateAsync({ id: contaId, dados: { ...dados, valor_recebido: valorTotal } });
        }
      }));
    },
    onSuccess: async () => {
      await auditarFinanceiro({
        acao: 'Edicao',
        entidade: 'ContaReceber',
        descricao: `Baixa multipla de contas a receber (${contasSelecionadas.length})`,
        dadosNovos: { ids: contasSelecionadas, quantidade: contasSelecionadas.length }
      });
      setContasSelecionadas([]);
      setDialogBaixaOpen(false);
      toast({ title: `✅ ${contasSelecionadas.length} título(s) baixado(s)!` });
    },
    onError: (error) => {
      toast({ title: error?.message || 'Falha na baixa multipla', variant: 'destructive' });
    }
  });

  const enviarWhatsAppMutation = useMutation({
    mutationFn: async (contaId) => {
      const conta = contasList.find(c => c.id === contaId);
      await updateInContext('ContaReceber', contaId, {
        data_envio_cobranca: new Date().toISOString()
      });
      return { sucesso: true };
    },
    onSuccess: () => toast({ title: "✅ WhatsApp enviado (simulação)!" })
  });

  const filteredContas = contasList
    .filter(c => statusFilter === "todas" || c.status === statusFilter)
    .filter(c => {
      const searchLower = searchTerm.toLowerCase();
      return c.cliente?.toLowerCase().includes(searchLower) ||
        c.descricao?.toLowerCase().includes(searchLower) ||
        c.numero_documento?.toLowerCase().includes(searchLower) ||
        c.forma_cobranca?.toLowerCase().includes(searchLower) ||
        c.status?.toLowerCase().includes(searchLower) ||
        c.origem_tipo?.toLowerCase().includes(searchLower) ||
        c.canal_origem?.toLowerCase().includes(searchLower) ||
        c.marketplace_origem?.toLowerCase().includes(searchLower) ||
        c.centro_custo?.toLowerCase().includes(searchLower) ||
        c.projeto_obra?.toLowerCase().includes(searchLower) ||
        c.observacoes?.toLowerCase().includes(searchLower);
    });

  const totalSelecionado = contasList
    .filter(c => contasSelecionadas.includes(c.id))
    .reduce((sum, c) => sum + (c.valor || 0), 0);

  const statusColors = {
    'Pendente': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'Recebido': 'bg-green-100 text-green-800 border-green-300',
    'Atrasado': 'bg-red-100 text-red-800 border-red-300',
    'Cancelado': 'bg-gray-100 text-gray-800 border-gray-300',
    'Parcial': 'bg-blue-100 text-blue-800 border-blue-300'
  };

  const totais = {
    total: filteredContas.reduce((sum, c) => sum + (c.valor || 0), 0),
    pendente: filteredContas.filter(c => c.status === 'Pendente').reduce((sum, c) => sum + (c.valor || 0), 0),
    pago: filteredContas.filter(c => c.status === 'Recebido').reduce((sum, c) => sum + (c.valor || 0), 0),
    vencido: filteredContas.filter(c => c.status === 'Atrasado').reduce((sum, c) => sum + (c.valor || 0), 0)
  };

  const toggleSelecao = (contaId) => {
    setContasSelecionadas(prev =>
      prev.includes(contaId) ? prev.filter(id => id !== contaId) : [...prev, contaId]
    );
  };

  const handleBaixar = (conta) => {
    if (!contextoValido) {
      toast({ title: 'Selecione grupo ou empresa para baixar titulo', variant: 'destructive' });
      return;
    }
    if (!hasPermission('Financeiro','ContaReceber','baixar') && !hasPermission('Financeiro','ContaReceber','liquidar')) {
      toast({ title: '⛔ Sem permissão para baixar', variant: 'destructive' });
      return;
    }
    setContaAtual(conta);
    setDadosBaixa({
      data_recebimento: new Date().toISOString().split('T')[0],
      valor_recebido: conta.valor,
      forma_recebimento: "PIX",
      juros: 0,
      multa: 0,
      desconto: 0,
      observacoes: ""
    });
    setDialogBaixaOpen(true);
  };

  const handleBaixarMultipla = () => {
    if (!contextoValido) {
      toast({ title: 'Selecione grupo ou empresa para baixa multipla', variant: 'destructive' });
      return;
    }
    if (!hasPermission('Financeiro','ContaReceber','baixar') && !hasPermission('Financeiro','ContaReceber','liquidar')) {
      toast({ title: '⛔ Sem permissão para baixa múltipla', variant: 'destructive' });
      return;
    }
    if (contasSelecionadas.length === 0) {
      toast({ title: "⚠️ Selecione pelo menos um título", variant: "destructive" });
      return;
    }
    setContaAtual(null);
    setDadosBaixa({
      data_recebimento: new Date().toISOString().split('T')[0],
      valor_recebido: 0,
      forma_recebimento: "PIX",
      juros: 0,
      multa: 0,
      desconto: 0,
      observacoes: ""
    });
    setDialogBaixaOpen(true);
  };

  const handleSubmitBaixa = (e) => {
    e.preventDefault();
    if (!contextoValido) {
      toast({ title: 'Contexto obrigatorio', description: 'Selecione grupo ou empresa antes de confirmar a baixa.', variant: 'destructive' });
      return;
    }
    const totalTitulos = contaAtual ? 1 : contasSelecionadas.length;
    if (!window.confirm(`Confirmar baixa de ${totalTitulos} titulo(s) a receber?`)) {
      auditarFinanceiro({
        acao: 'Cancelamento',
        entidade: 'ContaReceber',
        registroId: contaAtual?.id,
        descricao: 'Usuario cancelou a confirmacao de baixa de conta a receber.',
        dadosNovos: { totalTitulos, dadosBaixa },
        sucesso: false
      });
      return;
    }
    if (contaAtual) {
      baixarTituloMutation.mutate({ id: contaAtual.id, dados: dadosBaixa });
    } else {
      baixarMultiplaMutation.mutate(dadosBaixa);
    }
  };

  const content = (
    <div className="space-y-1.5">
      <HeaderReceberCompacto />
      <KPIsReceber totais={totais} />
      <FiltrosReceber
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        contasSelecionadas={contasSelecionadas}
        totalSelecionado={totalSelecionado}
        onExportar={() => {
          if (!podeExportarReceber) { toast({ title: '⛔ Sem permissão para exportar', variant: 'destructive' }); return; }
          if (!contextoValido) { toast({ title: 'Selecione grupo ou empresa para exportar', variant: 'destructive' }); return; }
          const itens = contasSelecionadas.length > 0
            ? contasList.filter(c => contasSelecionadas.includes(c.id))
            : filteredContas;
          if (!window.confirm(`Exportar ${itens.length} titulo(s) a receber com contexto grupo/empresa?`)) {
            auditarFinanceiro({ acao: 'Cancelamento', entidade: 'ContaReceber', descricao: 'Exportacao de contas a receber cancelada pelo usuario', dadosNovos: { quantidade: itens.length }, sucesso: false });
            return;
          }
          const headers = ['cliente','descricao','numero_documento','empresa_id','group_id','grupo_id','data_vencimento','valor','status'];
          const csv = [headers.join(','), ...itens.map(c => headers.map(h => JSON.stringify(c[h] ?? '')).join(','))].join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `contas_receber_${new Date().toISOString().slice(0,10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          try { auditarFinanceiro({ acao: 'Exportacao', entidade: 'ContaReceber', descricao: `Exportados ${itens.length} titulos a receber`, dadosNovos: { quantidade: itens.length, ids: itens.map(item => item.id).filter(Boolean) } }); } catch(_) {}
        }}
        onBaixarMultipla={handleBaixarMultipla}
        onNovaConta={() => { if (!hasPermission('Financeiro','ContaReceber','criar')) { toast({ title: '⛔ Sem permissão para criar', variant: 'destructive' }); return; } openWindow(ContaReceberForm, {
          windowMode: true,
          onSubmit: async (data) => {
            await createInContext('ContaReceber', {
              ...data,
              criado_por: authUser?.full_name || authUser?.email,
              criado_por_id: authUser?.id
            });
            queryClient.invalidateQueries({ queryKey: ['contasReceber'] });
            toast({ title: "✅ Conta criada!" });
          }
        }, { title: '💰 Nova Conta a Receber', width: 900, height: 600 })}}
        onEnviarCaixa={() => { if (!hasPermission('Financeiro','ContaReceber','enviar_caixa') && !hasPermission('Financeiro','ContaReceber','editar')) { toast({ title: '⛔ Sem permissão para enviar ao Caixa', variant: 'destructive' }); return; }
          const titulos = contasList.filter(c => contasSelecionadas.includes(c.id));
          if (!contextoValido || titulos.length === 0) { toast({ title: 'Selecione contexto e titulos para enviar ao Caixa', variant: 'destructive' }); return; }
          enviarParaCaixaMutation.mutate(titulos);
        }}
        baixarPending={baixarMultiplaMutation.isPending}
        enviarPending={enviarParaCaixaMutation.isPending}
      />
      
      <TabelaReceber
        contas={filteredContas}
        empresas={empresasData}
        statusColors={statusColors}
        contasSelecionadas={contasSelecionadas}
        toggleSelecao={toggleSelecao}
        onPrint={(conta, empresa) => ImprimirBoleto({ conta, empresa, tipo: 'receber' })}
        onEdit={(conta, editar = false) => { if (editar && !hasPermission('Financeiro','ContaReceber','editar')) { toast({ title: '⛔ Sem permissão para editar', variant: 'destructive' }); return; } openWindow(ContaReceberForm, {
          conta: editar ? conta : null,
          windowMode: true,
          readonly: !editar,
          onSubmit: async (data) => {
            if (editar) {
              await updateInContext('ContaReceber', conta.id, data);
              queryClient.invalidateQueries({ queryKey: ['contasReceber'] });
              toast({ title: "✅ Conta atualizada!" });
            }
          }
        }, { title: editar ? `✏️ Editar: ${conta.cliente}` : `👁️ Detalhes: ${conta.cliente}`, width: 900, height: 600 })}}
        onGerarCobranca={(conta) => {
          setContaParaCobranca(conta);
          setGerarCobrancaDialogOpen(true);
        }}
        onGerarLink={(conta) => {
          setContaParaLink(conta);
          setGerarLinkDialogOpen(true);
        }}
        onVerBoleto={(conta) => {
          if (!isSafeUrl(conta?.boleto_url)) { toast({ title: 'URL do boleto invalida ou insegura', variant: 'destructive' }); return; }
          window.open(conta.boleto_url, '_blank', 'noopener,noreferrer');
        }}
        onCopiarPix={(conta) => {
          navigator.clipboard.writeText(conta.pix_copia_cola);
          toast({ title: "📋 PIX copiado!" });
        }}
        onEnviarWhatsApp={(conta) => enviarWhatsAppMutation.mutate(conta.id)}
        onSimularPagamento={(conta) => {
          setContaParaSimulacao(conta);
          setSimularPagamentoDialogOpen(true);
        }}
        onBaixar={handleBaixar}
        configsCobranca={configsCobranca}
      />

      {/* Paginação backend padronizada */}
      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <div className="text-slate-600">Página {page}</div>
        <div className="flex items-center gap-2">
          <select className="h-8 border rounded px-2" value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(1); }}>
            {[10,20,50,100].map(n => (<option key={n} value={n}>{n}/página</option>))}
          </select>
          <Button variant="outline" size="sm" onClick={()=>setPage(p => Math.max(1, p-1))} disabled={page<=1}>Anterior</Button>
          <Button variant="outline" size="sm" onClick={()=>setPage(p => p+1)} disabled={contasBackend.length < pageSize}>Próxima</Button>
        </div>
      </div>

      <Dialog open={dialogBaixaOpen} onOpenChange={setDialogBaixaOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {contaAtual ? 'Baixar Conta a Receber' : `Baixar Múltiplos Títulos (${contasSelecionadas.length})`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitBaixa} className="space-y-4">
            {!contaAtual && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription>
                  <p className="font-semibold text-blue-900">Baixando {contasSelecionadas.length} título(s)</p>
                </AlertDescription>
              </Alert>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              {contaAtual && (
                <div>
                  <Label>Cliente</Label>
                  <Input value={contaAtual?.cliente || ''} disabled />
                </div>
              )}
              <div className={contaAtual ? '' : 'col-span-2'}>
                <Label>Data Recebimento *</Label>
                <Input
                  type="date"
                  value={dadosBaixa.data_recebimento}
                  onChange={(e) => setDadosBaixa({ ...dadosBaixa, data_recebimento: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label>Forma de Recebimento *</Label>
              <Select value={dadosBaixa.forma_recebimento} onValueChange={(v) => setDadosBaixa({ ...dadosBaixa, forma_recebimento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {formasPagamento.map(forma => (
                    <SelectItem key={forma.id} value={forma.descricao}>
                      {forma.icone && `${forma.icone} `}{forma.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div><Label>Juros (R$)</Label><Input type="number" step="0.01" value={dadosBaixa.juros} onChange={(e) => setDadosBaixa({ ...dadosBaixa, juros: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>Multa (R$)</Label><Input type="number" step="0.01" value={dadosBaixa.multa} onChange={(e) => setDadosBaixa({ ...dadosBaixa, multa: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>Desconto (R$)</Label><Input type="number" step="0.01" value={dadosBaixa.desconto} onChange={(e) => setDadosBaixa({ ...dadosBaixa, desconto: parseFloat(e.target.value) || 0 })} /></div>
            </div>

            {contaAtual && (
              <div className="bg-slate-50 p-4 rounded-lg border">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Valor Total:</span>
                  <span className="text-xl font-bold text-green-700">
                    R$ {((contaAtual?.valor || 0) + (dadosBaixa.juros || 0) + (dadosBaixa.multa || 0) - (dadosBaixa.desconto || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialogBaixaOpen(false)} data-action="ContaReceber.baixa_cancelar">Cancelar</Button>
              <Button type="submit" disabled={!contextoValido || baixarTituloMutation.isPending || baixarMultiplaMutation.isPending} className="bg-green-600" data-action="ContaReceber.baixar" data-permission="Financeiro.ContaReceber.baixar" data-context-required="true" data-sensitive>
                {(baixarTituloMutation.isPending || baixarMultiplaMutation.isPending) ? 'Baixando...' : 'Confirmar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {gerarCobrancaDialogOpen && <GerarCobrancaModal isOpen={gerarCobrancaDialogOpen} onClose={() => { setGerarCobrancaDialogOpen(false); setContaParaCobranca(null); }} contaReceber={contaParaCobranca} />}
      {gerarLinkDialogOpen && <GerarLinkPagamentoModal isOpen={gerarLinkDialogOpen} onClose={() => { setGerarLinkDialogOpen(false); setContaParaLink(null); }} contaReceber={contaParaLink} />}
      {simularPagamentoDialogOpen && <SimularPagamentoModal isOpen={simularPagamentoDialogOpen} onClose={() => { setSimularPagamentoDialogOpen(false); setContaParaSimulacao(null); }} contaReceber={contaParaSimulacao} />}
    </div>
  );

  if (windowMode) {
    return <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-green-50 overflow-auto p-1.5">{content}</div>;
  }

  return content;
}
