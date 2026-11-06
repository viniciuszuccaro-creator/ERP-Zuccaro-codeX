/** Submission lock for the existing CRM form; no persistence or automatic retry. */
import { z } from 'zod';
import { isCadastroSelfManagedScopeCurrent } from '../cadastros/cadastroEditLoadPolicy.js';

/** Target company is explicit; a Group view may keep it without guessing fiscal ownership. */
export function isCrmConversionScopeCurrent(target,rendered,active) {
  if(!target?.empresaId || !active)return false;
  const company=active.empresaId||null;
  if(company?company!==target.empresaId:active.scopeType!=='grupo'||Boolean(active.profileEmpresaId))return false;
  return isCadastroSelfManagedScopeCurrent({...target,empresaId:company},rendered,active);
}

/** Canonical command only: never copies price/items or adopts an unclassified legacy quote. */
export function isCanonicalQuoteOpportunity(opportunity) {
  return Boolean(opportunity && opportunity.status==='Ganho' && opportunity.convertido_em==='orcamento'
    && opportunity.ativo!==false && Number.isInteger(opportunity.version) && opportunity.version>0
    && z.string().uuid().safeParse(opportunity.id).success && z.string().uuid().safeParse(opportunity.orcamento_id).success);
}

export function buildCrmQuoteOrderCommand(opportunity, input) {
  if(!isCanonicalQuoteOpportunity(opportunity))
    throw new Error('Selecione uma oportunidade canônica com Orçamento vinculado e versão válida.');
  if(!['ENTREGA','RETIRADA'].includes(input?.tipo_operacao))throw new Error('Selecione Entrega ou Retirada.');
  const date=typeof input.data_entrega_solicitada==='string' && input.data_entrega_solicitada.trim()
    ? new Date(input.data_entrega_solicitada) : null;
  if(!date || !Number.isFinite(date.getTime()))throw new Error('Informe a data e hora solicitadas pelo cliente.');
  if(input.tipo_operacao==='ENTREGA' && !z.string().uuid().safeParse(input.cliente_local_id).success)
    throw new Error('Selecione um local do cliente para Entrega.');
  if(input.obra_id && !z.string().uuid().safeParse(input.obra_id).success)throw new Error('Obra inválida.');
  return {expected_version:opportunity.version,orcamento_id:opportunity.orcamento_id,
    pedido:{tipo_operacao:input.tipo_operacao,data_entrega_solicitada:date.toISOString(),
      ...(input.tipo_operacao==='ENTREGA'?{cliente_local_id:input.cliente_local_id}:{}),
      ...(input.obra_id?{obra_id:input.obra_id}:{})}};
}

/** Confirmation is distinct from dispatch: an ambiguous response never becomes success. */
/** @param {Record<string,any>} opportunity @param {Record<string,any>} result @param {{groupId?:string,empresaId?:string}} [scope] */
export function validateCrmQuoteOrderResult(opportunity,result,scope={}) {
  const order=result?.pedido,linked=result?.oportunidade;
  if(!order || !linked || !z.string().uuid().safeParse(order.id).success || !/^\d+$/.test(String(order.numero||''))
    || linked.id!==opportunity.id || linked.pedido_id!==order.id || linked.convertido_em!=='pedido'
    || linked.orcamento_id!==opportunity.orcamento_id || order.orcamento_id!==opportunity.orcamento_id
    || typeof result.replayed!=='boolean'
    || (scope.groupId && (order.group_id!==scope.groupId || linked.group_id!==scope.groupId))
    || (scope.empresaId && (order.empresa_id!==scope.empresaId || linked.empresa_id!==scope.empresaId)))
    throw new Error('Resposta não confirmada. O Pedido pode ter sido criado; consulte o registro antes de repetir.');
  return result;
}

/** Extracted window orchestration; no grant, fallback, source change or automatic retry. */
export async function openCrmQuoteOrderWindow(row,{api,assertCurrent,scope,viewKey,blocks,openWindow,closeWindow,component,invalidate}) {
  if(!isCanonicalQuoteOpportunity(row))throw new Error('A oportunidade não tem Orçamento canônico vinculado.');
  assertCurrent();
  const permissions=[['CRM','oportunidades','aprovar'],['Comercial','pedido','converter-pedido'],['Comercial','pedido','visualizar'],['Comercial','orcamento','visualizar']];
  const guards=await Promise.all(permissions.map(([module,section,action])=>api.entityGuard({module,section,action,group_id:scope.groupId,empresa_id:scope.empresaId})));
  if(guards.some(guard=>guard?.data?.allowed!==true))throw new Error('Sem permissão para converter esta oportunidade.');
  assertCurrent();
  let windowId;
  windowId=openWindow(component,{oportunidade:row,canonical:true,windowMode:true,
    locais:blocks.locais?.status==='ok'?blocks.locais.data:[],obras:blocks.obras?.status==='ok'?blocks.obras.data:[],
    quoteNumero:blocks.orcamentos?.status==='ok'?blocks.orcamentos.data.find(quote=>quote.id===row.orcamento_id)?.numero:null,
    onClose:()=>closeWindow(windowId),onConverter:async command=>{
      assertCurrent();
      const result=await api.oportunidades.convertOrcamentoToPedido(row.id,command);
      assertCurrent(true);validateCrmQuoteOrderResult(row,result,scope);await invalidate();return result;
    }},{title:'CRM · Orçamento vinculado → Pedido',width:1000,height:780,uniqueKey:`crm-conversao-${viewKey}-${row.id}`});
  return windowId;
}

export function createCrmFormSubmissionGate() {
  let pending = null;
  return {
    /** @param {{payload: unknown, submit: (payload: unknown) => unknown, assertCurrent: () => void, onPending?: (pending: boolean) => void}} input */
    run({ payload, submit, assertCurrent, onPending = () => {} }) {
      if (pending) return pending;
      if (typeof submit !== 'function') return Promise.reject(new Error('Gravação indisponível.'));
      // Freeze all fields, including legacy extensions, before an asynchronous write.
      const snapshot = structuredClone(payload);
      onPending(true);
      pending = Promise.resolve().then(async () => {
        assertCurrent();
        const result = await submit(snapshot);
        try { assertCurrent(); }
        catch { throw new Error('Contexto alterado durante a gravação. Ela pode ter sido concluída; consulte o registro antes de tentar novamente.'); }
        return result;
      }).finally(() => { pending = null; onPending(false); });
      return pending;
    },
  };
}
