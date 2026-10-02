import React, { useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EMPTY_DRAFT = { canal: 'site_cpa', sku: '', nome: '', descricao: '' };

/**
 * Extracao da secao de rascunho por canal ja existente em ProdutoRelationsDamSection.
 * Status permanece RASCUNHO; sem publicacao externa.
 */
export default function ProdutoCanalRascunhoSection({
  channels = [], canEdit = false, busy = false, onSave, onDeactivate,
}) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState(null);

  const reset = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  };

  const save = async () => {
    if (!canEdit || busy || typeof onSave !== 'function') return;
    const canal = String(draft.canal || '').trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]{1,39}$/.test(canal)) {
      await onSave({ error: new Error('Canal invalido (ex.: site_cpa)') });
      return;
    }
    const fields = {
      sku: draft.sku.trim() || null,
      nome: draft.nome.trim() || null,
      descricao: draft.descricao.trim() || null,
    };
    const ok = await onSave(editingId
      ? { mode: 'update', id: editingId, payload: fields }
      : { mode: 'create', payload: { canal, ...fields } });
    if (ok !== false) reset();
  };

  return (
    <section className="space-y-2" data-permission="Cadastros.Produto.editar">
      <h3 className="text-sm font-semibold">Conteudo por canal (rascunho)</h3>
      <p className="text-xs text-muted-foreground">Somente RASCUNHO — sem publicacao externa neste lote.</p>
      {channels.map((row) => (
        <div key={row.id} className="flex items-center gap-2 border-b py-1 text-sm">
          <span className="flex-1 truncate">{row.canal} · {row.sku || 'sem SKU'}{row.nome ? ` · ${row.nome}` : ''} · {row.status}</span>
          {canEdit && (
            <>
              <Button type="button" variant="ghost" size="icon" title="Editar rascunho de canal" disabled={busy}
                data-action="produto-canal-editar"
                onClick={() => {
                  setEditingId(row.id);
                  setDraft({
                    canal: row.canal, sku: row.sku || '', nome: row.nome || '', descricao: row.descricao || '',
                  });
                }}><Save className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" title="Inativar rascunho de canal" disabled={busy}
                data-action="produto-canal-inativar"
                onClick={() => onDeactivate?.(row.id)}><Trash2 className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      ))}
      {canEdit && (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Input aria-label="Identificador do canal" value={draft.canal}
            disabled={busy || Boolean(editingId)}
            onChange={(e) => setDraft((v) => ({ ...v, canal: e.target.value }))}
            placeholder="site_cpa" />
          <Input aria-label="SKU do canal" value={draft.sku}
            onChange={(e) => setDraft((v) => ({ ...v, sku: e.target.value }))} placeholder="SKU canal" />
          <Input aria-label="Nome comercial do canal" value={draft.nome}
            onChange={(e) => setDraft((v) => ({ ...v, nome: e.target.value }))} placeholder="Nome no canal" />
          <Button type="button" onClick={save} disabled={busy || !draft.canal.trim()}
            data-action="produto-canal-salvar"
            title={editingId ? 'Salvar rascunho de canal' : 'Criar rascunho de canal'}>
            {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      )}
      {canEdit && (
        <Input aria-label="Descricao do canal" value={draft.descricao}
          data-action="produto-canal-descricao"
          onChange={(e) => setDraft((v) => ({ ...v, descricao: e.target.value }))}
          placeholder="Descricao comercial do canal (rascunho)" />
      )}
      {editingId && canEdit && (
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={reset}>
          <X className="mr-1 h-4 w-4" /> Cancelar edicao
        </Button>
      )}
    </section>
  );
}
