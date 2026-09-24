import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Eye, FilePlus2, Mail, MessageCircle, Pencil, Plus, Printer, RefreshCw, Search, Trash2, XCircle } from 'lucide-react';
import { createHttpApiClient } from '@/api/httpApiClient';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PaginationControls from '@/components/ui/PaginationControls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { buildOrcamentoPayload, buildOrcamentoShareText, calculateItem, calculateTotals, canUseOrcamentoAction, microsToDecimal } from './orcamentoUiPolicy';
import { gerarPDFOrcamento } from '@/components/lib/exportacaoPDF';

const emptyItem = () => ({ produto_id: '', unidade_id: '', descricao: '', unidade_sigla: '', quantidade: '1', preco_unitario: '0', desconto: '0' });
const emptyForm = () => ({ cliente_empresa_id: '', condicao_pagamento_id: '', validade_em: '', observacoes: '', itens: [emptyItem()] });
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
const date = (value) => value ? new Intl.DateTimeFormat('pt-BR').format(new Date(value)) : '-';
const errorMessage = (error) => {
  if (error?.status === 403) return 'Seu perfil não possui permissão para esta ação.';
  if (error?.status === 404) return 'Orçamento não encontrado neste contexto.';
  if (error?.status === 409) return 'O orçamento foi alterado e não está mais em aberto.';
  if (error?.status === 422) return error?.body?.error?.message || 'Revise os dados informados.';
  if (error?.status === 400) return 'Contexto ou identificador inválido.';
  return 'Não foi possível comunicar com o servidor. Tente novamente.';
};

