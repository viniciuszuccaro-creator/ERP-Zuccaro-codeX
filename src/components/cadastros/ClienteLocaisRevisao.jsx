import React, { useEffect, useRef, useState } from 'react';
import { createHttpApiClient } from '@/api/httpApiClient';
import { HTTP_CONTEXT_CHANGED, readErpHttpSession } from '@/api/erpHttpSession';
import usePermissions from '@/components/lib/usePermissions';
import { mapClienteLocalToUiEndereco } from '@/api/clienteHttpPayload';

const sameSession = (a, b) => Boolean(a?.token && b?.token)
  && ['token', 'actorId', 'groupId', 'empresaId'].every(key => a[key] === b[key]);
const fields = [
  ['logradouro', 'Logradouro'], ['numero', 'Numero'], ['complemento', 'Complemento'],
  ['bairro', 'Bairro'], ['cidade', 'Municipio'], ['uf', 'UF'], ['cep', 'CEP'], ['pais', 'Pais'],
  ['referencia', 'Referencia'],
];

/**
 * Consulta de revisão (inativos). Abrir rascunho NÃO grava nem ativa —
 * só devolve mapeamento ao formulário canônico via onOpenDraft.
 */
export default function ClienteLocaisRevisao({
  clienteId, groupId, empresaId, finalidade, onOpenDraft = null, onReviewMeta = null,
}) {
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canView = hasPermission('Cadastros', 'cliente_local', 'visualizar') === true;
  const canDraft = hasPermission('Cadastros', 'cliente_local', 'editar') === true
    || hasPermission('Cadastros', 'cliente_local', 'criar') === true;
  const session = readErpHttpSession();
  const purposeValid = finalidade === 'FISCAL' || finalidade === 'ENTREGA';
  const scopeOk = Boolean(session?.token && session.groupId === groupId
    && (session.empresaId || null) === (empresaId || null) && Boolean(clienteId));
  const allowed = !permissionsLoading && canView;
  const valid = purposeValid && allowed && scopeOk;
  const [revision, setRevision] = useState(0);
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState(null);
  const epoch = useRef(0);
  const current = useRef(null);
  current.current = { clienteId, groupId, empresaId, session, valid, finalidade };
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
    // Limpa total no pai ao trocar cliente/contexto — evita contagem do cliente anterior.
    if (typeof onReviewMeta === 'function') {
      onReviewMeta({ finalidade, total: null, error: false });
    }
  }, [clienteId, groupId, empresaId, session?.token, session?.actorId, finalidade]);
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
      && current.current.finalidade === snapshot.finalidade
      && sameSession(snapshot.session, current.current.session)
      && sameSession(snapshot.session, readErpHttpSession());
    const api = createHttpApiClient({ getScope: () => {
      if (!isCurrent()) throw new Error('Contexto de revisao expirado');
      return snapshot.session;
    } });
    api.clientes.listLocaisReviewPage(clienteId, { offset, finalidade, signal: controller.signal })
      .then(page => {
        if (!isCurrent()) return;
        setState({ page, snapshot, offset, revision });
        if (typeof onReviewMeta === 'function' && Number.isSafeInteger(page?.meta?.total)) {
          onReviewMeta({ finalidade, total: page.meta.total, error: false });
        }
      })
      .catch(() => {
        if (!isCurrent()) return;
        setState({ error: true, snapshot, offset, revision });
        if (typeof onReviewMeta === 'function') onReviewMeta({ finalidade, total: null, error: true });
      });
    return () => { controller.abort(); epoch.current++; };
  }, [clienteId, groupId, empresaId, session?.token, session?.actorId, allowed, offset, revision, valid, finalidade]);
  const visible = valid && state?.snapshot.clienteId === clienteId
    && state.snapshot.groupId === groupId && state.snapshot.empresaId === empresaId
    && state.snapshot.finalidade === finalidade && sameSession(state.snapshot.session, session) && state.offset === offset && state.revision === revision;

  const openDraft = (row) => {
    if (typeof onOpenDraft !== 'function' || !canDraft) return;
    // Rascunho no formulário canônico — não ativa, não PATCH.
    onOpenDraft({
      finalidade,
      local: row,
      ui: mapClienteLocalToUiEndereco(row),
    });
  };

  if (!clienteId) return null;

  let gateMessage = null;
  if (permissionsLoading) gateMessage = 'Carregando permissões de locais…';
  else if (!canView) gateMessage = 'Leitura negada: falta Cadastros.cliente_local.visualizar.';
  else if (!scopeOk) gateMessage = 'Leitura indisponível neste contexto (sessão/grupo/empresa).';
  else if (!purposeValid) gateMessage = 'Finalidade de revisão inválida.';

  return <section className="mt-6 border-t pt-4" aria-label={finalidade === 'FISCAL' ? 'Fiscal em revisao' : 'Entrega em revisao'} data-revisao-total={visible && !state.error ? state.page.meta.total : undefined}>
    <h3 className="text-sm font-semibold">{finalidade === 'FISCAL' ? 'Endereco fiscal recuperado - em revisao' : 'Enderecos de entrega recuperados - em revisao'}</h3>
    <p className="text-xs text-gray-600">{finalidade === 'FISCAL' ? 'Finalidade fiscal registrada no local. A ordem da lista nao define o principal.' : 'Somente locais com finalidade de entrega registrada. Endereco unico ou igual ao fiscal nao e classificacao automatica.'} Inativos e somente leitura na lista; abrir rascunho nao grava nem ativa.</p>
    {gateMessage ? <p role="alert">{gateMessage}</p>
      : !visible ? <p role="status">Carregando revisao...</p>
      : state.error ? <p role="alert">Nao foi possivel consultar os locais. Nenhum total confirmado.</p>
      : <>
        <p role="status">{state.page.meta.total} locais {finalidade === 'FISCAL' ? 'fiscais' : 'de entrega'} inativos; pagina {Math.floor(offset / 50) + 1}.</p>
        {state.page.data.length === 0 && <p>Nenhum local {finalidade === 'FISCAL' ? 'fiscal' : 'de entrega'} inativo encontrado neste recorte.</p>}
        <ul className="divide-y">
          {state.page.data.map(row => <li key={row.id} className="py-3 text-sm break-words">
            <h4 className="font-medium">{row.nome || 'Local sem nome informado'}</h4>
            <p>{Array.isArray(row.finalidades) ? row.finalidades.map(f => f.finalidade).join(' / ') || 'Finalidade nao informada' : 'Finalidade indisponivel'} · Inativo · {row.endereco_incompleto === true ? 'Incompleto' : row.endereco_incompleto === false ? 'Sem indicacao de incompletude' : 'Completude nao informada'}</p>
            <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              {fields.map(([key, label]) => <div key={key}><dt className="inline font-medium">{label}: </dt><dd className="inline">{row[key] === null || row[key] === undefined || row[key] === '' ? 'Nao informado / pendente' : String(row[key])}</dd></div>)}
            </dl>
            <p className="text-xs">Origem: {row.origem || 'Nao informada'}; sistema: {row.source_system || 'Nao informado'}; ID legado: {row.legacy_id || 'Nao informado'}; lote: {row.migration_batch || 'Nao informado'}. Valores invalidos permanecem na evidencia privada.</p>
            {typeof onOpenDraft === 'function' && (
              <button
                type="button"
                className="mt-2 text-sm text-blue-700 underline disabled:opacity-50 disabled:no-underline"
                disabled={!canDraft}
                data-action="cliente-local-revisao-abrir-rascunho"
                data-permission={canDraft ? 'Cadastros.cliente_local.editar' : undefined}
                onClick={() => openDraft(row)}
              >
                {canDraft
                  ? (finalidade === 'FISCAL'
                    ? 'Abrir rascunho fiscal nos campos operacionais (não grava)'
                    : 'Abrir rascunho de entrega no formulário (não grava)')
                  : 'Sem permissão para rascunho (cliente_local criar/editar)'}
              </button>
            )}
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
