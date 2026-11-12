import React, { useEffect, useRef, useState } from 'react';
import { createHttpApiClient } from '@/api/httpApiClient';
import { HTTP_CONTEXT_CHANGED, readErpHttpSession } from '@/api/erpHttpSession';
import usePermissions from '@/components/lib/usePermissions';

const sameSession = (a, b) => Boolean(a?.token && b?.token)
  && ['token', 'actorId', 'groupId', 'empresaId'].every(key => a[key] === b[key]);
const fields = [
  ['logradouro', 'Logradouro'], ['numero', 'Numero'], ['complemento', 'Complemento'],
  ['bairro', 'Bairro'], ['cidade', 'Municipio'], ['uf', 'UF'], ['cep', 'CEP'], ['pais', 'Pais'],
  ['referencia', 'Referencia'],
];

// Consulta separada do rascunho operacional: nenhum callback de escrita ou selecao.
export default function ClienteLocaisRevisao({ clienteId, groupId, empresaId }) {
  const { hasPermission } = usePermissions();
  const allowed = hasPermission('Cadastros', 'cliente_local', 'visualizar') === true;
  const session = readErpHttpSession();
  const valid = allowed && session?.token && session.groupId === groupId
    && (session.empresaId || null) === (empresaId || null) && Boolean(clienteId);
  const [revision, setRevision] = useState(0);
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState(null);
  const epoch = useRef(0);
  const current = useRef(null);
  current.current = { clienteId, groupId, empresaId, session, valid };
  useEffect(() => {
    const invalidate = () => { epoch.current++; setState(null); setOffset(0); setRevision(n => n + 1); };
    window.addEventListener(HTTP_CONTEXT_CHANGED, invalidate);
    window.addEventListener('storage', invalidate);
    return () => {
      window.removeEventListener(HTTP_CONTEXT_CHANGED, invalidate);
      window.removeEventListener('storage', invalidate);
    };
  }, []);
  useEffect(() => {
    epoch.current++;
    setOffset(0);
    setState(null);
  }, [clienteId, groupId, empresaId, session?.token, session?.actorId]);
  useEffect(() => {
    if (!session?.expiresAt) return;
    const remaining = Date.parse(session.expiresAt) - Date.now();
    const timer = setTimeout(() => { epoch.current++; setState(null); setRevision(n => n + 1); }, Math.max(0, Math.min(remaining, 2147483647)));
    return () => clearTimeout(timer);
  }, [session?.expiresAt, session?.token, revision]);
  useEffect(() => {
    const generation = ++epoch.current;
    const snapshot = current.current;
    const controller = new AbortController();
    setState(null);
    if (!snapshot.valid) return () => controller.abort();
    const isCurrent = () => !controller.signal.aborted && epoch.current === generation
      && current.current.valid && current.current.clienteId === snapshot.clienteId
      && current.current.groupId === snapshot.groupId && current.current.empresaId === snapshot.empresaId
      && sameSession(snapshot.session, current.current.session)
      && sameSession(snapshot.session, readErpHttpSession());
    const api = createHttpApiClient({ getScope: () => {
      if (!isCurrent()) throw new Error('Contexto de revisao expirado');
      return snapshot.session;
    } });
    api.clientes.listLocaisReviewPage(clienteId, { offset, signal: controller.signal })
      .then(page => { if (isCurrent()) setState({ page, snapshot, offset, revision }); })
      .catch(() => { if (isCurrent()) setState({ error: true, snapshot, offset, revision }); });
    return () => { controller.abort(); epoch.current++; };
  }, [clienteId, groupId, empresaId, session?.token, session?.actorId, allowed, offset, revision, valid]);
  const visible = valid && state?.snapshot.clienteId === clienteId
    && state.snapshot.groupId === groupId && state.snapshot.empresaId === empresaId
    && sameSession(state.snapshot.session, session) && state.offset === offset && state.revision === revision;
  if (!clienteId) return null;
  return <section className="mt-6 border-t pt-4" aria-label="Locais em revisao">
    <h3 className="text-sm font-semibold">Enderecos inativos e em revisao</h3>
    <p className="text-xs text-gray-600">Inativos e somente leitura. Nao substituem o endereco fiscal principal nem estao liberados para entrega.</p>
    {!valid ? <p role="alert">Leitura indisponivel neste contexto ou sem permissao.</p>
      : !visible ? <p role="status">Carregando revisao...</p>
      : state.error ? <p role="alert">Nao foi possivel consultar os locais. Nenhum total confirmado.</p>
      : <>
        <p role="status">{state.page.meta.total} locais inativos; pagina {Math.floor(offset / 50) + 1}.</p>
        {state.page.data.length === 0 && <p>Nenhum local inativo neste recorte.</p>}
        <ul className="divide-y">
          {state.page.data.map(row => <li key={row.id} className="py-3 text-sm break-words">
            <h4 className="font-medium">{row.nome || 'Local sem nome informado'}</h4>
            <p>{Array.isArray(row.finalidades) ? row.finalidades.map(f => f.finalidade).join(' / ') || 'Finalidade nao informada' : 'Finalidade indisponivel'} · Inativo · {row.endereco_incompleto === true ? 'Incompleto' : row.endereco_incompleto === false ? 'Sem indicacao de incompletude' : 'Completude nao informada'}</p>
            <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              {fields.map(([key, label]) => <div key={key}><dt className="inline font-medium">{label}: </dt><dd className="inline">{row[key] === null || row[key] === undefined || row[key] === '' ? 'Nao informado / pendente' : String(row[key])}</dd></div>)}
            </dl>
            <p className="text-xs">Origem: {row.origem || 'Nao informada'}; sistema: {row.source_system || 'Nao informado'}; ID legado: {row.legacy_id || 'Nao informado'}; lote: {row.migration_batch || 'Nao informado'}. Valores invalidos permanecem na evidencia privada.</p>
          </li>)}
        </ul>
        <div className="flex gap-3 mt-3">
          <button type="button" disabled={offset === 0} onClick={() => setOffset(n => Math.max(0, n - 50))} aria-label="Pagina anterior de revisao">Anterior</button>
          <button type="button" disabled={!state.page.meta.hasMore} onClick={() => setOffset(n => n + 50)} aria-label="Proxima pagina de revisao">Proxima</button>
        </div>
      </>}
    {valid && visible && state.error && <button type="button" onClick={() => setRevision(n => n + 1)}>Tentar novamente</button>}
  </section>;
}