export default function OrcamentosTab({ groupId, empresaId, actorId, actorEmail, empresaAtual, hasPermission, filterInContext, windowMode = false }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(null);
  const [pendingConversion, setPendingConversion] = useState(null);
  const [conversion, setConversion] = useState({ tipo_operacao: 'ENTREGA', data_entrega_solicitada: '' });
  const [filters, setFilters] = useState({ search: '', status: 'TODOS', clienteEmpresaId: 'TODOS', validadeDe: '', validadeAte: '' });
  const [appliedFilters, setAppliedFilters] = useState({ search: '', status: 'TODOS', clienteEmpresaId: 'TODOS', validadeDe: '', validadeAte: '' });
  const canView = canUseOrcamentoAction(hasPermission, 'visualizar');
  const canCreate = canUseOrcamentoAction(hasPermission, 'criar');
  const canEdit = (row) => canUseOrcamentoAction(hasPermission, 'editar', row?.status);
  const canCancel = (row) => canUseOrcamentoAction(hasPermission, 'cancelar', row?.status);
  const contextReady = Boolean(groupId && empresaId && actorId);
  const http = useMemo(() => createHttpApiClient({
    getScope: () => ({ groupId, empresaId, actorId, actorEmail }),
  }), [groupId, empresaId, actorId, actorEmail]);
  const api = http.orcamentos;
  const pedidosApi = http.pedidos;
  const canConvert = hasPermission('Comercial', 'pedido', 'converter-pedido');
  const queryKey = ['orcamentos-http', groupId, empresaId, page, pageSize, appliedFilters];
  const listQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => api.list({ limit: pageSize, offset: (page - 1) * pageSize, search: appliedFilters.search || undefined, status: appliedFilters.status === 'TODOS' ? undefined : appliedFilters.status, clienteEmpresaId: appliedFilters.clienteEmpresaId === 'TODOS' ? undefined : appliedFilters.clienteEmpresaId, validadeDe: appliedFilters.validadeDe || undefined, validadeAte: appliedFilters.validadeAte || undefined, signal }),
    enabled: contextReady && canView,
    retry: 1,
  });
  const mastersQuery = useQuery({
    queryKey: ['orcamento-masters', groupId, empresaId],
    queryFn: async () => {
      const [clientesEmpresa, clientes, condicoes, produtos, unidades] = await Promise.all([
        filterInContext('ClienteEmpresa', { ativo: true, habilitado_operacao: true }, 'codigo', 500),
        filterInContext('Cliente', { ativo: true }, 'razao_social', 500),
        filterInContext('CondicaoPagamento', { ativo: true }, 'nome', 500),
        filterInContext('Produto', { ativo: true }, 'descricao', 500),
        filterInContext('UnidadeMedida', { ativo: true }, 'sigla', 500),
      ]);
      return { clientesEmpresa, clientes, condicoes, produtos, unidades };
    },
    enabled: contextReady && canView,
    staleTime: 30000,
  });
  const masters = mastersQuery.data || { clientesEmpresa: [], clientes: [], condicoes: [], produtos: [], unidades: [] };
  const clientesById = useMemo(() => new Map(masters.clientes.map((item) => [item.id, item])), [masters.clientes]);
  const clienteLabel = (linkId) => {
    const link = masters.clientesEmpresa.find((item) => item.id === linkId);
    const cliente = clientesById.get(link?.cliente_id);
    return cliente?.razao_social || cliente?.nome || cliente?.nome_fantasia || link?.codigo || linkId;
  };
  const condicaoLabel = (id) => masters.condicoes.find((item) => item.id === id)?.nome || id;

  useEffect(() => { setPage(1); setSelected(null); setDetailOpen(false); setFormOpen(false); setFilters({ search: '', status: 'TODOS', clienteEmpresaId: 'TODOS', validadeDe: '', validadeAte: '' }); setAppliedFilters({ search: '', status: 'TODOS', clienteEmpresaId: 'TODOS', validadeDe: '', validadeAte: '' }); }, [groupId, empresaId]);
  useEffect(() => {
    const warn = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const closeForm = () => {
    if (dirty && !window.confirm('Descartar as alterações deste orçamento?')) return;
    setFormOpen(false); setDirty(false); setEditing(null);
  };
  const openCreate = () => { setEditing(null); setForm(emptyForm()); setDirty(false); setFormOpen(true); };
  const openEdit = (row) => {
    if (!canEdit(row)) return;
    setEditing(row);
    setForm({
      cliente_empresa_id: row.cliente_empresa_id,
      condicao_pagamento_id: row.condicao_pagamento_id,
      validade_em: String(row.validade_em || '').slice(0, 10),
      observacoes: row.observacoes || '',
      itens: row.itens.map((item) => ({ produto_id: item.produto_id, unidade_id: item.unidade_id, descricao: item.descricao, unidade_sigla: item.unidade_sigla, quantidade: item.quantidade, preco_unitario: item.preco_unitario, desconto: item.desconto })),
    });
    setDirty(false); setDetailOpen(false); setFormOpen(true);
  };
  const changeForm = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setDirty(true); };
  const changeItem = (index, key, value) => {
    setForm((current) => ({ ...current, itens: current.itens.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
    setDirty(true);
  };
  const selectProduct = (index, produtoId) => {
    const produto = masters.produtos.find((item) => item.id === produtoId);
    const unidade = masters.unidades.find((item) => item.id === produto?.unidade_medida_id);
    setForm((current) => ({ ...current, itens: current.itens.map((item, i) => i === index ? {
      ...item, produto_id: produtoId, unidade_id: produto?.unidade_medida_id || '', descricao: produto?.descricao || produto?.nome || '', unidade_sigla: unidade?.sigla || '',
    } : item) }));
    setDirty(true);
  };
  const totals = useMemo(() => {
    try { const total = calculateTotals(form.itens); return { subtotal: microsToDecimal(total.subtotal), desconto: microsToDecimal(total.desconto), total: microsToDecimal(total.total) }; }
    catch { return { subtotal: '0', desconto: '0', total: '0' }; }
  }, [form.itens]);
  const save = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = buildOrcamentoPayload(form);
      const saved = editing ? await api.update(editing.id, payload) : await api.create(payload);
      toast.success(editing ? 'Orçamento atualizado.' : 'Orçamento criado.');
      setDirty(false); setFormOpen(false); setEditing(null); setSelected(saved);
      await queryClient.invalidateQueries({ queryKey: ['orcamentos-http', groupId, empresaId] });
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSubmitting(false); }
  };
  const showDetail = async (row) => {
    try { const detail = await api.get(row.id); setSelected(detail); setDetailOpen(true); }
    catch (error) { toast.error(errorMessage(error)); }
  };
  const performCancel = async (row) => {
    if (!row || submitting) return;
    setSubmitting(true);
    try {
      const cancelled = await api.cancel(row.id); setSelected(cancelled);
      toast.success('Orçamento cancelado e preservado.');
      await queryClient.invalidateQueries({ queryKey: ['orcamentos-http', groupId, empresaId] });
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSubmitting(false); }
  };
  const cancel = (row) => {
    if (!canCancel(row) || submitting) return;
    setPendingCancel(row);
  };
const convertToPedido = async () => {
    if (!pendingConversion || submitting) return;
    if (!conversion.data_entrega_solicitada) { toast.error('Informe a data solicitada pelo cliente.'); return; }
    setSubmitting(true);
    try {
      await pedidosApi.convertOrcamento(pendingConversion.id, { tipo_operacao: conversion.tipo_operacao, data_entrega_solicitada: new Date(`${conversion.data_entrega_solicitada}T12:00:00`).toISOString() });
      toast.success('Orçamento convertido em pedido.'); setPendingConversion(null); setDetailOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['pedidos-http', groupId, empresaId] });
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSubmitting(false); }
  };
  const printOrcamento = (row) => {
    const opened = gerarPDFOrcamento(row, { empresa: empresaAtual, clienteNome: clienteLabel(row.cliente_empresa_id), condicaoPagamento: condicaoLabel(row.condicao_pagamento_id) });
    if (!opened) toast.error('Permita a abertura da janela de impressão para gerar o PDF.');
  };
  const prepareShare = async (row, channel) => {
    const text = buildOrcamentoShareText(row, { empresaNome: empresaAtual?.razao_social || empresaAtual?.nome_fantasia || empresaAtual?.nome || 'Empresa', clienteNome: clienteLabel(row.cliente_empresa_id) });
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Texto para ${channel} copiado. Revise antes de enviar.`);
    } catch {
      toast.error('Não foi possível copiar o texto. Use a visualização de impressão.');
    }
  };

  if (!canView) return <div className="w-full h-full flex items-center justify-center p-6"><Alert className="max-w-lg"><AlertCircle className="h-4 w-4" /><AlertDescription>Acesso negado aos Orçamentos.</AlertDescription></Alert></div>;
  const rows = listQuery.data?.data || [];
  const meta = listQuery.data?.meta || { total: 0 };
  return <div className={`w-full h-full flex flex-col bg-slate-50 ${windowMode ? 'p-3' : 'p-4'}`} data-permission="Comercial.orcamento.visualizar">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
      <div><h2 className="text-xl font-semibold">Orçamentos</h2><p className="text-sm text-slate-500">Propostas comerciais da empresa ativa</p></div>
      {canCreate && <Button onClick={openCreate} disabled={!contextReady} data-permission="Comercial.orcamento.criar"><FilePlus2 className="w-4 h-4 mr-2" />Novo orçamento</Button>}
    </div>
    {!contextReady && <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Selecione uma empresa e entre com um usuário válido.</AlertDescription></Alert>}
    <form className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3" onSubmit={(event) => { event.preventDefault(); setPage(1); setAppliedFilters(filters); }}>
      <div className="md:col-span-2"><Label htmlFor="orc-search" className="sr-only">Pesquisar número</Label><Input id="orc-search" value={filters.search} maxLength={80} placeholder="Pesquisar número" onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></div>
      <Select value={filters.status} onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}><SelectTrigger aria-label="Filtrar status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os status</SelectItem><SelectItem value="EM_ABERTO">Em aberto</SelectItem><SelectItem value="CANCELADO">Cancelado</SelectItem></SelectContent></Select>
      <Select value={filters.clienteEmpresaId} onValueChange={(value) => setFilters((current) => ({ ...current, clienteEmpresaId: value }))}><SelectTrigger aria-label="Filtrar cliente"><SelectValue placeholder="Todos os clientes" /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os clientes</SelectItem>{masters.clientesEmpresa.map((item) => <SelectItem key={item.id} value={item.id}>{clienteLabel(item.id)}</SelectItem>)}</SelectContent></Select>
      <div className="grid grid-cols-2 gap-2"><Input aria-label="Validade inicial" type="date" value={filters.validadeDe} onChange={(event) => setFilters((current) => ({ ...current, validadeDe: event.target.value }))} /><Input aria-label="Validade final" type="date" value={filters.validadeAte} onChange={(event) => setFilters((current) => ({ ...current, validadeAte: event.target.value }))} /></div>
      <div className="flex gap-2"><Button type="submit" variant="outline" className="flex-1"><Search className="w-4 h-4 mr-2" />Filtrar</Button><Button type="button" size="icon" variant="ghost" title="Limpar filtros" onClick={() => { const clean = { search: '', status: 'TODOS', clienteEmpresaId: 'TODOS', validadeDe: '', validadeAte: '' }; setFilters(clean); setAppliedFilters(clean); setPage(1); }}><RefreshCw className="w-4 h-4" /></Button></div>
    </form>
    {listQuery.isLoading ? <div className="flex-1 flex items-center justify-center">Carregando orçamentos...</div> : listQuery.isError ? <div className="flex-1 flex flex-col items-center justify-center gap-3"><p>{errorMessage(listQuery.error)}</p><Button variant="outline" onClick={() => listQuery.refetch()}><RefreshCw className="w-4 h-4 mr-2" />Tentar novamente</Button></div> : rows.length === 0 ? <div className="flex-1 flex flex-col items-center justify-center text-slate-500"><FilePlus2 className="w-10 h-10 mb-2" /><p>Nenhum orçamento encontrado para os filtros desta empresa.</p></div> : <div className="flex-1 min-h-0 overflow-auto border bg-white rounded-md">
      <Table><TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Cliente</TableHead><TableHead>Criado</TableHead><TableHead>Validade</TableHead><TableHead>Itens</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead className="text-right">Desconto</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell className="font-mono">{row.numero}</TableCell><TableCell>{clienteLabel(row.cliente_empresa_id)}</TableCell><TableCell>{date(row.created_at)}</TableCell><TableCell>{date(row.validade_em)}</TableCell><TableCell>{row.itens?.length || 0}</TableCell><TableCell className="text-right">{money(row.subtotal)}</TableCell><TableCell className="text-right">{money(row.desconto)}</TableCell><TableCell className="text-right font-semibold">{money(row.total)}</TableCell><TableCell><Badge variant={row.status === 'EM_ABERTO' ? 'default' : 'secondary'}>{row.status === 'EM_ABERTO' ? 'Em aberto' : 'Cancelado'}</Badge></TableCell><TableCell><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" title="Visualizar" onClick={() => showDetail(row)}><Eye className="w-4 h-4" /></Button>{canEdit(row) && <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(row)}><Pencil className="w-4 h-4" /></Button>}{canCancel(row) && <Button size="icon" variant="ghost" title="Cancelar" onClick={() => cancel(row)}><XCircle className="w-4 h-4" /></Button>}</div></TableCell></TableRow>)}</TableBody></Table>
    </div>}
    <PaginationControls currentPage={page} totalItems={meta.total || 0} itemsPerPage={pageSize} onPageChange={setPage} onItemsPerPageChange={setPageSize} isLoading={listQuery.isFetching} />

    <Dialog open={formOpen} onOpenChange={(open) => { if (!open) closeForm(); }}><DialogContent className="w-[96vw] max-w-6xl max-h-[92vh] overflow-auto"><DialogHeader><DialogTitle>{editing ? `Editar orçamento ${editing.numero}` : 'Novo orçamento'}</DialogTitle><DialogDescription>Os totais serão conferidos novamente pelo servidor.</DialogDescription></DialogHeader>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3"><div className="md:col-span-2"><Label htmlFor="orc-cliente">Cliente</Label><Select value={form.cliente_empresa_id} onValueChange={(v) => changeForm('cliente_empresa_id', v)}><SelectTrigger id="orc-cliente"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{masters.clientesEmpresa.filter((item) => item.ativo !== false && item.habilitado_operacao !== false && item.bloqueado !== true).map((item) => <SelectItem key={item.id} value={item.id}>{clienteLabel(item.id)}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="orc-condicao">Condição de pagamento</Label><Select value={form.condicao_pagamento_id} onValueChange={(v) => changeForm('condicao_pagamento_id', v)}><SelectTrigger id="orc-condicao"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{masters.condicoes.filter((item) => item.ativo !== false).map((item) => <SelectItem key={item.id} value={item.id}>{item.nome || item.codigo}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="orc-validade">Validade</Label><Input id="orc-validade" type="date" value={form.validade_em} onChange={(e) => changeForm('validade_em', e.target.value)} /></div><div className="md:col-span-4"><Label htmlFor="orc-observacoes">Observações</Label><Textarea id="orc-observacoes" value={form.observacoes} onChange={(e) => changeForm('observacoes', e.target.value)} /></div></div>
      <div className="space-y-2"><div className="flex justify-between"><h3 className="font-semibold">Itens</h3><Button type="button" variant="outline" size="sm" onClick={() => changeForm('itens', [...form.itens, emptyItem()])}><Plus className="w-4 h-4 mr-1" />Item</Button></div>{form.itens.map((item, index) => { let itemTotals = { subtotal: '0', total: '0' }; try { itemTotals = calculateItem(item); } catch { itemTotals = { subtotal: '0', total: '0' }; } return <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 border rounded-md p-2"><div className="md:col-span-3"><Label>Produto</Label><Select value={item.produto_id} onValueChange={(v) => selectProduct(index, v)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{masters.produtos.filter((p) => p.ativo !== false).map((p) => <SelectItem key={p.id} value={p.id}>{p.codigo ? `${p.codigo} - ` : ''}{p.descricao || p.nome}</SelectItem>)}</SelectContent></Select></div><div className="md:col-span-3"><Label>Descrição</Label><Input value={item.descricao} onChange={(e) => changeItem(index, 'descricao', e.target.value)} /></div><div><Label>Unidade</Label><Input value={item.unidade_sigla} readOnly /></div><div><Label>Quantidade</Label><Input inputMode="decimal" value={item.quantidade} onChange={(e) => changeItem(index, 'quantidade', e.target.value)} /></div><div><Label>Preço</Label><Input inputMode="decimal" value={item.preco_unitario} onChange={(e) => changeItem(index, 'preco_unitario', e.target.value)} /></div><div><Label>Desconto</Label><Input inputMode="decimal" value={item.desconto} onChange={(e) => changeItem(index, 'desconto', e.target.value)} /></div><div><Label>Total</Label><div className="h-10 flex items-center font-medium">{money(itemTotals.total)}</div></div><div className="flex items-end"><Button type="button" size="icon" variant="ghost" title="Remover item" disabled={form.itens.length === 1} onClick={() => changeForm('itens', form.itens.filter((_, i) => i !== index))}><Trash2 className="w-4 h-4" /></Button></div></div>; })}</div>
      <div className="flex justify-end gap-5 text-sm"><span>Subtotal: <strong>{money(totals.subtotal)}</strong></span><span>Desconto: <strong>{money(totals.desconto)}</strong></span><span>Total: <strong>{money(totals.total)}</strong></span></div>
      <DialogFooter><Button variant="outline" onClick={closeForm}>Fechar</Button><Button onClick={save} disabled={submitting || mastersQuery.isLoading}>{submitting ? 'Salvando...' : 'Salvar orçamento'}</Button></DialogFooter>
    </DialogContent></Dialog>

    <Dialog open={detailOpen} onOpenChange={setDetailOpen}><DialogContent className="max-w-4xl max-h-[90vh] overflow-auto"><DialogHeader><DialogTitle>Orçamento {selected?.numero}</DialogTitle><DialogDescription>{selected?.status === 'EM_ABERTO' ? 'Em aberto' : 'Cancelado'} · validade {date(selected?.validade_em)}</DialogDescription></DialogHeader>{selected && <div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm"><div><span className="text-slate-500">Cliente</span><p>{clienteLabel(selected.cliente_empresa_id)}</p></div><div><span className="text-slate-500">Condição</span><p>{condicaoLabel(selected.condicao_pagamento_id)}</p></div><div><span className="text-slate-500">Criado</span><p>{date(selected.created_at)}</p></div><div><span className="text-slate-500">Atualizado</span><p>{date(selected.updated_at)}</p></div></div><p className="text-sm whitespace-pre-wrap">{selected.observacoes || 'Sem observações.'}</p><Table><TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Un.</TableHead><TableHead className="text-right">Qtd.</TableHead><TableHead className="text-right">Preço</TableHead><TableHead className="text-right">Desconto</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>{selected.itens.map((item) => <TableRow key={item.id}><TableCell>{item.descricao}</TableCell><TableCell>{item.unidade_sigla}</TableCell><TableCell className="text-right">{item.quantidade}</TableCell><TableCell className="text-right">{money(item.preco_unitario)}</TableCell><TableCell className="text-right">{money(item.desconto)}</TableCell><TableCell className="text-right">{money(item.total)}</TableCell></TableRow>)}</TableBody></Table><div className="flex justify-end gap-5"><span>Subtotal: <strong>{money(selected.subtotal)}</strong></span><span>Desconto: <strong>{money(selected.desconto)}</strong></span><span>Total: <strong>{money(selected.total)}</strong></span></div></div>}<DialogFooter className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => printOrcamento(selected)}><Printer className="w-4 h-4 mr-2" />Imprimir/PDF</Button><Button variant="outline" title="Preparar texto para WhatsApp" onClick={() => prepareShare(selected, 'WhatsApp')}><MessageCircle className="w-4 h-4 mr-2" />WhatsApp</Button><Button variant="outline" title="Preparar texto para e-mail" onClick={() => prepareShare(selected, 'e-mail')}><Mail className="w-4 h-4 mr-2" />E-mail</Button>{canConvert && selected?.status === 'EM_ABERTO' && <Button onClick={() => { setConversion({ tipo_operacao: 'ENTREGA', data_entrega_solicitada: '' }); setPendingConversion(selected); }}><FilePlus2 className="w-4 h-4 mr-2" />Converter em pedido</Button>}{canEdit(selected) && <Button variant="outline" onClick={() => openEdit(selected)}><Pencil className="w-4 h-4 mr-2" />Editar</Button>}{canCancel(selected) && <Button variant="destructive" onClick={() => cancel(selected)} disabled={submitting}><XCircle className="w-4 h-4 mr-2" />Cancelar orçamento</Button>}</DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(pendingConversion)} onOpenChange={(open) => { if (!open && !submitting) setPendingConversion(null); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Converter em pedido</DialogTitle><DialogDescription>O orçamento original será preservado e vinculado ao novo pedido.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Operação</Label><Select value={conversion.tipo_operacao} onValueChange={(value) => setConversion((current) => ({ ...current, tipo_operacao: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ENTREGA">Entrega</SelectItem><SelectItem value="RETIRADA">Retirada</SelectItem></SelectContent></Select></div><div><Label>Data solicitada pelo cliente</Label><Input type="date" value={conversion.data_entrega_solicitada} onChange={(event) => setConversion((current) => ({ ...current, data_entrega_solicitada: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setPendingConversion(null)} disabled={submitting}>Voltar</Button><Button onClick={convertToPedido} disabled={submitting}>{submitting ? 'Convertendo...' : 'Criar pedido'}</Button></DialogFooter></DialogContent></Dialog>    <ConfirmDialog
      open={Boolean(pendingCancel)}
      onOpenChange={(open) => { if (!open) setPendingCancel(null); }}
      onConfirm={() => { const row = pendingCancel; setPendingCancel(null); void performCancel(row); }}
      title="Cancelar orçamento?"
      description="O registro e seus itens serão preservados, mas não poderão mais ser editados."
      confirmText="Cancelar orçamento"
      variant="warning"
    />
  </div>;
}
