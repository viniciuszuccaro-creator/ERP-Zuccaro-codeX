import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Upload, RefreshCw } from 'lucide-react';
import { bankStatementApi, financialMovementApi } from '@/api/httpApiClient';
import { buildBankReconciliationCommand } from './conciliacao/bankReconciliationUiPolicy';
import {bankAnalysisInput,parseBankAnalysis} from './conciliacao/bankAnalysisPolicy';
import {invokeErpIa} from '@/api/base44Client';
import { HTTP_CONTEXT_CHANGED } from '@/api/erpHttpSession';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Existing OFX dialog; optional manual links never post a movement or settle a title.
 * @param {{scope:{groupId:string,empresaId:string,actorId:string},canImport:boolean,onClose:()=>void,
 * canReadMovements?:boolean,canReconcile?:boolean,canReverseLink?:boolean,canAnalyze?:boolean}} props */
export default function ExtratoBancarioImportDialog({scope,canImport,onClose,canReadMovements=false,canReconcile=false,canReverseLink=false,canAnalyze=false}){
  const [accountOffset,setAccountOffset]=useState(0);
  const [accountId,setAccountId]=useState('');
  const [batchId,setBatchId]=useState('');
  const [file,setFile]=useState(/** @type {File|null} */(null));
  const [offset,setOffset]=useState(0);
  const [page,setPage]=useState(/** @type {Awaited<ReturnType<typeof bankStatementApi.page>>|null} */(null));
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  const busy=useRef(false),alive=useRef(true);
  const controller=useRef(new AbortController());
  const close=useRef(onClose);close.current=onClose;
  const [movementOffset,setMovementOffset]=useState(0);
  const [sourceIdentityHash,setSourceIdentityHash]=useState('');
  const [movementId,setMovementId]=useState('');
  const [linkReceipt,setLinkReceipt]=useState(/** @type {{id:string,active:boolean,replay:boolean}|null} */(null));
  const command=useRef(/** @type {ReturnType<typeof buildBankReconciliationCommand>|null} */(null));
  const uncertain=useRef(false);
  const permissions=useRef({canReadMovements,canReconcile,canReverseLink,canAnalyze});
  permissions.current={canReadMovements,canReconcile,canReverseLink,canAnalyze};
  const [linkOffset,setLinkOffset]=useState(0),[recoveryId,setRecoveryId]=useState('');
  const [proposals,setProposals]=useState(/** @type {ReturnType<typeof parseBankAnalysis>} */([]));
  useEffect(()=>{
    alive.current=true;
    controller.current=new AbortController();
    const changed=()=>{alive.current=false;controller.current.abort();close.current();};
    window.addEventListener(HTTP_CONTEXT_CHANGED,changed);
    return ()=>{alive.current=false;controller.current.abort();window.removeEventListener(HTTP_CONTEXT_CHANGED,changed);};
  },[]);
  const accounts=useQuery({queryKey:['bank-source-accounts',scope.actorId,scope.groupId,scope.empresaId,accountOffset],
    queryFn:({signal})=>bankStatementApi.accounts(scope,{limit:20,offset:accountOffset},{signal}),retry:false});
  const movements=useQuery({queryKey:['bank-source-movements',scope.actorId,scope.groupId,scope.empresaId,accountId,movementOffset],
    enabled:canReadMovements&&!!page&&!!accountId,
    queryFn:({signal})=>{
      if(!permissions.current.canReadMovements||!page||!accountId)throw new Error('Leitura financeira indisponivel.');
      return financialMovementApi.list(scope,{accountId,limit:20,offset:movementOffset},{signal});
    },retry:false});
  const pinned=!!command.current&&(uncertain.current||linkReceipt?.active===true);
  const links=useQuery({queryKey:['bank-links',scope.actorId,scope.groupId,scope.empresaId,accountId,linkOffset],
    enabled:canReadMovements&&!!accountId,retry:false,queryFn:({signal})=>{
      if(!permissions.current.canReadMovements||!accountId)throw new Error('Historico indisponivel.');
      return financialMovementApi.links(scope,{accountId,limit:20,offset:linkOffset},{signal});
    }});
  /** @param {string} operationId */
  async function recoverLink(operationId){
    if(busy.current)return;busy.current=true;setPending(true);setError('');
    const signal=controller.current.signal;
    try{
      if(!alive.current||signal.aborted||!permissions.current.canReadMovements
        ||(uncertain.current&&command.current?.operationId!==operationId))throw new Error('invalid');
      const result=await financialMovementApi.link(scope,{accountId,operationId},{signal});
      if(!alive.current||signal.aborted||!permissions.current.canReadMovements)return;
      if(!result.link){
        if(linkReceipt?.active)throw new Error('invalid');
        uncertain.current=false;setError('Operacao nao encontrada na conta consultada. Nenhuma escrita executada.');return;
      }
      const row=result.link;
      command.current={accountId:row.accountId,operationId:row.operationId,movementId:row.movementId,
        movementRevision:row.movementRevision,batchId:row.batchId,identityHash:row.identityHash,contentHash:row.contentHash};
      uncertain.current=false;setLinkReceipt({id:row.operationId,active:row.active,replay:true});setRecoveryId(row.operationId);
      setBatchId(row.batchId);setMovementId(row.movementId);setSourceIdentityHash(row.identityHash);
      if(!row.active)command.current=null;
    }catch{if(alive.current&&!signal.aborted)setError('Nao foi possivel recuperar o resultado financeiro. Nenhuma escrita executada.');}
    finally{busy.current=false;if(alive.current)setPending(false);}
  }
  async function analyzeSource(){
    if(busy.current)return;busy.current=true;setPending(true);setError('');setProposals([]);
    const signal=controller.current.signal,allowed=()=>alive.current&&!signal.aborted&&permissions.current.canReadMovements&&permissions.current.canAnalyze;
    try{
      if(!allowed()||!page||pinned)throw new Error('invalid');
      const source=await bankStatementApi.page(scope,{accountId,batchId,limit:page.limit,offset:page.offset,statementHash:page.statementHash},{signal});
      if(!allowed())throw new Error('invalid');
      const fresh=await financialMovementApi.list(scope,{accountId,limit:20,offset:movementOffset},{signal});
      if(!allowed())throw new Error('invalid');
      const evidence=bankAnalysisInput({scope,accountId,source,movements:fresh});
      const result=await invokeErpIa('financeiro_conciliacao',{prompt:evidence.prompt,group_id:scope.groupId,empresa_id:scope.empresaId,signal});
      if(!allowed())throw new Error('invalid');
      setProposals(parseBankAnalysis(result,evidence));
    }catch{if(alive.current&&!signal.aborted)setError('Analise bancaria indisponivel ou invalida. Nenhum vinculo foi aplicado.');}
    finally{busy.current=false;if(alive.current)setPending(false);}
  }
  function requestClose(){
    if(busy.current||uncertain.current){setError('Operacao pendente ou nao confirmada. Preserve o ID antes de sair.');return;}
    onClose();
  }

  /** Preserves the operation ID on an ambiguous write. Never automatically retries a write.
   * @param {boolean} reverse */
  async function reconcileSource(reverse){
    if(busy.current)return;
    busy.current=true;setPending(true);setError('');
    const signal=controller.current.signal;
    const allowed=()=>alive.current&&!signal.aborted&&permissions.current.canReadMovements
      &&(reverse?permissions.current.canReverseLink:permissions.current.canReconcile);
    try{
      if(!allowed()||(!reverse&&!page)||!accountId)throw new Error('invalid');
      if(reverse){
        const saved=command.current;
        if(!saved||saved.accountId!==accountId||(!linkReceipt?.active&&!uncertain.current))throw new Error('invalid');
        uncertain.current=true;
        const receipt=await financialMovementApi.reverseLink(scope,saved,{signal});
        if(!allowed())throw new Error('invalid');
        uncertain.current=false;setLinkReceipt(receipt);
        command.current=null;setMovementId('');
      }else{
        if(linkReceipt?.active)throw new Error('invalid');
        if(!command.current){
          const source=await bankStatementApi.page(scope,{accountId,batchId,limit:page.limit,offset:page.offset,statementHash:page.statementHash},{signal});
          if(!allowed())throw new Error('invalid');
          const freshMovements=await financialMovementApi.list(scope,{accountId,limit:20,offset:movementOffset},{signal});
          if(!allowed())throw new Error('invalid');
          command.current=buildBankReconciliationCommand({scope,accountId,source,movements:freshMovements,
            sourceIdentityHash,movementId,operationId:crypto.randomUUID()});
        }
        if(command.current.accountId!==accountId||!allowed())throw new Error('invalid');
        uncertain.current=true;
        const receipt=await financialMovementApi.reconcile(scope,command.current,{signal});
        if(!allowed())throw new Error('invalid');
        uncertain.current=false;setLinkReceipt(receipt);
      }
      setProposals([]);
      try{await movements.refetch();await links.refetch();}
      catch{if(alive.current&&!signal.aborted)setError('Vinculo confirmado; nao foi possivel atualizar a listagem.');}
    }catch{
      if(alive.current&&!signal.aborted)setError(uncertain.current
        ?'Resultado financeiro nao confirmado. Preserve o ID e repita somente a mesma operacao.'
        :'Nao foi possivel validar o vinculo bancario. Confira fonte, movimento e permissoes.');
    }finally{busy.current=false;if(alive.current)setPending(false);}
  }
  /** @param {number} value */
  function moveAccounts(value){
    setProposals([]);setLinkOffset(0);setRecoveryId('');
    setAccountOffset(value);setAccountId('');setBatchId('');setFile(null);setPage(null);setOffset(0);setError('');
    setMovementOffset(0);setMovementId('');setSourceIdentityHash('');command.current=null;setLinkReceipt(null);
  }

  /** @param {boolean} upload @param {number} nextOffset */
  async function load(upload,nextOffset){
    if(busy.current||pinned)return;
    busy.current=true;setPending(true);setError('');setPage(null);setSourceIdentityHash('');setProposals([]);
    const signal=controller.current.signal;
    try{
      if(upload){
        if(!canImport||!file)throw new Error('invalid');
        await bankStatementApi.upload(scope,{accountId,batchId,file},{signal});
        if(!alive.current||signal.aborted)return;
        setFile(null);
      }
      const result=await bankStatementApi.page(scope,{accountId,batchId,offset:nextOffset,limit:50,
        ...(page?{statementHash:page.statementHash}:{})},{signal});
      if(!alive.current||signal.aborted)return;
      setPage(result);setOffset(nextOffset);
    }catch{
      if(alive.current&&!signal.aborted)setError('Nao foi possivel concluir a operacao. Confira conta, lote e permissoes.');
    }finally{
      busy.current=false;if(alive.current)setPending(false);
    }
  }
  return <Dialog open onOpenChange={open=>{if(!open)requestClose();}}>
    <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Extrato bancario</DialogTitle>
        <DialogDescription>Fonte bancaria e vinculo manual, sem baixa ou criacao de movimento.</DialogDescription></DialogHeader>
      <div className="space-y-3 min-w-0">
        <Label htmlFor="source-bank-account">Conta bancaria</Label>
        <select id="source-bank-account" className="w-full border rounded p-2" value={accountId} disabled={pending||pinned}
          onChange={event=>{setAccountId(event.target.value);setPage(null);setFile(null);setBatchId('');setOffset(0);
            setProposals([]);setLinkOffset(0);setRecoveryId('');
            setMovementOffset(0);setMovementId('');setSourceIdentityHash('');command.current=null;setLinkReceipt(null);}}>
          <option value="">Selecione...</option>
          {(accounts.data?.data??[]).map(account=><option key={account.id} value={account.id}>
            {account.identity.bankId} - {account.identity.branchId??''}/{account.identity.accountId}
          </option>)}
        </select>
        {accounts.isError&&<p role="alert">Nao foi possivel consultar as contas bancarias.</p>}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" title="Contas anteriores" disabled={pending||pinned||accountOffset===0}
            onClick={()=>moveAccounts(Math.max(0,accountOffset-20))}><ArrowLeft size={16}/></Button>
          <span>{accounts.data?`${accounts.data.total} contas`:accounts.isFetching?'Carregando...':'Contas'}</span>
          <Button variant="outline" size="icon" title="Proximas contas"
            disabled={pending||pinned||!accounts.data||accountOffset+20>=accounts.data.total}
            onClick={()=>moveAccounts(accountOffset+20)}><ArrowRight size={16}/></Button>
        </div>
        <Label htmlFor="source-bank-file">Arquivo OFX</Label>
        <Input id="source-bank-file" type="file" accept=".ofx" disabled={pending||pinned||!accountId||!canImport}
          onChange={event=>{const selected=event.target.files?.[0]??null;event.target.value='';
            setFile(selected);setBatchId(selected?crypto.randomUUID():'');setPage(null);setOffset(0);}}/>
        {file&&<p className="break-all">{file.name}</p>}
        <Label htmlFor="source-bank-batch">Lote</Label>
        <Input id="source-bank-batch" value={batchId} disabled={pending||pinned||!!file}
          onChange={event=>{setBatchId(event.target.value);setPage(null);setOffset(0);}}/>
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending||pinned||!file||!accountId||!canImport} onClick={()=>load(true,0)}><Upload size={16} className="mr-2"/>Importar OFX</Button>
          <Button variant="outline" disabled={pending||pinned||!accountId||!batchId||!!file} onClick={()=>load(false,0)}><RefreshCw size={16} className="mr-2"/>Consultar lote</Button>
        </div>
        {error&&<p role="alert">{error}</p>}
        {page&&<>
          <p>{page.total} transacoes no lote</p>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>
            <th className="text-left p-2">Identificador bancario</th><th className="text-left p-2">Data original</th>
            <th className="text-right p-2">Valor original (BRL)</th></tr></thead><tbody>
            {page.data.map(row=><tr key={row.identityHash}><td className="p-2 break-all">{row.sourceId}</td>
              <td className="p-2">{row.postedRaw}</td><td className="p-2 text-right">{row.amountRaw}</td></tr>)}
          </tbody></table></div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" title="Transacoes anteriores" disabled={pending||pinned||offset===0}
              onClick={()=>load(false,Math.max(0,offset-50))}><ArrowLeft size={16}/></Button>
            <span>{offset+1}-{offset+page.data.length} / {page.total}</span>
            <Button variant="outline" size="icon" title="Proximas transacoes" disabled={pending||pinned||offset+50>=page.total}
              onClick={()=>load(false,offset+50)}><ArrowRight size={16}/></Button>
          </div>
        </>}
        {canReadMovements&&page&&<section className="border-t pt-3 space-y-3 min-w-0">
          <Label htmlFor="source-reconcile-row">Lancamento bancario</Label>
          <select id="source-reconcile-row" className="w-full border rounded p-2" value={sourceIdentityHash} disabled={pending||pinned}
            onChange={event=>{setSourceIdentityHash(event.target.value);command.current=null;setLinkReceipt(null);}}>
            <option value="">Selecione...</option>{page.data.map(row=><option key={row.identityHash} value={row.identityHash}>{row.sourceId} | {row.amountRaw}</option>)}
          </select>
          <Label htmlFor="source-reconcile-movement">Movimento financeiro</Label>
          <select id="source-reconcile-movement" className="w-full border rounded p-2" value={movementId} disabled={pending||pinned||movements.isFetching}
            onChange={event=>{setMovementId(event.target.value);command.current=null;setLinkReceipt(null);}}>
            <option value="">Selecione...</option>{(movements.data?.data??[]).map(row=><option key={row.id} value={row.id} disabled={row.linked||row.state!=='POSTED'}>{row.id} | {row.amountMinor} centavos | {row.occurredAt}</option>)}
          </select>
          {movements.isError&&<p role="alert">Nao foi possivel consultar movimentos financeiros.</p>}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" title="Movimentos anteriores" disabled={pending||pinned||movementOffset===0}
              onClick={()=>{setMovementOffset(Math.max(0,movementOffset-20));setMovementId('');}}><ArrowLeft size={16}/></Button>
            <span>{movements.data?`${movements.data.total} movimentos`:'Movimentos'}</span>
            <Button variant="outline" size="icon" title="Proximos movimentos" disabled={pending||pinned||!movements.data||movementOffset+20>=movements.data.total}
              onClick={()=>{setMovementOffset(movementOffset+20);setMovementId('');}}><ArrowRight size={16}/></Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending||!canReconcile||!sourceIdentityHash||!movementId||linkReceipt?.active===true}
              onClick={()=>{if(window.confirm('Vincular somente este lancamento e este movimento?'))reconcileSource(false);}}>Vincular 1:1</Button>
            <Button variant="outline" disabled={pending||!canReverseLink||(!linkReceipt?.active&&!uncertain.current)}
              onClick={()=>{if(window.confirm('Desfazer somente o vinculo, sem estornar o movimento?'))reconcileSource(true);}}>Desfazer vinculo</Button>
          </div>
          {canAnalyze&&<Button variant="outline" disabled={pending||pinned} onClick={analyzeSource}>Analisar paginas com IA</Button>}
          {proposals.length>0&&<div className="space-y-2"><p>Sugestoes nao verificadas destas paginas: {proposals.length}</p>
            {proposals.map(proposal=><div key={proposal.identityHash} className="border-b py-2 min-w-0">
              <p className="break-all">{proposal.movementId} | Confianca sugerida: {proposal.confidence}%</p><p className="break-words">{proposal.reason}</p>
              <Button variant="outline" disabled={pending||pinned} onClick={()=>{setSourceIdentityHash(proposal.identityHash);setMovementId(proposal.movementId);command.current=null;setLinkReceipt(null);}}>Revisar par</Button>
            </div>)}</div>}
          {command.current&&<p className="break-all">Operacao: {command.current.operationId}</p>}
          {linkReceipt&&<p role="status">{linkReceipt.active?'Vinculo confirmado':'Vinculo desfeito'} | {linkReceipt.id}</p>}
        </section>}
        {canReadMovements&&accountId&&<section className="border-t pt-3 space-y-3 min-w-0">
          <Label htmlFor="bank-link-recovery">Consultar operacao</Label>
          <Input id="bank-link-recovery" value={recoveryId} disabled={pending} onChange={event=>setRecoveryId(event.target.value)}/>
          <Button variant="outline" disabled={pending||!recoveryId} onClick={()=>recoverLink(recoveryId)}>Recuperar resultado</Button>
          {links.isError&&<p role="alert">Historico financeiro indisponivel.</p>}
          {(links.data?.data??[]).map(row=><div key={row.operationId} className="border-b py-2 min-w-0">
            <p className="break-all">{row.operationId} | {row.active?'Ativo':'Desfeito'} | {row.movementId}</p>
            <Button variant="outline" disabled={pending||(uncertain.current&&command.current?.operationId!==row.operationId)} onClick={()=>recoverLink(row.operationId)}>Abrir vinculo</Button>
          </div>)}
          <div className="flex items-center gap-2"><Button size="icon" variant="outline" title="Vinculos anteriores" disabled={pending||linkOffset===0} onClick={()=>setLinkOffset(Math.max(0,linkOffset-20))}><ArrowLeft size={16}/></Button>
            <span>{links.data?`${links.data.total} vinculos`:'Vinculos'}</span><Button size="icon" variant="outline" title="Proximos vinculos" disabled={pending||!links.data||linkOffset+20>=links.data.total} onClick={()=>setLinkOffset(linkOffset+20)}><ArrowRight size={16}/></Button></div>
          {linkReceipt?.active&&!page&&<Button disabled={pending||!canReverseLink} onClick={()=>{if(window.confirm('Desfazer somente o vinculo recuperado?'))reconcileSource(true);}}>Desfazer vinculo recuperado</Button>}
        </section>}
      </div>
    </DialogContent>
  </Dialog>;
}
