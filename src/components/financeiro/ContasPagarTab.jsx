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
import ContaPagarForm from "./ContaPagarForm";
import { useWindow } from "@/components/lib/useWindow";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useFormasPagamento } from "@/components/lib/useFormasPagamento";
import { useUser } from "@/components/lib/UserContext";
import usePermissions from "@/components/lib/usePermissions";
import HeaderPagarCompacto from "./contas-pagar/HeaderPagarCompacto";
import KPIsPagar from "./contas-pagar/KPIsPagar";
import FiltrosPagar from "./contas-pagar/FiltrosPagar";
import TabelaPagar from "./contas-pagar/TabelaPagar";
import useEntityListSorted from "@/components/lib/useEntityListSorted";
import useBackendPagination from "@/components/lib/useBackendPagination";
import usePersistedSort from "@/components/lib/usePersistedSort";

export default function ContasPagarTab({ contas, windowMode = false }) {
  const { createInContext, updateInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { page, setPage, pageSize, setPageSize } = useBackendPagination('ContaPagar', 20);
  const [sortField, setSortField, sortDirection, setSortDirection] = usePersistedSort('ContaPagar', 'data_vencimento', 'asc');

  // persistência de sort movida para usePersistedSort

  const { data: contasBackend = [] } = useEntityListSorted('ContaPagar', {}, { sortField, sortDirection, page, pageSize, limit: pageSize });
  const contasList = Array.isArray(contas) && contas.length ? contas : contasBackend;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { openWindow } = useWindow();
  const { formasPagamento } = useFormasPagamento();
  const { user: authUser } = useUser();
  const { hasPermission } = usePermissions();
  const empresaId = empresaAtual?.id || null;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeBaixarPagar = hasPermission('Financeiro','ContaPagar','baixar') || hasPermission('Financeiro','ContaPagar','liquidar');
  const podeEnviarCaixaPagar = hasPermission('Financeiro','ContaPagar','enviar_caixa') || hasPermission('Financeiro','ContaPagar','editar');
  const podeExportarPagar = hasPermission('Financeiro','ContaPagar','exportar');
  const podeAprovarPagar = hasPermission('Financeiro','ContaPagar','aprovar');
  const sanitizeText = (value) => String(value || "")
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/javascript:\s*/gi, "")
    .trim();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [dialogBaixaOpen, setDialogBaixaOpen] = useState(false);
  const [contasSelecionadas, setContasSelecionadas] = useState([]);
  const [contaAtual, setContaAtual] = useState(null);
  const [dadosBaixa, setDadosBaixa] = useState({
    data_pagamento: new Date().toISOString().split('T')[0],
    valor_pago: 0,
    forma_pagamento: "PIX",
    juros: 0,
    multa: 0,
    desconto: 0,
    observacoes: ""
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list(),
  });

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
      console.warn('Falha ao auditar financeiro pagar:', error);
    }
  };

  const enviarParaCaixaMutation = useMutation({
    mutationFn: async (titulos) => {
      if (!contextoValido) throw new Error('Selecione grupo ou empresa antes de enviar titulos ao Caixa.');
      if (!podeEnviarCaixaPagar) throw new Error('Sem permissao para enviar titulos ao Caixa.');
      if (!Array.isArray(titulos) || titulos.length === 0) throw new Error('Selecione ao menos um titulo para enviar ao Caixa.');
      const total = titulos.reduce((sum, titulo) => sum + Number(titulo.valor || 0), 0);
      if (total <= 0) throw new Error('Valor total invalido para enviar ao Caixa.');
      if (!window.confirm(`Enviar ${titulos.length} titulo(s) a pagar para o Caixa no total de R$ ${total.toFixed(2)}?`)) {
        await auditarFinanceiro({
          acao: 'Cancelamento',
          entidade: 'CaixaOrdemLiquidacao',
          descricao: 'Envio de contas a pagar ao Caixa cancelado pelo usuario',
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
          tipo_operacao: 'Pagamento',
          origem: 'Contas a Pagar',
          valor_total: Number(titulo.valor || 0),
          forma_pagamento_pretendida: 'Transferencia',
          status: 'Pendente',
          titulos_vinculados: [{
            titulo_id: titulo.id,
            tipo_titulo: 'ContaPagar',
            numero_titulo: sanitizeText(titulo.numero_documento || titulo.descricao),
            cliente_fornecedor_nome: sanitizeText(titulo.fornecedor),
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
      queryClient.invalidateQueries({ queryKey: ['caixa-ordens-liquidacao'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-liquidacao'] });
      toast({ title: `✅ ${ordens.length} título(s) enviado(s) para o Caixa!` });
      await auditarFinanceiro({
        acao: 'Criacao',
        entidade: 'CaixaOrdemLiquidacao',
        descricao: `${ordens.length} titulo(s) a pagar enviados para o Caixa`,
        dadosNovos: { quantidade: ordens.length, ordens_ids: ordens.map(ordem => ordem?.id).filter(Boolean) }
      });
      setContasSelecionadas([]);
    },
    onError: (error) => {
      toast({ title: error?.message || 'Falha ao enviar titulos ao Caixa', variant: 'destructive' });
    }
  });

  const baixarTituloMutation = useMutation({
    mutationFn: async ({ id, dados }) => {
      if (!contextoValido) throw new Error('Selecione grupo ou empresa antes de pagar titulo.');
      if (!podeBaixarPagar) throw new Error('Sem permissao para pagar titulo.');
      const conta = contasList.find(c => c.id === id);
      if (!conta) throw new Error('Titulo nao encontrado para pagamento.');
      const dadosSanitizados = {
        ...dados,
        juros: Number(dados.juros || 0),
        multa: Number(dados.multa || 0),
        desconto: Number(dados.desconto || 0),
        forma_pagamento: sanitizeText(dados.forma_pagamento),
        observacoes: sanitizeText(dados.observacoes)
      };
      const valorTotal = Number(conta.valor || 0) + dadosSanitizados.juros + dadosSanitizados.multa - dadosSanitizados.desconto;
      if (valorTotal <= 0) throw new Error('Valor total invalido para pagamento.');
      
      await createInContext('CaixaMovimento', {
        empresa_id: conta.empresa_id || empresaId,
        group_id: conta.group_id || groupId,
        grupo_id: conta.grupo_id || conta.group_id || groupId,
        tipo_movimento: 'Saida',
        categoria: 'Pagamento Fornecedor',
        subcategoria: sanitizeText(conta.categoria),
        descricao: `Pagamento: ${sanitizeText(conta.descricao)}`,
        valor: valorTotal,
        forma_pagamento: dadosSanitizados.forma_pagamento,
        data_movimento: dadosSanitizados.data_pagamento,
        conta_pagar_id: id,
        favorecido: sanitizeText(conta.fornecedor),
        documento_numero: sanitizeText(conta.numero_documento),
        centro_custo_id: conta.centro_custo_id,
        observacoes: dadosSanitizados.observacoes,
        usuario_responsavel: authUser?.full_name || authUser?.email,
        usuario_responsavel_id: authUser?.id
      });

      return await updateInContext('ContaPagar', id, {
        group_id: conta.group_id || groupId,
        grupo_id: conta.grupo_id || conta.group_id || groupId,
        empresa_id: conta.empresa_id || empresaId,
        status: "Pago",
        data_pagamento: dadosSanitizados.data_pagamento,
        valor_pago: valorTotal,
        forma_pagamento: dadosSanitizados.forma_pagamento,
        juros: dadosSanitizados.juros,
        multa: dadosSanitizados.multa,
        desconto: dadosSanitizados.desconto,
        observacoes: dadosSanitizados.observacoes
      });
    },
    onSuccess: async (_data, vars) => {
      const contaAntes = contasList.find(c => c.id === vars?.id);
      await auditarFinanceiro({
        acao: 'Edicao',
        entidade: 'ContaPagar',
        registroId: vars?.id,
        descricao: 'Baixa de titulo a pagar registrada',
        dadosAnteriores: contaAntes,
        dadosNovos: { ...vars?.dados, status: 'Pago' }
      });
      queryClient.invalidateQueries({ queryKey: ['contasPagar'] });
      queryClient.invalidateQueries({ queryKey: ['caixa-movimentos'] });
      setDialogBaixaOpen(false);
      setContaAtual(null);
      toast({ title: "✅ Título pago!" });
    },
    onError: (error) => {
      toast({ title: error?.message || 'Falha ao pagar titulo', variant: 'destructive' });
    }
  });

  const baixarMultiplaMutation = useMutation({
    mutationFn: async (dados) => {
      if (!contextoValido) throw new Error('Selecione grupo ou empresa antes do pagamento multiplo.');
      if (!podeBaixarPagar) throw new Error('Sem permissao para pagamento multiplo.');
      if (contasSelecionadas.length === 0) throw new Error('Selecione ao menos um titulo para pagamento multiplo.');
      await Promise.all(contasSelecionadas.map(async (contaId) => {
        const conta = contasList.find(c => c.id === contaId);
        if (conta) {
          await baixarTituloMutation.mutateAsync({ id: contaId, dados });
        }
      }));
    },
    onSuccess: async () => {
      await auditarFinanceiro({
        acao: 'Edicao',
        entidade: 'ContaPagar',
        descricao: `Pagamento multiplo de contas a pagar (${contasSelecionadas.length})`,
        dadosNovos: { ids: contasSelecionadas, quantidade: contasSelecionadas.length }
      });
      setContasSelecionadas([]);
      setDialogBaixaOpen(false);
      toast({ title: `✅ ${contasSelecionadas.length} título(s) pago(s)!` });
    },
    onError: (error) => {
      toast({ title: error?.message || 'Falha no pagamento multiplo', variant: 'destructive' });
    }
  });

  const aprovarPagamentoMutation = useMutation({
    mutationFn: async (contaId) => {
      if (!contextoValido) throw new Error('Selecione grupo ou empresa antes de aprovar pagamento.');
      if (!podeAprovarPagar) throw new Error('Sem permissao para aprovar pagamento.');
      const conta = contasList.find(c => c.id === contaId);
      if (!conta) throw new Error('Titulo nao encontrado para aprovacao.');
      return await updateInContext('ContaPagar', contaId, {
        group_id: conta.group_id || groupId,
        grupo_id: conta.grupo_id || conta.group_id || groupId,
        empresa_id: conta.empresa_id || empresaId,
        status_pagamento: "Aprovado",
        aprovado_por: authUser?.full_name || authUser?.email,
        aprovado_por_id: authUser?.id,
        data_aprovacao: new Date().toISOString()
      });
    },
    onSuccess: async (_data, id) => {
      const contaAntes = contasList.find(c => c.id === id);
      queryClient.invalidateQueries({ queryKey: ['contasPagar'] });
      toast({ title: "✅ Pagamento aprovado!" });
      await auditarFinanceiro({
        acao: 'Edicao',
        entidade: 'ContaPagar',
        registroId: id,
        descricao: 'Aprovacao de pagamento',
        dadosAnteriores: contaAntes,
        dadosNovos: { status_pagamento: 'Aprovado' }
      });
    },
    onError: (error) => {
      toast({ title: error?.message || 'Falha ao aprovar pagamento', variant: 'destructive' });
    }
  });

  const contasFiltradas = contasList
    .filter(c => statusFilter === "todos" || c.status === statusFilter)
    .filter(c => {
      const searchLower = searchTerm.toLowerCase();
      return c.fornecedor?.toLowerCase().includes(searchLower) ||
        c.descricao?.toLowerCase().includes(searchLower) ||
        c.numero_documento?.toLowerCase().includes(searchLower) ||
        c.favorecido_cpf_cnpj?.includes(searchLower) ||
        c.categoria?.toLowerCase().includes(searchLower) ||
        c.status?.toLowerCase().includes(searchLower) ||
        c.origem_tipo?.toLowerCase().includes(searchLower) ||
        c.canal_origem?.toLowerCase().includes(searchLower) ||
        c.centro_custo?.toLowerCase().includes(searchLower) ||
        c.projeto_obra?.toLowerCase().includes(searchLower) ||
        c.observacoes?.toLowerCase().includes(searchLower);
    });

  const totalSelecionado = contasList
    .filter(c => contasSelecionadas.includes(c.id))
    .reduce((sum, c) => sum + (c.valor || 0), 0);

  const totais = {
    total: contasFiltradas.reduce((sum, c) => sum + (c.valor || 0), 0),
    pendente: contasFiltradas.filter(c => c.status === 'Pendente').reduce((sum, c) => sum + (c.valor || 0), 0),
    pago: contasFiltradas.filter(c => c.status === 'Pago').reduce((sum, c) => sum + (c.valor || 0), 0),
    vencido: contasFiltradas.filter(c => c.status === 'Atrasado').reduce((sum, c) => sum + (c.valor || 0), 0)
  };

  const toggleSelecao = (contaId) => {
    setContasSelecionadas(prev =>
      prev.includes(contaId) ? prev.filter(id => id !== contaId) : [...prev, contaId]
    );
  };

  const handleBaixar = (conta) => {
    if (!contextoValido) {
      toast({ title: 'Selecione grupo ou empresa para pagar titulo', variant: 'destructive' });
      return;
    }
    if (!hasPermission('Financeiro','ContaPagar','baixar') && !hasPermission('Financeiro','ContaPagar','liquidar')) {
      toast({ title: '⛔ Sem permissão para baixar', variant: 'destructive' });
      return;
    }
    setContaAtual(conta);
    setDadosBaixa({
      data_pagamento: new Date().toISOString().split('T')[0],
      valor_pago: conta.valor,
      forma_pagamento: "PIX",
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
    if (!hasPermission('Financeiro','ContaPagar','baixar') && !hasPermission('Financeiro','ContaPagar','liquidar')) {
      toast({ title: '⛔ Sem permissão para baixa múltipla', variant: 'destructive' });
      return;
    }
    if (contasSelecionadas.length === 0) {
      toast({ title: "⚠️ Selecione pelo menos um título", variant: "destructive" });
      return;
    }
    setContaAtual(null);
    setDadosBaixa({
      data_pagamento: new Date().toISOString().split('T')[0],
      valor_pago: 0,
      forma_pagamento: "PIX",
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
      toast({ title: 'Contexto obrigatorio', description: 'Selecione grupo ou empresa antes de confirmar o pagamento.', variant: 'destructive' });
      return;
    }
    const totalTitulos = contaAtual ? 1 : contasSelecionadas.length;
    if (!window.confirm(`Confirmar pagamento de ${totalTitulos} titulo(s) a pagar?`)) {
      auditarFinanceiro({
        acao: 'Cancelamento',
        entidade: 'ContaPagar',
        registroId: contaAtual?.id,
        descricao: 'Usuario cancelou a confirmacao de baixa de conta a pagar.',
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
      <HeaderPagarCompacto />
      <KPIsPagar totais={totais} />
      <FiltrosPagar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        contasSelecionadas={contasSelecionadas}
        totalSelecionado={totalSelecionado}
        onExportar={() => {
          if (!podeExportarPagar) { toast({ title: '⛔ Sem permissão para exportar', variant: 'destructive' }); return; }
          if (!contextoValido) { toast({ title: 'Selecione grupo ou empresa para exportar', variant: 'destructive' }); return; }
          const itens = contasSelecionadas.length > 0
            ? contasList.filter(c => contasSelecionadas.includes(c.id))
            : contasFiltradas;
          if (!window.confirm(`Exportar ${itens.length} titulo(s) a pagar com contexto grupo/empresa?`)) {
            auditarFinanceiro({ acao: 'Cancelamento', entidade: 'ContaPagar', descricao: 'Exportacao de contas a pagar cancelada pelo usuario', dadosNovos: { quantidade: itens.length }, sucesso: false });
            return;
          }
          const headers = ['fornecedor','descricao','empresa_id','group_id','grupo_id','data_vencimento','valor','status'];
          const csv = [headers.join(','), ...itens.map(c => headers.map(h => JSON.stringify(c[h] ?? '')).join(','))].join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `contas_pagar_${new Date().toISOString().slice(0,10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          try { auditarFinanceiro({ acao: 'Exportacao', entidade: 'ContaPagar', descricao: `Exportados ${itens.length} titulos a pagar`, dadosNovos: { quantidade: itens.length, ids: itens.map(item => item.id).filter(Boolean) } }); } catch(_) {}
        }}
        onBaixarMultipla={handleBaixarMultipla}
        onNovaConta={() => { if (!hasPermission('Financeiro','ContaPagar','criar')) { toast({ title: '⛔ Sem permissão para criar', variant: 'destructive' }); return; } openWindow(ContaPagarForm, {
          windowMode: true,
          onSubmit: async (data) => {
            await createInContext('ContaPagar', {
              ...data,
              criado_por: authUser?.full_name || authUser?.email,
              criado_por_id: authUser?.id
            });
            queryClient.invalidateQueries({ queryKey: ['contasPagar'] });
            toast({ title: "✅ Conta criada!" });
          }
        }, { title: '💸 Nova Conta a Pagar', width: 900, height: 600 }) }}
        onEnviarCaixa={() => {
          const titulos = contasList.filter(c => contasSelecionadas.includes(c.id));
          if (!hasPermission('Financeiro','ContaPagar','enviar_caixa') && !hasPermission('Financeiro','ContaPagar','editar')) { toast({ title: '⛔ Sem permissão para enviar ao Caixa', variant: 'destructive' }); return; }
          if (!contextoValido || titulos.length === 0) { toast({ title: 'Selecione contexto e titulos para enviar ao Caixa', variant: 'destructive' }); return; }
          enviarParaCaixaMutation.mutate(titulos);
        }}
        empresaId={empresaId}
        baixarPending={baixarMultiplaMutation.isPending}
        enviarPending={enviarParaCaixaMutation.isPending}
      />
      
      <TabelaPagar
        contas={contasFiltradas}
        empresas={empresas}
        contasSelecionadas={contasSelecionadas}
        toggleSelecao={toggleSelecao}
        onPrint={(conta, empresa) => ImprimirBoleto({ conta, empresa, tipo: 'pagar' })}
        onEdit={(conta) => { if (!hasPermission('Financeiro','ContaPagar','editar')) { toast({ title: '⛔ Sem permissão para editar', variant: 'destructive' }); return; } openWindow(ContaPagarForm, {
          conta,
          windowMode: true,
          onSubmit: async (data) => {
            await updateInContext('ContaPagar', conta.id, data);
            queryClient.invalidateQueries({ queryKey: ['contasPagar'] });
            toast({ title: "✅ Conta atualizada!" });
          }
        }, { title: `✏️ Editar: ${conta.fornecedor}`, width: 900, height: 600 })}}
        onAprovar={(contaId) => {
          if (!podeAprovarPagar) { toast({ title: '⛔ Sem permissão para aprovar', variant: 'destructive' }); return; }
          if (!contextoValido) { toast({ title: 'Selecione grupo ou empresa para aprovar pagamento', variant: 'destructive' }); return; }
          const conta = contasList.find(c => c.id === contaId);
          if (!window.confirm(`Aprovar pagamento ${conta?.numero_documento || conta?.descricao || contaId}?`)) {
            auditarFinanceiro({ acao: 'Cancelamento', entidade: 'ContaPagar', registroId: contaId, descricao: 'Aprovacao de pagamento cancelada pelo usuario', dadosAnteriores: conta, sucesso: false });
            return;
          }
          aprovarPagamentoMutation.mutate(contaId);
        }}
        onBaixar={handleBaixar}
        aprovarPending={aprovarPagamentoMutation.isPending}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={(sf, sd) => { setSortField(sf); setSortDirection(sd); }}
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
              {contaAtual ? 'Registrar Pagamento' : `Pagar Múltiplos Títulos (${contasSelecionadas.length})`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitBaixa} className="space-y-4">
            {!contaAtual && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription>
                  <p className="font-semibold text-blue-900">Pagando {contasSelecionadas.length} título(s)</p>
                </AlertDescription>
              </Alert>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              {contaAtual && (
                <div>
                  <Label>Fornecedor</Label>
                  <Input value={contaAtual?.fornecedor || ''} disabled />
                </div>
              )}
              <div className={contaAtual ? '' : 'col-span-2'}>
                <Label>Data Pagamento *</Label>
                <Input
                  type="date"
                  value={dadosBaixa.data_pagamento}
                  onChange={(e) => setDadosBaixa({ ...dadosBaixa, data_pagamento: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label>Forma de Pagamento *</Label>
              <Select value={dadosBaixa.forma_pagamento} onValueChange={(v) => setDadosBaixa({ ...dadosBaixa, forma_pagamento: v })}>
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
                  <span className="text-xl font-bold text-red-700">
                    R$ {((contaAtual?.valor || 0) + (dadosBaixa.juros || 0) + (dadosBaixa.multa || 0) - (dadosBaixa.desconto || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialogBaixaOpen(false)} data-action="ContaPagar.baixa_cancelar">Cancelar</Button>
              <Button type="submit" disabled={!contextoValido || baixarTituloMutation.isPending || baixarMultiplaMutation.isPending} className="bg-green-600" data-action="ContaPagar.baixar" data-permission="Financeiro.ContaPagar.baixar" data-context-required="true" data-sensitive>
                {(baixarTituloMutation.isPending || baixarMultiplaMutation.isPending) ? 'Registrando...' : 'Confirmar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (windowMode) {
    return <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-red-50 overflow-auto p-1.5">{content}</div>;
  }

  return content;
}
