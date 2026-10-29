import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Eye, Mail, MessageCircle, Pencil, Plus, Printer, RefreshCw, Search, ShoppingCart, Trash2, XCircle } from 'lucide-react';
import { gerarPDFPedido } from '@/components/lib/exportacaoPDF';
import { createHttpApiClient, central360SessionKey } from '@/api/httpApiClient';
import { readErpHttpSession } from '@/api/erpHttpSession';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PaginationControls from '@/components/ui/PaginationControls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  buildPedidoPayload,
  clearPedidoCreateIntentKey,
  getOrCreatePedidoIntentKey,
  recoverPedidoCreateIntentAfterConflict,
  buildPedidoShareText,
  calculatePedidoTotals,
  canUsePedidoAction,
  createPedidoDetailGate,
  sharedPedidoMutationGate,
  clampPedidoCancelMotivo,
  evaluatePedidoCancelMotivoUiGate,
  evaluatePedidoPrintPdfUiGate,
  evaluatePedidoShareUiGate,
  evaluatePedidoStatusMotivoUiGate,
  evaluatePedidoStatusTransitionUiGate,
  isPedidoCancelDisabled,
  mapPedidoRowToForm,
  nextPedidoStatus,
  PEDIDO_CANCEL_MOTIVO_MAX,
  PEDIDO_STATUS_LABELS,
  resolvePedidoHistoryUiState,
  explainPedidoPersistenceError,
} from './pedidoUiPolicy';
import {
  clienteEmpresaPickerLabel,
  filterClienteEmpresaOptions,
  filterProdutoOptions,
  resolveComercialMasterPages,
  resolveComercialSelectedCliente,
  mergeComercialSelectedCliente,
  unionComercialClienteCatalog,
  resolveComercialAuxiliaryView,
  produtoPickerLabel,
} from './comercialMasterPicker';
import { isCanonicalPedidoId } from './centralCliente360Navigation';

const emptyItem = () => ({ produto_id:'', unidade_id:'', descricao:'', unidade_sigla:'', quantidade:'1', preco_unitario:'0', desconto:'0', requer_producao:false });
const emptyForm = () => ({ cliente_empresa_id:'', cliente_local_id:'', obra_id:'', tabela_preco_id:'', condicao_pagamento_id:'', tipo_operacao:'ENTREGA', data_entrega_solicitada:'', observacoes:'', itens:[emptyItem()] });
const money = (value) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value||0));
const date = (value) => value ? new Intl.DateTimeFormat('pt-BR').format(new Date(value)) : '-';
const message = (error) => explainPedidoPersistenceError(error)
  || (error?.status===403?'Seu perfil não possui permissão para esta ação.':error?.status===404?'Pedido não encontrado neste contexto.':error?.status===409?'O estado atual não permite esta ação.':error?.body?.error?.message||error?.message||'Não foi possível concluir a operação.');

