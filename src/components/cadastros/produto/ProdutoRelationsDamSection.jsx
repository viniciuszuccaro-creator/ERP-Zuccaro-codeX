import React, { useEffect, useRef, useState } from 'react';
import { Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { getHttpProdutoApi } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { prepareProdutoMediaFile } from './produtoHttpPolicy';

function uploadSigned(url, file, requiredHeaders, onProgress, setCancel) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    setCancel(() => xhr.abort());
    xhr.open('PUT', url);
    for (const [name, value] of Object.entries(requiredHeaders || {})) xhr.setRequestHeader(name, value);
    if (!Object.keys(requiredHeaders || {}).some((name) => name.toLowerCase() === 'content-type')) {
      xhr.setRequestHeader('Content-Type', file.type);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error('Falha no envio do arquivo'));
    xhr.onabort = () => reject(new Error('Envio cancelado'));
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300
      ? resolve() : reject(new Error('Storage recusou o envio do arquivo'));
    xhr.send(file);
  });
}

const errorText = (error) => error?.status === 503 ? 'Storage do ERP indisponivel' : (error?.message || 'Operacao nao concluida');

export default function ProdutoRelationsDamSection({ produtoId, groupId, empresaId, canView, canEdit }) {
  const api = getHttpProdutoApi();
  const [variants, setVariants] = useState([]);
  const [equivalents, setEquivalents] = useState([]);
  const [media, setMedia] = useState([]);
  const [mediaPage, setMediaPage] = useState(0);
  const [mediaHasMore, setMediaHasMore] = useState(false);
  const [variantDraft, setVariantDraft] = useState({ sku: '', nome: '' });
  const [variantEditing, setVariantEditing] = useState(null);
  const [equivalentDraft, setEquivalentDraft] = useState({ produto_equivalente_id: '', tipo: 'EQUIVALENTE' });
  const [equivalentEditing, setEquivalentEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const cancelUpload = useRef(null);
  const fileInput = useRef(null);

  useEffect(() => {
    if (!canView || !produtoId || !empresaId) return;
    let active = true;
    setError('');
    Promise.all([
      api.variantes.list(produtoId), api.equivalentes.list(produtoId),
      api.midias.list(produtoId, { limit: 20, offset: mediaPage * 20 }),
    ]).then(([v, e, m]) => {
      if (!active) return;
      setVariants(v);
      setEquivalents(e);
      setMedia(m);
      setMediaHasMore(m.length === 20);
    }).catch((err) => { if (active) setError(errorText(err)); });
    return () => { active = false; };
  }, [api, produtoId, empresaId, canView, mediaPage]);

  useEffect(() => {
    if (!canEdit || !search.trim()) { setCandidates([]); return; }
    let active = true;
    const timer = setTimeout(() => {
      api.filter({ descricao: search.trim() }, undefined, 20).then((rows) => {
        if (active) setCandidates(rows.filter((row) => row.id !== produtoId && row.ativo !== false));
      }).catch((err) => { if (active) setError(errorText(err)); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [api, canEdit, produtoId, search]);

  const reload = async () => {
    const [v, e, m] = await Promise.all([
      api.variantes.list(produtoId), api.equivalentes.list(produtoId),
      api.midias.list(produtoId, { limit: 20, offset: mediaPage * 20 }),
    ]);
    setVariants(v); setEquivalents(e); setMedia(m); setMediaHasMore(m.length === 20);
  };
  const run = async (action, success) => {
    if (!canEdit || busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); await reload(); setNotice(success); }
    catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  };
  const saveVariant = () => run(async () => {
    const payload = { sku: variantDraft.sku.trim(), nome: variantDraft.nome.trim() || null };
    if (!payload.sku) throw new Error('SKU obrigatorio');
    if (variantEditing) await api.variantes.update(produtoId, variantEditing, payload);
    else await api.variantes.create(produtoId, payload);
    setVariantEditing(null); setVariantDraft({ sku: '', nome: '' });
  }, 'Variante salva');
  const saveEquivalent = () => run(async () => {
    if (equivalentEditing) {
      await api.equivalentes.update(produtoId, equivalentEditing, { tipo: equivalentDraft.tipo });
    } else {
      if (!equivalentDraft.produto_equivalente_id) throw new Error('Selecione um produto do mesmo contexto');
      await api.equivalentes.create(produtoId, {
        produto_equivalente_id: equivalentDraft.produto_equivalente_id, tipo: equivalentDraft.tipo,
      });
    }
    setEquivalentEditing(null); setEquivalentDraft({ produto_equivalente_id: '', tipo: 'EQUIVALENTE' }); setSearch('');
  }, 'Relacao salva');
  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !canEdit || !groupId || !empresaId || busy) return;
    setBusy(true); setError(''); setNotice(''); setProgress(0);
    try {
      const payload = prepareProdutoMediaFile(file, { groupId, empresaId, produtoId });
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      payload.sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
      const reserved = await api.midiaReserve(produtoId, payload);
      if (!reserved?.url || !reserved.mediaId || !reserved.attemptId) throw new Error('Reserva incompleta');
      await uploadSigned(reserved.url, file, reserved.requiredHeaders, setProgress, (cancel) => { cancelUpload.current = cancel; });
      cancelUpload.current = null;
      const confirmed = await api.midiaConfirm(produtoId, reserved.mediaId, reserved.attemptId);
      if (confirmed?.status !== 'QUARENTENA') throw new Error('Confirmacao de midia nao concluida');
      await reload();
      setNotice('Arquivo confirmado em quarentena');
    } catch (err) {
      setError(errorText(err));
    } finally {
      cancelUpload.current = null; setProgress(null); setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  if (!canView || !produtoId || !empresaId) return null;
  return <div className="w-full space-y-5 border-t pt-5" data-permission="Cadastros.Produto.visualizar">
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Variantes</h3>
      {variants.map((row) => <div key={row.id} className="flex items-center gap-2 border-b py-1 text-sm">
        <span className="flex-1 truncate">{row.sku} {row.nome ? `· ${row.nome}` : ''}</span>
        {canEdit && <><Button type="button" variant="ghost" size="icon" title="Editar variante" disabled={busy}
          onClick={() => { setVariantEditing(row.id); setVariantDraft({ sku: row.sku, nome: row.nome || '' }); }}><Save className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" title="Inativar variante" disabled={busy}
            onClick={() => run(() => api.variantes.deactivate(produtoId, row.id), 'Variante inativada')}><Trash2 className="h-4 w-4" /></Button></>}
      </div>)}
      {canEdit && <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input aria-label="SKU da variante" value={variantDraft.sku} onChange={(e) => setVariantDraft((v) => ({ ...v, sku: e.target.value }))} />
        <Input aria-label="Nome da variante" value={variantDraft.nome} onChange={(e) => setVariantDraft((v) => ({ ...v, nome: e.target.value }))} />
        <Button type="button" onClick={saveVariant} disabled={busy || !variantDraft.sku.trim()} title={variantEditing ? 'Salvar variante' : 'Criar variante'}>
          {variantEditing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</Button>
      </div>}
    </section>
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Equivalentes e substitutos</h3>
      {equivalents.map((row) => <div key={row.id} className="flex items-center gap-2 border-b py-1 text-sm">
        <span className="flex-1 truncate">{row.produto_equivalente_id} · {row.tipo}</span>
        {canEdit && <><Button type="button" variant="ghost" size="icon" title="Editar relacao" disabled={busy}
          onClick={() => { setEquivalentEditing(row.id); setEquivalentDraft({ produto_equivalente_id: row.produto_equivalente_id, tipo: row.tipo }); }}><Save className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" title="Inativar relacao" disabled={busy}
            onClick={() => run(() => api.equivalentes.deactivate(produtoId, row.id), 'Relacao inativada')}><Trash2 className="h-4 w-4" /></Button></>}
      </div>)}
      {canEdit && <div className="space-y-2">
        {!equivalentEditing && <><Input aria-label="Buscar produto equivalente" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={equivalentDraft.produto_equivalente_id} onValueChange={(id) => setEquivalentDraft((v) => ({ ...v, produto_equivalente_id: id }))}>
            <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
            <SelectContent>{candidates.map((row) => <SelectItem key={row.id} value={row.id}>{row.codigo} · {row.descricao}</SelectItem>)}</SelectContent>
          </Select></>}
        <div className="flex gap-2"><Select value={equivalentDraft.tipo} onValueChange={(tipo) => setEquivalentDraft((v) => ({ ...v, tipo }))}>
          <SelectTrigger className="max-w-52"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="EQUIVALENTE">Equivalente</SelectItem><SelectItem value="SUBSTITUTO">Substituto</SelectItem></SelectContent>
        </Select><Button type="button" onClick={saveEquivalent} disabled={busy || (!equivalentEditing && !equivalentDraft.produto_equivalente_id)} title="Salvar relacao"><Save className="h-4 w-4" /></Button></div>
      </div>}
    </section>
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Midias do produto</h3>
      {media.map((row) => <div key={row.id} className="flex justify-between gap-2 border-b py-1 text-sm">
        <span className="truncate">{row.nome_arquivo}</span><span>{row.status} · v{row.versao}{row.principal ? ' · principal' : ''}</span>
      </div>)}
      <div className="flex items-center gap-2"><Button type="button" variant="outline" disabled={mediaPage === 0 || busy} onClick={() => setMediaPage((p) => p - 1)}>Anterior</Button>
        <span className="text-sm">{mediaPage + 1}</span><Button type="button" variant="outline" disabled={!mediaHasMore || busy} onClick={() => setMediaPage((p) => p + 1)}>Proxima</Button></div>
      {canEdit && <><Label htmlFor="produto-dam-file">Arquivo</Label>
        <Input ref={fileInput} id="produto-dam-file" type="file" accept="image/png,image/jpeg,image/webp,application/pdf,video/mp4"
          onChange={upload} disabled={busy} data-permission="Cadastros.Produto.editar" />
        {progress != null && <div className="flex items-center gap-2 text-sm"><Upload className="h-4 w-4" />{progress}%
          <Button type="button" variant="ghost" size="icon" title="Cancelar envio" onClick={() => cancelUpload.current?.()}><X className="h-4 w-4" /></Button></div>}</>}
    </section>
  </div>;
}
