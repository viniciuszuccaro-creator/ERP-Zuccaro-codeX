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

// Revisao canonica separada do MASTER; completar nao ativa nem define principal.
export default function ClienteLocaisRevisao({
  clienteId, groupId, empresaId, finalidade, allowReviewEdit = false,
  onOpenDraft = null, onReviewMeta = null,
}) {
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const allowed = hasPermission('Cadastros', 'cliente_local', 'visualizar') === true;
  const canEdit = !permissionsLoading && allowReviewEdit && (finalidade === 'FISCAL' || finalidade === 'ENTREGA')
    && hasPermission('Cadastros', 'cliente_local', 'editar') === true;
  const reviewLabel = finalidade === 'FISCAL' ? 'fiscal' : 'entrega';
  // Revisao in-place exige opt-in; o rascunho de entrega permanece disponivel sem ativacao.
  const canDraft = !permissionsLoading && !canEdit && finalidade === 'ENTREGA'
    && (hasPermission('Cadastros', 'cliente_local', 'editar') === true
      || hasPermission('Cadastros', 'cliente_local', 'criar') === true);
  const session = readErpHttpSession();
  const purposeValid = finalidade === 'FISCAL' || finalidade === 'ENTREGA';
  const valid = purposeValid && allowed && session?.token && session.groupId === groupId
    && (session.empresaId || null) === (empresaId || null) && Boolean(clienteId);
  const [revision, setRevision] = useState(0);
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState(null);
  const [editor, setEditor] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const loaded = useRef(null);
  loaded.current = state;
  const epoch = useRef(0);
  const current = useRef(null);
  current.current = { clienteId, groupId, empresaId, session, valid, finalidade, canEdit, canDraft };
  useEffect(() => {
    const invalidate = () => { epoch.current++; setState(null); setEditor(null); setSaveError(''); setOffset(0); setRevision(n => n + 1); };
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
    setEditor(null);
    setSaveError('');
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
    // Capture CAS before the list: a change during/after reading must conflict, not be overwritten.
    (async () => {
      const tokens = canEdit ? await api.clientes.snapshotLocais(clienteId, { includeReview: true, signal: controller.signal }) : null;
      if (!isCurrent()) return;
      const page = await api.clientes.listLocaisReviewPage(clienteId, { offset, finalidade, signal: controller.signal });
      if (isCurrent()) {
        setState({ page, snapshot, offset, revision, tokens, generation });
        if (typeof onReviewMeta === 'function' && Number.isSafeInteger(page?.meta?.total)) {
          onReviewMeta({ finalidade, total: page.meta.total, error: false });
        }
      }
    })()
      .catch(() => {
      if (isCurrent()) {
        setState({ error: true, snapshot, offset, revision });
        if (typeof onReviewMeta === 'function') onReviewMeta({ finalidade, total: null, error: true });
      }
    });
    return () => { controller.abort(); epoch.current++; };
  }, [clienteId, groupId, empresaId, session?.token, session?.actorId, allowed, offset, revision, valid, finalidade, canEdit]);
  const visible = valid && state?.snapshot.clienteId === clienteId
    && state.snapshot.groupId === groupId && state.snapshot.empresaId === empresaId
    && state.snapshot.finalidade === finalidade && sameSession(state.snapshot.session, session) && state.offset === offset && state.revision === revision;
  const isBound = binding => Boolean(binding && loaded.current === binding && epoch.current === binding.generation
    && current.current.valid && current.current.canEdit
    && current.current.clienteId === binding.snapshot.clienteId
    && current.current.groupId === binding.snapshot.groupId && current.current.empresaId === binding.snapshot.empresaId
    && current.current.finalidade === binding.snapshot.finalidade
    && sameSession(current.current.session, binding.snapshot.session)
    && sameSession(readErpHttpSession(), binding.snapshot.session));
  const openEditor = row => {
    const binding = state;
    if (!isBound(binding) || row.origem !== 'MIGRACAO' || row.ativo !== false) return;
    const draft = Object.fromEntries(['nome', ...fields.map(([key]) => key)]
      .filter(key => Object.prototype.hasOwnProperty.call(row, key)).map(key => [key, row[key]]));
    setSaveError(''); setEditor({ row, draft, binding });
  };
  const saveReview = async () => {
    const pending = editor;
    if (busy.current || !pending || !isBound(pending.binding)) return;
    busy.current = true; setSaving(true); setSaveError('');
    try {
      const api = createHttpApiClient({ getScope: () => {
        if (!isBound(pending.binding)) throw new Error('Contexto de revisao expirado');
        return pending.binding.snapshot.session;
      } });
      const data = Object.fromEntries(Object.entries(pending.draft)
        .filter(([key, value]) => value !== pending.row[key]));
      for (const key of ['complemento', 'referencia']) if (data[key] === '') data[key] = null;
      await api.clientes.syncLocais(pending.binding.snapshot.clienteId, {
        version: pending.binding.tokens.version, review_version: pending.binding.tokens.reviewVersion,
        operations: [{ op: 'review', id: pending.row.id, data, activate: false }],
      });
      if (!isBound(pending.binding)) return;
      setEditor(null); setState(null); setRevision(n => n + 1);
    } catch (error) {
      if (isBound(pending.binding)) setSaveError(error?.status === 409
        ? 'Conflito de versao. Rascunho preservado; cancele e recarregue antes de revisar novamente.'
        : 'Revisao nao salva. Rascunho preservado; confira os campos e a permissao.');
    } finally { busy.current = false; setSaving(false); }
  };
  const openDraft = (row) => {
    if (typeof onOpenDraft !== 'function' || !canDraft || finalidade !== 'ENTREGA') return;
    // Congela identidade da revisão visível — callback obsoleto de A não deve publicar em B.
    if (!visible || !state?.snapshot || state.error) return;
    // Reuse the review binding; old callbacks never revive after identity/token ABA.
    if (loaded.current !== state || epoch.current !== state.generation
      || !current.current.valid || !current.current.canDraft) return;
    const snap = state.snapshot;
    if (snap.clienteId !== clienteId || snap.groupId !== groupId
      || (snap.empresaId || null) !== (empresaId || null) || snap.finalidade !== 'ENTREGA') return;
    if (!sameSession(snap.session, session) || !sameSession(snap.session, readErpHttpSession())) return;
    const rowCliente = row?.cliente_id == null || row.cliente_id === ''
      ? ''
      : String(row.cliente_id);
    if (rowCliente && rowCliente !== String(snap.clienteId)) return;
    onOpenDraft({
      finalidade: 'ENTREGA',
      local: row,
      ui: mapClienteLocalToUiEndereco(row),
      clienteId: snap.clienteId,
      groupId: snap.groupId,
      empresaId: snap.empresaId ?? null,
      session: snap.session,
      reviewGeneration: state.generation,
    });
  };
  const visibleEditor = editor && isBound(editor.binding);
  if (!clienteId) return null;
  return <section className="mt-6 border-t pt-4" aria-label={finalidade === 'FISCAL' ? 'Fiscal em revisao' : 'Entrega em revisao'}>
    <h3 className="text-sm font-semibold">{finalidade === 'FISCAL' ? 'Endereco fiscal recuperado - em revisao' : 'Enderecos de entrega recuperados - em revisao'}</h3>
    <p className="text-xs text-gray-600">{finalidade === 'FISCAL' ? 'Finalidade fiscal registrada no local. A ordem da lista nao define o principal.' : 'Somente locais com finalidade de entrega registrada. Endereco unico ou igual ao fiscal nao e classificacao automatica.'} {canEdit ? 'Revisao preserva o local inativo; nao define principal nem libera operacao.' : (typeof onOpenDraft === 'function' ? 'Inativos na lista; abrir rascunho de entrega nao grava nem ativa.' : 'Inativos e somente leitura; nao alteram os campos operacionais.')}</p>
    {visibleEditor && <div className="border p-3" role="group" aria-label={`Revisar ${reviewLabel} inativo`}>
      {['nome', ...fields.map(([key]) => key)].map(key => <label key={key} className="block text-sm">
        {key === 'nome' ? 'Nome do local' : fields.find(([field]) => field === key)?.[1]}
        <input className="block w-full rounded border px-2 py-1 mb-2" aria-label={`Revisao ${key}`} value={editor.draft[key] ?? ''} disabled={saving}
          placeholder={Object.prototype.hasOwnProperty.call(editor.draft, key) ? '' : 'Nao carregado / desconhecido'}
          onChange={event => { const value = event.target.value; setEditor(previous => previous && isBound(previous.binding)
            ? { ...previous, draft: { ...previous.draft, [key]: value } } : previous); }} />
      </label>)}
      {saveError && <p role="alert">{saveError}</p>}
      <button type="button" disabled={saving} onClick={saveReview}>Salvar revisao {reviewLabel} sem ativar</button>
      <button type="button" disabled={saving} onClick={() => { if (isBound(editor.binding)) { setEditor(null); setSaveError(''); setState(null); setRevision(n => n + 1); } }}>Cancelar revisao</button>
    </div>}
    {!valid ? <p role="alert">Leitura indisponivel neste contexto ou sem permissao.</p>
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
            {canEdit && !visibleEditor && row.origem === 'MIGRACAO' && <button type="button" onClick={() => openEditor(row)}>Revisar {reviewLabel}</button>}
            {typeof onOpenDraft === 'function' && finalidade === 'ENTREGA' && (
              <button
                type="button"
                className="mt-2 text-sm text-blue-700 underline disabled:opacity-50 disabled:no-underline"
                disabled={!canDraft}
                data-action="cliente-local-revisao-abrir-rascunho"
                data-permission={canDraft ? 'Cadastros.cliente_local.editar' : undefined}
                onClick={() => openDraft(row)}
              >
                {canDraft
                  ? 'Abrir rascunho de entrega no formulário (não grava)'
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