export default function PedidoCanonicoPanel({ groupId, empresaId, actorId, actorEmail, sessionToken, hasPermission, filterInContext, windowMode=false, empresaAtual=null, initialSelectedId=null, reopenRequestId=null, initialCreateClienteEmpresaId=null, createRequestId=null }) {
  const queryClient=useQueryClient();
  const detailGate=useRef(createPedidoDetailGate());
  const initialOpened=useRef(null);
  const initialCreateOpened=useRef(null);
  const mutationGate=useRef(sharedPedidoMutationGate);
  const renderedScope=useRef(null);
  renderedScope.current={groupId,empresaId,actorId};
  const activeScope=()=>readErpHttpSession();
  const sessionIdentity=sessionToken||readErpHttpSession()?.token||null;
  const sessionCacheKey=central360SessionKey(sessionIdentity);
  const [page,setPage]=useState(1);
  const [pageSize,setPageSize]=useState(20);
  const [selected,setSelected]=useState(null);
  const [form,setForm]=useState(emptyForm);
  const [createKey,setCreateKey]=useState(null);
  const intentStorage=()=>{try{return window.sessionStorage;}catch{return null;}};
  const [editing,setEditing]=useState(null);
  const [formOpen,setFormOpen]=useState(false);
  const [detailOpen,setDetailOpen]=useState(false);
  const [history,setHistory]=useState([]);
  const [historyLoading,setHistoryLoading]=useState(false);
  const [historyError,setHistoryError]=useState(null);
  const [dirty,setDirty]=useState(false);
  const [busy,setBusy]=useState(false);
  const [pendingCancel,setPendingCancel]=useState(null);
  const [cancelMotivo,setCancelMotivo]=useState('');
  const [pendingTransition,setPendingTransition]=useState(null);
  const [statusMotivo,setStatusMotivo]=useState('');
  const [filters,setFilters]=useState({search:'',status:'TODOS',clienteEmpresaId:'TODOS',tipoOperacao:'TODOS'});
  const [applied,setApplied]=useState(filters);
  const [clienteQuery,setClienteQuery]=useState('');
  const [produtoQuery,setProdutoQuery]=useState('');
  const canView=canUsePedidoAction(hasPermission,'visualizar');
  const canCreate=canUsePedidoAction(hasPermission,'criar');
  const canEdit=(row)=>canUsePedidoAction(hasPermission,'editar',row?.status);
  const canCancel=(row)=>canUsePedidoAction(hasPermission,'cancelar',row?.status);
  const canTransition=canUsePedidoAction(hasPermission,'alterar-status');
  const canPrint=canUsePedidoAction(hasPermission,'imprimir') || canUsePedidoAction(hasPermission,'visualizar');
  const canShare=canUsePedidoAction(hasPermission,'compartilhar') || canUsePedidoAction(hasPermission,'visualizar');
  const ready=Boolean(groupId&&empresaId&&actorId);
  const http=useMemo(()=>createHttpApiClient({getScope:()=>({groupId,empresaId,actorId,actorEmail,token:sessionIdentity})}),[groupId,empresaId,actorId,actorEmail,sessionIdentity]);
  const api=http.pedidos;
  const list=useQuery({queryKey:['pedidos-http',groupId,empresaId,actorId,sessionIdentity,page,pageSize,applied],queryFn:({signal})=>api.list({limit:pageSize,offset:(page-1)*pageSize,search:applied.search||undefined,status:applied.status==='TODOS'?undefined:applied.status,clienteEmpresaId:applied.clienteEmpresaId==='TODOS'?undefined:applied.clienteEmpresaId,tipoOperacao:applied.tipoOperacao==='TODOS'?undefined:applied.tipoOperacao,signal}),enabled:ready&&canView,retry:1});
  const master=useQuery({
    queryKey:['pedido-masters',groupId,empresaId,actorId,sessionCacheKey,clienteQuery,produtoQuery],
    queryFn:async({signal})=>resolveComercialMasterPages(await http.comercialMasters.list({
      clienteSearch:clienteQuery.trim(),produtoSearch:produtoQuery.trim(),signal,
    }),{groupId,empresaId}),
    enabled:ready&&canView,staleTime:30000,retry:false,
  });
  const coreMasters=master.data||{clientesEmpresa:[],clientes:[],condicoes:[],produtos:[],unidades:[],tabelas:[]};
  const selectedCliente=useQuery({
    queryKey:['pedido-selected-cliente',groupId,empresaId,actorId,sessionCacheKey,form.cliente_empresa_id],
    queryFn:async({signal})=>resolveComercialSelectedCliente(await http.comercialMasters.resolveClienteEmpresa({
      clienteEmpresaId:form.cliente_empresa_id,signal,
    }),{groupId,empresaId},form.cliente_empresa_id),
    enabled:ready&&canView&&formOpen&&isCanonicalPedidoId(form.cliente_empresa_id),
    staleTime:30000,retry:false,
  });
  const listRows=list.data?.data||[];
  const [clienteCatalog,setClienteCatalog]=useState({clientes:[],clientesEmpresa:[]});
  const neededClienteEmpresaIds=useMemo(()=>{
    const ids=new Set();
    for(const row of listRows){if(row?.cliente_empresa_id)ids.add(row.cliente_empresa_id);}
    if(selected?.cliente_empresa_id)ids.add(selected.cliente_empresa_id);
    if(form.cliente_empresa_id)ids.add(form.cliente_empresa_id);
    return [...ids].filter((id)=>isCanonicalPedidoId(id));
  },[listRows,selected?.cliente_empresa_id,form.cliente_empresa_id]);
  // Lote limitado; hidratação acumulada em clienteCatalog avança a fila (P2).
  const missingClienteEmpresaIds=useMemo(()=>{
    const known=new Set((clienteCatalog.clientesEmpresa||[]).map((link)=>link.id));
    for(const link of coreMasters.clientesEmpresa||[])known.add(link.id);
    if(selectedCliente.data?.clientesEmpresa?.[0]?.id)known.add(selectedCliente.data.clientesEmpresa[0].id);
    return neededClienteEmpresaIds.filter((id)=>!known.has(id)).slice(0,20);
  },[neededClienteEmpresaIds,clienteCatalog.clientesEmpresa,coreMasters.clientesEmpresa,selectedCliente.data]);
  const rowClienteQueries=useQueries({
    queries:missingClienteEmpresaIds.map((clienteEmpresaId)=>({
      queryKey:['pedido-row-cliente',groupId,empresaId,actorId,sessionCacheKey,clienteEmpresaId],
      queryFn:async({signal})=>resolveComercialSelectedCliente(await http.comercialMasters.resolveClienteEmpresa({
        clienteEmpresaId,signal,
      }),{groupId,empresaId},clienteEmpresaId),
      enabled:ready&&canView&&isCanonicalPedidoId(clienteEmpresaId),
      staleTime:60000,retry:false,
    })),
  });
  const rowHydrationKey=rowClienteQueries.map((q)=>q.data?.clientesEmpresa?.[0]?.id).filter(Boolean).sort().join(',');
  useEffect(()=>{setClienteCatalog({clientes:[],clientesEmpresa:[]});},[groupId,empresaId,actorId,sessionIdentity]);
  useEffect(()=>{if(master.data)setClienteCatalog((prev)=>unionComercialClienteCatalog(prev,master.data));},[master.data]);
  useEffect(()=>{if(selectedCliente.data)setClienteCatalog((prev)=>mergeComercialSelectedCliente(prev,selectedCliente.data));},[selectedCliente.data]);
  useEffect(()=>{
    if(!rowHydrationKey)return undefined;
    setClienteCatalog((prev)=>{
      let next=prev;
      for(const query of rowClienteQueries){if(query.data)next=mergeComercialSelectedCliente(next,query.data);}
      return next;
    });
    return undefined;
  },[rowHydrationKey]);
  const selectedClienteId=selectedCliente.data?.clientesEmpresa[0]?.cliente_id;
  const auxiliary=useQuery({
    queryKey:['pedido-auxiliary',groupId,empresaId,actorId,sessionCacheKey,selectedClienteId,form.cliente_empresa_id],
    queryFn:async({signal})=>{
      if(!selectedClienteId)throw new Error('COMERCIAL_CLIENTE_EMPRESA_REQUIRED');
      return resolveComercialAuxiliaryView(await http.clientes.central360(selectedClienteId,{
        empresasLimit:1,locaisLimit:200,obrasLimit:200,pedidosLimit:1,orcamentosLimit:1,crmLimit:1,signal,
      }),{groupId,empresaId},selectedClienteId,form.cliente_empresa_id);
    },
    enabled:ready&&canView&&Boolean(selectedClienteId),staleTime:30000,retry:false,
  });
  const masters=useMemo(()=>{
    let next={...coreMasters,clientes:clienteCatalog.clientes,clientesEmpresa:clienteCatalog.clientesEmpresa};
    next=mergeComercialSelectedCliente(next,selectedCliente.data);
    for(const query of rowClienteQueries){if(query.data)next=mergeComercialSelectedCliente(next,query.data);}
    next=unionComercialClienteCatalog(next,coreMasters);
    return {...next,locais:auxiliary.data?.locais||[],obras:auxiliary.data?.obras||[]};
  },[coreMasters,clienteCatalog,selectedCliente.data,rowClienteQueries,auxiliary.data]);
  const mastersReady=Boolean(master.data&&!master.isError&&!master.isFetching&&selectedClienteId
    &&selectedCliente.data&&!selectedCliente.isError&&!selectedCliente.isFetching
    &&auxiliary.data&&!auxiliary.isError&&!auxiliary.isFetching);
  const clients=useMemo(()=>new Map(masters.clientes.map(x=>[x.id,x])),[masters.clientes]);
  const clientLabel=(id)=>{const link=masters.clientesEmpresa.find(x=>x.id===id);return clienteEmpresaPickerLabel(link, clients.get(link?.cliente_id))||id;};
  const clienteOptions=useMemo(()=>filterClienteEmpresaOptions(masters.clientesEmpresa, clients, clienteQuery,form.cliente_empresa_id),[masters.clientesEmpresa, clients, clienteQuery,form.cliente_empresa_id]);
  const produtoOptions=useMemo(()=>filterProdutoOptions(masters.produtos, produtoQuery),[masters.produtos, produtoQuery]);
  useEffect(()=>{detailGate.current.invalidate();setPage(1);setSelected(null);setFormOpen(false);setDetailOpen(false);setCreateKey(null);setHistory([]);setHistoryLoading(false);setHistoryError(null);setBusy(mutationGate.current.isPending({groupId,empresaId,actorId}));setPendingCancel(null);setCancelMotivo('');setPendingTransition(null);setStatusMotivo('');setFilters({search:'',status:'TODOS',clienteEmpresaId:'TODOS',tipoOperacao:'TODOS'});setApplied({search:'',status:'TODOS',clienteEmpresaId:'TODOS',tipoOperacao:'TODOS'});},[groupId,empresaId,actorId]);
  useEffect(()=>mutationGate.current.subscribe(()=>setBusy(mutationGate.current.isPending({groupId,empresaId,actorId}))),[groupId,empresaId,actorId]);
  useEffect(()=>{const warn=(e)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  const change=(key,value)=>{setForm(current=>({...current,[key]:value}));setDirty(true);};
  const changeItem=(index,key,value)=>{setForm(current=>({...current,itens:current.itens.map((row,i)=>i===index?{...row,[key]:value}:row)}));setDirty(true);};
  const selectProduct=(index,id)=>{const product=masters.produtos.find(x=>x.id===id);const unit=masters.unidades.find(x=>x.id===product?.unidade_medida_id);setForm(current=>({...current,itens:current.itens.map((row,i)=>i===index?{...row,produto_id:id,unidade_id:product?.unidade_medida_id||'',descricao:product?.descricao||product?.nome||'',unidade_sigla:unit?.sigla||''}:row)}));setDirty(true);};
  const close=()=>{if(dirty&&!window.confirm('Descartar as alterações deste pedido?'))return;setFormOpen(false);setDirty(false);setEditing(null);};
  const openCreate=()=>{if(mutationGate.current.isPending(renderedScope.current)){toast.error('Aguarde a confirmação do Pedido pendente neste contexto.');return;}const key=getOrCreatePedidoIntentKey(renderedScope.current,intentStorage(),()=>window.crypto.randomUUID());if(!key){toast.error('Sessão indisponível para criar Pedido com retry seguro.');return;}setCreateKey(key);setEditing(null);setForm(emptyForm());setDirty(false);setFormOpen(true);};
  const openEdit=(row)=>{if(!canEdit(row))return;setEditing(row);setForm(mapPedidoRowToForm(row));setDirty(false);setDetailOpen(false);setFormOpen(true);};
  const refreshConflictScope=async(ticket,scope)=>{if(!canView||!detailGate.current.isCurrent(ticket,renderedScope.current,activeScope()))throw new Error('PEDIDO_CONTEXT_CHANGED');await api.list({limit:1,offset:0});if(!detailGate.current.isCurrent(ticket,renderedScope.current,activeScope()))throw new Error('PEDIDO_CONTEXT_CHANGED');await queryClient.invalidateQueries({queryKey:['pedidos-http',scope.groupId,scope.empresaId,scope.actorId],refetchType:'all'},{throwOnError:true});if(!detailGate.current.isCurrent(ticket,renderedScope.current,activeScope()))throw new Error('PEDIDO_CONTEXT_CHANGED');};
  const save=async()=>{if(busy)return;if(!mastersReady){toast.error(master.error?.message||auxiliary.error?.message||'Aguarde os cadastros canonicos do cliente antes de salvar.');return;}if(!editing&&!createKey){toast.error('Chave da intenção indisponível. Reabra o formulário antes de criar.');return;}const mutation=mutationGate.current.begin(renderedScope.current);if(!mutation)return;const ticket=detailGate.current.begin(renderedScope.current,renderedScope.current,activeScope());if(!ticket){mutationGate.current.end(mutation);return;}setBusy(true);try{const payload=buildPedidoPayload(form,editing?undefined:createKey);const saved=editing?await api.update(editing.id,payload):await api.create(payload);if(!editing)clearPedidoCreateIntentKey(ticket.scope,intentStorage(),createKey);await queryClient.invalidateQueries({queryKey:['pedidos-http',groupId,empresaId,actorId]});if(!detailGate.current.isCurrent(ticket,renderedScope.current,activeScope())){toast.error('Contexto alterado. O Pedido foi salvo no contexto original; consulte o registro antes de repetir.');return;}if(!editing)setCreateKey(null);toast.success(editing?'Pedido atualizado.':'Pedido criado.');setSelected(saved);setDirty(false);setFormOpen(false);setEditing(null);}catch(error){if(!editing&&error?.code==='PEDIDO_IDEMPOTENCY_CONFLICT'){let next;try{next=await recoverPedidoCreateIntentAfterConflict(ticket.scope,intentStorage(),createKey,()=>window.crypto.randomUUID(),scope=>refreshConflictScope(ticket,scope));}catch{toast.error('Não foi possível consultar os Pedidos no contexto original. Retorne a ele antes de tentar novamente.');return;}if(detailGate.current.isCurrent(ticket,renderedScope.current,activeScope())){setCreateKey(next);toast.error('Esta chave já pertence a outro Pedido. Consulte a listagem antes de confirmar um novo; o formulário foi preservado.');}else toast.error('Contexto alterado. Consulte o Pedido original antes de repetir.');return;}if(detailGate.current.isCurrent(ticket,renderedScope.current,activeScope()))toast.error(message(error));else toast.error('Contexto alterado. Consulte o Pedido antes de repetir.');}finally{mutationGate.current.end(mutation);setBusy(mutationGate.current.isPending(renderedScope.current));}};
  const loadHistory=async(pedidoId,openedTicket)=>{const ticket=openedTicket||detailGate.current.begin(renderedScope.current,renderedScope.current,activeScope());if(!ticket)return;setHistoryLoading(true);setHistoryError(null);try{const events=await api.history(pedidoId);if(!detailGate.current.isCurrent(ticket,renderedScope.current,activeScope()))return;setHistory(Array.isArray(events)?events:[]);setHistoryError(null);}catch(error){if(!detailGate.current.isCurrent(ticket,renderedScope.current,activeScope()))return;setHistory([]);setHistoryError(error);toast.error(message(error)||'Falha ao carregar histórico.');}finally{if(detailGate.current.isCurrent(ticket,renderedScope.current,activeScope()))setHistoryLoading(false);}};
  const show=async(row)=>{const ticket=detailGate.current.begin(renderedScope.current,renderedScope.current,activeScope());if(!ticket||!canView)return;try{setHistoryLoading(true);setHistoryError(null);setHistory([]);const detail=await api.get(row.id);if(!detailGate.current.isCurrent(ticket,renderedScope.current,activeScope()))return;setSelected(detail);setDetailOpen(true);await loadHistory(row.id,ticket);}catch(error){if(!detailGate.current.isCurrent(ticket,renderedScope.current,activeScope()))return;setHistoryLoading(false);toast.error(message(error));}};
  const initialToken=activeScope()?.token;
  useEffect(()=>{const active=activeScope();if(!ready||!canView||!isCanonicalPedidoId(initialSelectedId)||!active?.token||active.groupId!==groupId||active.empresaId!==empresaId||active.actorId!==actorId)return;const marker=JSON.stringify([groupId,empresaId,actorId,initialSelectedId,active.token,reopenRequestId]);if(initialOpened.current===marker)return;initialOpened.current=marker;void show({id:initialSelectedId});},[initialSelectedId,groupId,empresaId,actorId,initialToken,reopenRequestId,canView,ready]);
  // Central 360 → Novo pedido: reusa openCreate + vínculo da empresa ativa.
  useEffect(()=>{
    if(!ready||!canCreate||!isCanonicalPedidoId(initialCreateClienteEmpresaId))return;
    const active=activeScope();
    if(!active?.token||active.groupId!==groupId||active.empresaId!==empresaId||active.actorId!==actorId)return;
    const marker=JSON.stringify([groupId,empresaId,actorId,initialCreateClienteEmpresaId,active.token,createRequestId]);
    if(initialCreateOpened.current===marker)return;
    if(formOpen&&dirty)return;
    if(mutationGate.current.isPending(renderedScope.current))return;
    const key=getOrCreatePedidoIntentKey(renderedScope.current,intentStorage(),()=>window.crypto.randomUUID());
    if(!key)return;
    initialCreateOpened.current=marker;
    setCreateKey(key);
    setEditing(null);
    setForm({...emptyForm(),cliente_empresa_id:initialCreateClienteEmpresaId});
    setDirty(false);
    setDetailOpen(false);
    setFormOpen(true);
  },[initialCreateClienteEmpresaId,createRequestId,groupId,empresaId,actorId,initialToken,canCreate,ready,formOpen,dirty]);
  const requestTransition=(row)=>{const gate=evaluatePedidoStatusTransitionUiGate({row,groupId,empresaId,canTransition});if(gate.blockTransition){toast.error(gate.hint||'Alteração de status bloqueada (fail-closed).');return;}if(busy)return;setStatusMotivo('');setPendingTransition({row,target:gate.target});};
  const transition=async(row,target,motivo)=>{if(!row||!target||busy)return;const motivoGate=evaluatePedidoStatusMotivoUiGate(motivo);if(motivoGate.blockConfirm){toast.error(motivoGate.hint||'Motivo inválido.');return;}const mutation=mutationGate.current.begin(renderedScope.current);if(!mutation)return;const ticket=detailGate.current.begin(renderedScope.current,renderedScope.current,activeScope());if(!ticket){mutationGate.current.end(mutation);return;}setBusy(true);try{const updated=await api.transition(row.id,target,motivoGate.motivo||undefined);await queryClient.invalidateQueries({queryKey:['pedidos-http',groupId,empresaId]});if(!detailGate.current.isCurrent(ticket,renderedScope.current,activeScope())){toast.error('Contexto alterado. O status pode ter mudado; consulte o Pedido antes de repetir.');return;}setSelected(updated);await loadHistory(row.id,ticket);if(detailGate.current.isCurrent(ticket,renderedScope.current,activeScope()))toast.success(`Pedido movido para ${PEDIDO_STATUS_LABELS[target]}.`);}catch(error){if(detailGate.current.isCurrent(ticket,renderedScope.current,activeScope()))toast.error(message(error));else toast.error('Contexto alterado. Consulte o Pedido antes de repetir.');}finally{mutationGate.current.end(mutation);setBusy(mutationGate.current.isPending(renderedScope.current));}};
  const requestCancel=(row)=>{if(!row||isPedidoCancelDisabled(hasPermission,row.status)){toast.error('Cancelamento bloqueado (fail-closed).');return;}setCancelMotivo('');setPendingCancel(row);};
  const cancel=async(row,motivo)=>{if(!row||!canCancel(row)||busy)return;const gate=evaluatePedidoCancelMotivoUiGate(motivo);if(gate.blockConfirm){toast.error(gate.hint||'Informe o motivo do cancelamento.');return;}const mutation=mutationGate.current.begin(renderedScope.current);if(!mutation)return;const ticket=detailGate.current.begin(renderedScope.current,renderedScope.current,activeScope());if(!ticket){mutationGate.current.end(mutation);return;}setBusy(true);try{const updated=await api.cancel(row.id,gate.motivo);await queryClient.invalidateQueries({queryKey:['pedidos-http',groupId,empresaId]});if(!detailGate.current.isCurrent(ticket,renderedScope.current,activeScope())){toast.error('Contexto alterado. O Pedido pode ter sido cancelado; consulte o registro antes de repetir.');return;}setSelected(updated);await loadHistory(row.id,ticket);if(detailGate.current.isCurrent(ticket,renderedScope.current,activeScope()))toast.success('Pedido cancelado e preservado.');}catch(error){if(detailGate.current.isCurrent(ticket,renderedScope.current,activeScope()))toast.error(message(error));else toast.error('Contexto alterado. Consulte o Pedido antes de repetir.');}finally{mutationGate.current.end(mutation);setBusy(mutationGate.current.isPending(renderedScope.current));}};
  const cancelMotivoUi=evaluatePedidoCancelMotivoUiGate(cancelMotivo);
  const statusMotivoUi=evaluatePedidoStatusMotivoUiGate(statusMotivo);
  const pedidoHistoryUi=resolvePedidoHistoryUiState({events:history,isLoading:historyLoading,isError:Boolean(historyError),errorMessage:historyError?message(historyError):null});
  const pendingStatusGate=evaluatePedidoStatusTransitionUiGate({row:pendingTransition?.row||selected,groupId,empresaId,canTransition});
  const printPdfGate=evaluatePedidoPrintPdfUiGate({row:selected,groupId,empresaId,canPrint});
  const shareGate=evaluatePedidoShareUiGate({row:selected,groupId,empresaId,canShare});
  const printPedidoPdf=()=>{if(printPdfGate.blockPrint){toast.error(printPdfGate.hint||'Impressão bloqueada (fail-closed).');return;}if(!selected)return;const opened=gerarPDFPedido(selected,{empresa:empresaAtual||{},clienteNome:clientLabel(selected.cliente_empresa_id),statusLabel:PEDIDO_STATUS_LABELS[selected.status]||selected.status});if(!opened)toast.error('Permita a abertura da janela de impressão para gerar o PDF.');};
  const preparePedidoShare=async(channel)=>{if(shareGate.blockShare){toast.error(shareGate.hint||'Compartilhamento bloqueado (fail-closed).');return;}try{const text=buildPedidoShareText(selected,{empresaNome:empresaAtual?.nome_fantasia||empresaAtual?.razao_social||'Empresa',clienteNome:clientLabel(selected.cliente_empresa_id),statusLabel:PEDIDO_STATUS_LABELS[selected.status]||selected.status});if(navigator?.clipboard?.writeText){await navigator.clipboard.writeText(text);toast.success(`Texto para ${channel} copiado. Revise antes de enviar.`);}else{window.prompt(`Copie o texto para ${channel}:`, text);}}catch(error){toast.error(error?.message||'Falha ao preparar texto.');}};

  if(!canView)return <div className="w-full h-full flex items-center justify-center p-6"><Alert className="max-w-lg"><AlertCircle className="h-4 w-4"/><AlertDescription>Acesso negado aos Pedidos.</AlertDescription></Alert></div>;
  const rows=list.data?.data||[];const meta=list.data?.meta||{total:0};let totals={subtotal:'0',desconto:'0',total:'0'};try{totals=calculatePedidoTotals(form.itens);}catch{totals={subtotal:'0',desconto:'0',total:'0'};}
  return <div className={`w-full h-full flex flex-col bg-slate-50 ${windowMode?'p-3':'p-4'}`} data-permission="Comercial.pedido.visualizar">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-3"><div><h2 className="text-xl font-semibold">Pedidos</h2><p className="text-sm text-slate-500">Operação comercial da empresa ativa</p></div>{canCreate&&<Button onClick={openCreate} disabled={!ready||busy}><Plus className="w-4 h-4 mr-2"/>Novo pedido</Button>}</div>
    {!ready&&<Alert><AlertCircle className="h-4 w-4"/><AlertDescription>Selecione uma empresa e entre com um usuário válido.</AlertDescription></Alert>}
    <form className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3" onSubmit={e=>{e.preventDefault();setPage(1);setApplied(filters);}}><div className="md:col-span-2"><Input aria-label="Pesquisar pedido" maxLength={80} placeholder="Número do pedido" value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})}/></div><Select value={filters.status} onValueChange={v=>setFilters({...filters,status:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os status</SelectItem>{Object.entries(PEDIDO_STATUS_LABELS).map(([value,label])=><SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Select value={filters.tipoOperacao} onValueChange={v=>setFilters({...filters,tipoOperacao:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="TODOS">Entrega e retirada</SelectItem><SelectItem value="ENTREGA">Entrega</SelectItem><SelectItem value="RETIRADA">Retirada</SelectItem></SelectContent></Select><Select value={filters.clienteEmpresaId} onValueChange={v=>setFilters({...filters,clienteEmpresaId:v})}><SelectTrigger><SelectValue placeholder="Clientes"/></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os clientes</SelectItem>{masters.clientesEmpresa.map(x=><SelectItem key={x.id} value={x.id}>{clientLabel(x.id)}</SelectItem>)}</SelectContent></Select><div className="flex gap-2"><Button type="submit" variant="outline" className="flex-1"><Search className="w-4 h-4 mr-2"/>Filtrar</Button><Button type="button" size="icon" variant="ghost" title="Limpar filtros" onClick={()=>{const clean={search:'',status:'TODOS',clienteEmpresaId:'TODOS',tipoOperacao:'TODOS'};setFilters(clean);setApplied(clean);setPage(1);}}><RefreshCw className="w-4 h-4"/></Button></div></form>
    {list.isLoading?<div className="flex-1 flex items-center justify-center">Carregando pedidos...</div>:list.isError?<div className="flex-1 flex flex-col items-center justify-center gap-3"><p>{message(list.error)}</p><Button variant="outline" onClick={()=>list.refetch()}>Tentar novamente</Button></div>:rows.length===0?<div className="flex-1 flex flex-col items-center justify-center text-slate-500"><ShoppingCart className="w-10 h-10 mb-2"/><p>Nenhum pedido encontrado nesta empresa.</p></div>:<div className="flex-1 min-h-0 overflow-auto border bg-white rounded-md"><Table><TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Cliente</TableHead><TableHead>Operação</TableHead><TableHead>Entrega solicitada</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{rows.map(row=><TableRow key={row.id}><TableCell className="font-mono">{row.numero}</TableCell><TableCell>{clientLabel(row.cliente_empresa_id)}</TableCell><TableCell>{row.tipo_operacao==='ENTREGA'?'Entrega':'Retirada'}</TableCell><TableCell>{date(row.data_entrega_solicitada)}</TableCell><TableCell><Badge variant={row.status==='CANCELADO'?'secondary':'default'}>{PEDIDO_STATUS_LABELS[row.status]||row.status}</Badge></TableCell><TableCell className="text-right font-semibold">{money(row.total)}</TableCell><TableCell><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" title="Visualizar" onClick={()=>show(row)}><Eye className="w-4 h-4"/></Button>{canEdit(row)&&<Button size="icon" variant="ghost" title="Editar" onClick={()=>openEdit(row)}><Pencil className="w-4 h-4"/></Button>}{canCancel(row)&&<Button size="icon" variant="ghost" title="Cancelar" onClick={()=>requestCancel(row)}><XCircle className="w-4 h-4"/></Button>}</div></TableCell></TableRow>)}</TableBody></Table></div>}
    <PaginationControls currentPage={page} totalItems={meta.total||0} itemsPerPage={pageSize} onPageChange={setPage} onItemsPerPageChange={setPageSize} isLoading={list.isFetching}/>
    <Dialog open={formOpen} onOpenChange={open=>{if(!open)close();}}><DialogContent style={windowMode ? { zIndex:1000000000 } : undefined} overlayStyle={windowMode ? { zIndex:999999999 } : undefined} className="w-[96vw] max-w-6xl max-h-[92vh] overflow-auto"><DialogHeader><DialogTitle>{editing?`Editar pedido ${editing.numero}`:'Novo pedido'}</DialogTitle><DialogDescription>Valores e referências serão validados novamente pelo servidor. Busque cliente/produto por código.</DialogDescription></DialogHeader><div className="grid grid-cols-1 md:grid-cols-4 gap-3"><div className="md:col-span-2 space-y-2"><Label htmlFor="ped-cliente-busca">Buscar cliente (código ou nome)</Label><Input id="ped-cliente-busca" value={clienteQuery} maxLength={80} placeholder="Digite código ou razão social" onChange={e=>setClienteQuery(e.target.value)} data-action="pedido-busca-cliente"/><Label>Cliente</Label><Select value={form.cliente_empresa_id} onValueChange={v=>change('cliente_empresa_id',v)}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{clienteOptions.map(x=><SelectItem key={x.id} value={x.id}>{clientLabel(x.id)}</SelectItem>)}</SelectContent></Select></div><div><Label>Condição</Label><Select value={form.condicao_pagamento_id} onValueChange={v=>change('condicao_pagamento_id',v)}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{masters.condicoes.map(x=><SelectItem key={x.id} value={x.id}>{x.codigo?`${x.codigo} — `:''}{x.nome||x.codigo}</SelectItem>)}</SelectContent></Select></div><div><Label>Operação</Label><Select value={form.tipo_operacao} onValueChange={v=>change('tipo_operacao',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="ENTREGA">Entrega</SelectItem><SelectItem value="RETIRADA">Retirada</SelectItem></SelectContent></Select></div><div><Label>Data solicitada</Label><Input type="date" value={form.data_entrega_solicitada} onChange={e=>change('data_entrega_solicitada',e.target.value)}/></div><div><Label>Local</Label><Select value={form.cliente_local_id||'NENHUM'} onValueChange={v=>change('cliente_local_id',v==='NENHUM'?'':v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="NENHUM">Não informado</SelectItem>{masters.locais.map(x=><SelectItem key={x.id} value={x.id}>{x.nome||x.apelido||x.id}</SelectItem>)}</SelectContent></Select></div><div><Label>Obra</Label><Select value={form.obra_id||'NENHUMA'} onValueChange={v=>change('obra_id',v==='NENHUMA'?'':v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="NENHUMA">Sem obra</SelectItem>{masters.obras.map(x=><SelectItem key={x.id} value={x.id}>{x.nome||x.codigo}</SelectItem>)}</SelectContent></Select></div><div><Label>Tabela de preço</Label><Select value={form.tabela_preco_id||'NENHUMA'} onValueChange={v=>change('tabela_preco_id',v==='NENHUMA'?'':v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="NENHUMA">Não informada</SelectItem>{masters.tabelas.map(x=><SelectItem key={x.id} value={x.id}>{x.codigo?`${x.codigo} — `:''}{x.nome||x.codigo}</SelectItem>)}</SelectContent></Select></div><div className="md:col-span-4"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e=>change('observacoes',e.target.value)}/></div></div>
    <div className="space-y-2"><div className="flex flex-wrap items-end justify-between gap-2"><h3 className="font-semibold">Itens</h3><div className="flex flex-wrap gap-2 items-end"><Input value={produtoQuery} maxLength={80} placeholder="Filtrar produto por código" onChange={e=>setProdutoQuery(e.target.value)} data-action="pedido-busca-produto" className="w-56" aria-label="Buscar produto"/><Button type="button" variant="outline" size="sm" onClick={()=>change('itens',[...form.itens,emptyItem()])}><Plus className="w-4 h-4 mr-1"/>Item</Button></div></div>{form.itens.map((item,index)=><div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 border rounded-md p-2"><div className="md:col-span-3"><Label>Produto</Label><Select value={item.produto_id} onValueChange={v=>selectProduct(index,v)}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{produtoOptions.map(p=><SelectItem key={p.id} value={p.id}>{produtoPickerLabel(p)}</SelectItem>)}</SelectContent></Select></div><div className="md:col-span-3"><Label>Descrição</Label><Input value={item.descricao} onChange={e=>changeItem(index,'descricao',e.target.value)}/></div><div><Label>Un.</Label><Input value={item.unidade_sigla} readOnly/></div><div><Label>Qtd.</Label><Input value={item.quantidade} onChange={e=>changeItem(index,'quantidade',e.target.value)}/></div><div><Label>Preço</Label><Input value={item.preco_unitario} onChange={e=>changeItem(index,'preco_unitario',e.target.value)}/></div><div><Label>Desconto</Label><Input value={item.desconto} onChange={e=>changeItem(index,'desconto',e.target.value)}/></div><div className="flex items-end gap-2"><Checkbox checked={item.requer_producao} onCheckedChange={v=>changeItem(index,'requer_producao',Boolean(v))}/><span className="text-xs">Produção</span></div><div className="flex items-end"><Button type="button" size="icon" variant="ghost" disabled={form.itens.length===1} onClick={()=>change('itens',form.itens.filter((_,i)=>i!==index))}><Trash2 className="w-4 h-4"/></Button></div></div>)}</div><div className="flex justify-end gap-5 text-sm"><span>Subtotal: <strong>{money(totals.subtotal)}</strong></span><span>Desconto: <strong>{money(totals.desconto)}</strong></span><span>Total: <strong>{money(totals.total)}</strong></span></div><DialogFooter><Button variant="outline" onClick={close}>Fechar</Button><Button onClick={save} disabled={busy||master.isLoading}>{busy?'Salvando...':'Salvar pedido'}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={detailOpen} onOpenChange={setDetailOpen}><DialogContent style={windowMode ? { zIndex:1000000000 } : undefined} overlayStyle={windowMode ? { zIndex:999999999 } : undefined} className="max-w-5xl max-h-[92vh] overflow-auto"><DialogHeader><DialogTitle>Pedido {selected?.numero}</DialogTitle><DialogDescription>{PEDIDO_STATUS_LABELS[selected?.status]||selected?.status} · {selected?.tipo_operacao==='ENTREGA'?'Entrega':'Retirada'} em {date(selected?.data_entrega_solicitada)}</DialogDescription></DialogHeader>{selected&&<div className="space-y-4"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Un.</TableHead><TableHead>Qtd.</TableHead><TableHead>Produção</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>{(selected.itens||[]).map(item=><TableRow key={item.id}><TableCell>{item.descricao}</TableCell><TableCell>{item.unidade_sigla}</TableCell><TableCell>{item.quantidade}</TableCell><TableCell>{item.requer_producao?'Sim':'Não'}</TableCell><TableCell className="text-right">{money(item.total)}</TableCell></TableRow>)}</TableBody></Table><div className="flex justify-end gap-4"><strong>Total: {money(selected.total)}</strong></div><div data-testid="pedido-history" data-history-mode={pedidoHistoryUi.mode} data-action="Comercial.pedido.historico"><div className="flex flex-wrap items-center justify-between gap-2 mb-2"><h3 className="font-semibold">Histórico</h3>{pedidoHistoryUi.canRetry&&selected&&<Button type="button" size="sm" variant="outline" data-testid="pedido-history-retry" onClick={()=>void loadHistory(selected.id)}><RefreshCw className="w-4 h-4 mr-1"/>Tentar novamente</Button>}</div>{pedidoHistoryUi.mode==='loading'&&<p className="text-sm text-slate-500" data-testid="pedido-history-loading">{pedidoHistoryUi.hint}</p>}{pedidoHistoryUi.mode==='error'&&<Alert variant="destructive" data-testid="pedido-history-error" data-retryable="true"><AlertCircle className="h-4 w-4"/><AlertDescription>{pedidoHistoryUi.hint}</AlertDescription></Alert>}{pedidoHistoryUi.mode==='invalid'&&<Alert variant="destructive" data-testid="pedido-history-invalid"><AlertCircle className="h-4 w-4"/><AlertDescription>{pedidoHistoryUi.hint}</AlertDescription></Alert>}{pedidoHistoryUi.mode==='empty'&&<p className="text-sm text-slate-500" data-testid="pedido-history-empty">{pedidoHistoryUi.hint}</p>}{pedidoHistoryUi.mode==='ready'&&<div className="space-y-1" data-testid="pedido-history-ready">{pedidoHistoryUi.events.map(event=><div key={event.id} className="text-sm border-l-2 pl-3"><strong>{PEDIDO_STATUS_LABELS[event.status_novo]||event.status_novo}</strong> · {date(event.created_at)}{event.motivo?` · ${event.motivo}`:''}</div>)}</div>}</div></div>}<DialogFooter className="flex flex-wrap gap-2"><Button variant="outline" data-action="Comercial.pedido.imprimir-pdf" data-testid="pedido-print-pdf" data-permission="Comercial.pedido.imprimir" data-print-mode={printPdfGate.mode} title={printPdfGate.blockPrint?(printPdfGate.hint||'Impressão bloqueada'):'Imprimir/PDF'} disabled={!selected||printPdfGate.blockPrint} onClick={printPedidoPdf}><Printer className="w-4 h-4 mr-2"/>Imprimir/PDF</Button><Button variant="outline" data-action="Comercial.pedido.compartilhar-whatsapp" data-testid="pedido-share-whatsapp" data-share-mode={shareGate.mode} title={shareGate.blockShare?(shareGate.hint||'Compartilhamento bloqueado'):'Preparar texto para WhatsApp'} disabled={!selected||shareGate.blockShare} onClick={()=>{void preparePedidoShare('WhatsApp');}}><MessageCircle className="w-4 h-4 mr-2"/>WhatsApp</Button><Button variant="outline" data-action="Comercial.pedido.compartilhar-email" data-testid="pedido-share-email" data-share-mode={shareGate.mode} title={shareGate.blockShare?(shareGate.hint||'Compartilhamento bloqueado'):'Preparar texto para e-mail'} disabled={!selected||shareGate.blockShare} onClick={()=>{void preparePedidoShare('e-mail');}}><Mail className="w-4 h-4 mr-2"/>E-mail</Button>{canEdit(selected)&&<Button variant="outline" onClick={()=>openEdit(selected)}><Pencil className="w-4 h-4 mr-2"/>Editar</Button>}{canTransition&&nextPedidoStatus(selected)&&<Button data-testid="pedido-status-advance" data-action="Comercial.pedido.alterar-status" onClick={()=>requestTransition(selected)} disabled={busy||evaluatePedidoStatusTransitionUiGate({row:selected,groupId,empresaId,canTransition}).blockTransition} title={evaluatePedidoStatusTransitionUiGate({row:selected,groupId,empresaId,canTransition}).hint||undefined}>Avançar para {PEDIDO_STATUS_LABELS[nextPedidoStatus(selected)]}</Button>}{canCancel(selected)&&<Button variant="destructive" data-permission="Comercial.pedido.cancelar" onClick={()=>requestCancel(selected)} disabled={!selected||busy}>Cancelar pedido</Button>}</DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(pendingCancel)} onOpenChange={(open)=>{if(!open&&!busy){setPendingCancel(null);setCancelMotivo('');}}}><DialogContent style={windowMode ? { zIndex:1000000000 } : undefined} overlayStyle={windowMode ? { zIndex:999999999 } : undefined} className="max-w-md" data-testid="pedido-cancel-dialog" data-action="Comercial.pedido.cancelar"><DialogHeader><DialogTitle>Cancelar pedido {pendingCancel?.numero}?</DialogTitle><DialogDescription>O pedido, itens e histórico serão preservados. Informe o motivo (obrigatório).</DialogDescription></DialogHeader><div className="space-y-2"><div className="flex items-center justify-between gap-2"><Label htmlFor="ped-cancel-motivo">Motivo</Label><span className="text-xs text-slate-500 tabular-nums" data-testid="pedido-cancel-motivo-counter" aria-live="polite">{cancelMotivoUi.counterLabel}</span></div><Textarea id="ped-cancel-motivo" data-testid="pedido-cancel-motivo" maxLength={PEDIDO_CANCEL_MOTIVO_MAX} value={cancelMotivo} onChange={(e)=>setCancelMotivo(clampPedidoCancelMotivo(e.target.value))} aria-invalid={cancelMotivoUi.blockConfirm?'true':undefined} rows={3}/>{cancelMotivoUi.blockConfirm&&cancelMotivo.trim()!==''&&<Alert variant="destructive" data-testid="pedido-cancel-motivo-gate"><AlertCircle className="h-4 w-4"/><AlertDescription>{cancelMotivoUi.hint}</AlertDescription></Alert>}</div><DialogFooter><Button variant="outline" onClick={()=>{setPendingCancel(null);setCancelMotivo('');}} disabled={busy}>Voltar</Button><Button variant="destructive" data-testid="pedido-cancel-confirm" disabled={busy||cancelMotivoUi.blockConfirm} title={cancelMotivoUi.blockConfirm?(cancelMotivoUi.hint||undefined):undefined} onClick={()=>{const row=pendingCancel;const motivo=cancelMotivoUi.motivo;setPendingCancel(null);setCancelMotivo('');void cancel(row,motivo);}}>{busy?'Cancelando...':'Cancelar pedido'}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(pendingTransition)} onOpenChange={(open)=>{if(!open&&!busy){setPendingTransition(null);setStatusMotivo('');}}}><DialogContent style={windowMode ? { zIndex:1000000000 } : undefined} overlayStyle={windowMode ? { zIndex:999999999 } : undefined} className="max-w-md" data-testid="pedido-status-dialog" data-action="Comercial.pedido.alterar-status"><DialogHeader><DialogTitle>Avançar pedido {pendingTransition?.row?.numero}?</DialogTitle><DialogDescription>Status atual: {PEDIDO_STATUS_LABELS[pendingTransition?.row?.status]||pendingTransition?.row?.status}. Próximo: {PEDIDO_STATUS_LABELS[pendingTransition?.target]||pendingTransition?.target}. Motivo opcional (máx. {PEDIDO_CANCEL_MOTIVO_MAX}).</DialogDescription></DialogHeader>{pendingStatusGate.blockTransition&&<Alert variant="destructive" data-testid="pedido-status-blocked-banner"><AlertCircle className="h-4 w-4"/><AlertDescription>{pendingStatusGate.hint}</AlertDescription></Alert>}<div className="space-y-2"><div className="flex items-center justify-between gap-2"><Label htmlFor="ped-status-motivo">Motivo (opcional)</Label><span className="text-xs text-slate-500 tabular-nums" data-testid="pedido-status-motivo-counter" aria-live="polite">{statusMotivoUi.counterLabel}</span></div><Textarea id="ped-status-motivo" data-testid="pedido-status-motivo" maxLength={PEDIDO_CANCEL_MOTIVO_MAX} value={statusMotivo} onChange={(e)=>setStatusMotivo(clampPedidoCancelMotivo(e.target.value))} aria-invalid={statusMotivoUi.blockConfirm?'true':undefined} rows={3}/>{statusMotivoUi.blockConfirm&&<Alert variant="destructive" data-testid="pedido-status-motivo-gate"><AlertCircle className="h-4 w-4"/><AlertDescription>{statusMotivoUi.hint}</AlertDescription></Alert>}</div><DialogFooter><Button variant="outline" onClick={()=>{setPendingTransition(null);setStatusMotivo('');}} disabled={busy}>Voltar</Button><Button data-testid="pedido-status-confirm" disabled={busy||pendingStatusGate.blockTransition||statusMotivoUi.blockConfirm} onClick={()=>{const row=pendingTransition?.row; const target=pendingTransition?.target; const motivo=statusMotivoUi.motivo; setPendingTransition(null); setStatusMotivo(''); void transition(row,target,motivo);}}>{busy?'Avançando...':`Confirmar ${PEDIDO_STATUS_LABELS[pendingTransition?.target]||pendingTransition?.target||''}`}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
