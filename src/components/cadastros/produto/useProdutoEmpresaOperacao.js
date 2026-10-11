import {useEffect,useRef,useState} from 'react';

/** Form-only extraction. Session/tenant authority remains in the existing scope guard and BFF. */
export default function useProdutoEmpresaOperacao({produtoId,groupId,empresaId,canView,canManage,api,isScopeCurrent}) {
  const key=`${groupId||''}:${empresaId||''}:${produtoId||''}`;
  const latest=useRef(null);latest.current={key,canView,canManage,isScopeCurrent};
  const epoch=useRef(0),saving=useRef(false),writeController=useRef(null);
  const [attempt,setAttempt]=useState(0);
  const [state,setState]=useState({key:null,phase:'idle',row:null,draft:{ativo:false,habilitado_operacao:false},message:''});
  const current=(generation)=>epoch.current===generation&&latest.current.key===key&&latest.current.canView&&latest.current.isScopeCurrent();
  const validRow=(row)=>row?.group_id===groupId&&row?.empresa_id===empresaId&&row?.produto_id===produtoId
    &&typeof row.ativo==='boolean'&&typeof row.habilitado_operacao==='boolean'
    &&Number.isSafeInteger(row.version)&&row.version>0&&typeof row.id==='string'&&row.id.length>0;
  useEffect(()=>{
    const generation=++epoch.current;
    writeController.current?.abort();saving.current=false;
    setState({key,phase:'loading',row:null,draft:{ativo:false,habilitado_operacao:false},message:''});
    const controller=new AbortController();
    if(!groupId||!empresaId||!produtoId||!canView||!isScopeCurrent()) {
      setState(s=>({...s,phase:'blocked',message:!empresaId?'Escolha uma empresa e reabra o produto para consultar seu vínculo.':'Contexto ou acesso indisponível. Reabra o cadastro.'}));
    }else{
      Promise.resolve().then(()=>{
        if(!current(generation))return null;
        return api.empresaOperacao.get(produtoId,{signal:controller.signal});
      }).then(row=>{
        if(!current(generation))return;
        if(!validRow(row))throw new Error('PRODUTO_EMPRESA_INVALID_RESPONSE');
        setState({key,phase:'ready',row,draft:{ativo:row.ativo,habilitado_operacao:row.habilitado_operacao},message:''});
      }).catch(error=>{
        if(!current(generation)||controller.signal.aborted)return;
        if(error?.status===404&&error?.code==='PRODUTO_EMPRESA_NOT_FOUND'){setState({key,phase:'ready',row:null,draft:{ativo:false,habilitado_operacao:false},message:'Sem vínculo nesta empresa.'});return;}
        setState(s=>({...s,phase:'blocked',message:error?.status===503?'Habilitação empresarial ainda não disponível neste ambiente.':'Não foi possível consultar o vínculo. Consulte novamente.'}));
      });
    }
    return ()=>{++epoch.current;controller.abort();writeController.current?.abort();saving.current=false;};
  },[key,canView,api,attempt]);
  const usable=state.key===key&&canView&&isScopeCurrent();
  const changeDraft=(patch)=>{
    if(!usable||state.phase!=='ready'||!canManage||saving.current||latest.current.key!==key||!latest.current.canManage||!latest.current.isScopeCurrent())return;
    setState(s=>{const draft={...s.draft,...patch};if(!draft.ativo)draft.habilitado_operacao=false;return {...s,draft,message:''};});
  };
  const reload=()=>{if(!saving.current)setAttempt(n=>n+1);};
  const save=async()=>{
    const generation=epoch.current;
    if(!usable||state.phase!=='ready'||!latest.current.canManage||saving.current||!current(generation))return;
    const payload={...state.draft,expected_version:state.row?.version??0};
    saving.current=true;const controller=new AbortController();writeController.current=controller;
    setState(s=>({...s,phase:'saving',message:''}));
    try {
      const row=await api.empresaOperacao.update(produtoId,payload,{signal:controller.signal});
      if(!current(generation))return;
      if(!validRow(row)||row.ativo!==payload.ativo||row.habilitado_operacao!==payload.habilitado_operacao||row.version<payload.expected_version)throw new Error('PRODUTO_EMPRESA_INVALID_RESPONSE');
      setState({key,phase:'ready',row,draft:{ativo:row.ativo,habilitado_operacao:row.habilitado_operacao},message:'Vínculo atualizado nesta empresa.'});
    }catch(error){
      if(!current(generation)||controller.signal.aborted)return;
      setState(s=>({...s,phase:'blocked',message:error?.status===409?'O vínculo mudou. Consulte novamente antes de salvar.':'Gravação não confirmada. Consulte o vínculo antes de tentar novamente.'}));
    }finally{if(epoch.current===generation){saving.current=false;writeController.current=null;}}
  };
  return {...state,row:usable?state.row:null,draft:usable?state.draft:{ativo:false,habilitado_operacao:false},
    message:usable?state.message:'Contexto alterado. Reabra o cadastro.',
    canSave:usable&&canManage&&state.phase==='ready',canConsult:usable&&state.phase!=='saving',changeDraft,reload,save};
}
