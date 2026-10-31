import React, { useEffect, useRef, useState } from 'react';
import { clienteConferenciaApi } from '@/api/httpApiClient';
import { readErpHttpSession, HTTP_CONTEXT_CHANGED } from '@/api/erpHttpSession';
import usePermissions from '@/components/lib/usePermissions';
/** Embedded read-only mode of the existing Clientes tab; no automatic list/import. */
export default function ClienteConferenciaLegado() {
 const { hasPermission, isLoading } = usePermissions();
 const [input,setInput]=useState(''), [rows,setRows]=useState(null), [busy,setBusy]=useState(false), [error,setError]=useState('');
 const request=useRef(null), version=useRef(0);
 const session=readErpHttpSession();
 const allowed=!isLoading && session?.token && session.groupId && !session.empresaId
  && hasPermission('Cadastros','cliente','visualizar') && hasPermission('Cadastros','cliente','importar');
 useEffect(()=>{
  const clear=()=>{version.current++;request.current?.abort();setRows(null);setInput('');setError('Contexto alterado. Prepare nova conferência.');setBusy(false);};
  window.addEventListener(HTTP_CONTEXT_CHANGED,clear);
  return()=>{version.current++;request.current?.abort();window.removeEventListener(HTTP_CONTEXT_CHANGED,clear);};
 },[]);
 useEffect(()=>{version.current++;request.current?.abort();setRows(null);setBusy(false);},[allowed,session?.groupId,session?.actorId,session?.empresaId,session?.token]);
 const run=async()=>{
  if(!allowed || busy)return;
  const current=++version.current;const controller=new AbortController();request.current=controller;
  setRows(null);setError('');setBusy(true);
  try{const body=JSON.parse(input);const result=await clienteConferenciaApi.conferirLegado(body,{signal:controller.signal});if(current===version.current)setRows(result);}
  catch{if(current===version.current){setRows(null);setError('Conferência recusada ou contexto inválido. Nenhuma importação foi executada.');}}
  finally{if(current===version.current)setBusy(false);}
 };
 return <section className="space-y-3 rounded border border-blue-200 bg-blue-50 p-4" aria-label="Conferência de clientes legados">
  <h2 className="font-semibold">Conferência de clientes legados</h2>
  <p>Somente leitura no Grupo, até 100 identidades. Esta ação não importa, mescla ou altera cadastros.</p>
  <label htmlFor="cliente-coorte">Coorte preparada em JSON: identidades com documento e/ou sourceSystem + codigoLegado</label>
  <textarea id="cliente-coorte" className="w-full rounded border p-2" rows={8} maxLength={40000} value={input} disabled={busy||!allowed} onChange={e=>{setInput(e.target.value);setRows(null);}} />
  <button type="button" className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50" disabled={busy||!allowed||!input} onClick={run}>{busy?'Conferindo…':'Conferir coorte'}</button>
  {!allowed&&<p role="status">Selecione o Grupo e uma sessão com permissões de visualizar e importar clientes.</p>}
  {error&&<p role="alert">{error}</p>}
  {rows&&<table><caption>Resultados por posição na coorte</caption><thead><tr><th>Posição</th><th>Documento: código / ativo</th><th>Legado: código / ativo</th></tr></thead><tbody>{rows.map(row=><tr key={row.indice}><td>{row.indice+1}</td><td>{row.documento?row.documento.codigo+' / '+(row.documento.ativo?'ativo':'inativo'):'sem correspondência'}</td><td>{row.legado?row.legado.codigo+' / '+(row.legado.ativo?'ativo':'inativo'):'sem correspondência'}</td></tr>)}</tbody></table>}
 </section>;
}
