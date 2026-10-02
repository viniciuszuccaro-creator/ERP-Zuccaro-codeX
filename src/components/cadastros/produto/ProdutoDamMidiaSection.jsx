import React from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getProdutoMediaDeactivateAction,
  getProdutoMediaDownloadAction,
  getProdutoMediaLiberacaoActions,
  getProdutoMediaPrincipalAction,
  getProdutoMediaScanLabel,
} from './produtoHttpPolicy';

/**
 * Extracao da lista/acoes DAM de midia ja existente em ProdutoRelationsDamSection.
 */
export default function ProdutoDamMidiaSection({
  media = [],
  mediaPage = 0,
  mediaHasMore = false,
  canView = false,
  canEdit = false,
  canApprove = false,
  canDeactivate = false,
  busy = false,
  progress = null,
  fileInputRef = null,
  onReconcileExpired,
  onReconcileInfected,
  onLiberar,
  onDownload,
  onPrincipal,
  onDeactivate,
  onPageChange,
  onUpload,
  onCancelUpload,
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Midias do produto</h3>
      {(canDeactivate || canApprove) && (
        <div className="flex flex-wrap gap-2">
          {canDeactivate && (
            <Button type="button" variant="outline" size="sm" disabled={busy}
              onClick={onReconcileExpired}
              data-action="produto-midia-reconciliar-vencidas"
              data-permission="Cadastros.Produto.inativar"
              data-sensitive>Reconciliar vencidas</Button>
          )}
          {canApprove && (
            <Button type="button" variant="outline" size="sm" disabled={busy}
              onClick={onReconcileInfected}
              data-action="produto-midia-reconciliar-infectadas"
              data-permission="Cadastros.Produto.aprovar-conteudo"
              data-sensitive>Reconciliar infectadas</Button>
          )}
        </div>
      )}
      {media.map((row) => {
        const liberacao = getProdutoMediaLiberacaoActions(row, { canApprove });
        const principalAction = getProdutoMediaPrincipalAction(row, { canEdit });
        const deactivateAction = getProdutoMediaDeactivateAction(row, { canEdit });
        const downloadAction = getProdutoMediaDownloadAction(row, { canView });
        return (
          <div key={row.id} className="flex flex-col gap-2 border-b py-2 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-2">
              <span className="min-w-0 break-all">{row.nome_arquivo}</span>
              <span className="min-w-0 break-words sm:text-right">
                {getProdutoMediaScanLabel(row)} · v{row.versao}{row.principal ? ' · principal' : ''}
              </span>
            </div>
            {(liberacao.length > 0 || principalAction || deactivateAction || downloadAction) && (
              <div className="flex flex-wrap gap-2">
                {liberacao.map((action) => (
                  <Button key={action.action} type="button" variant="outline" size="sm"
                    disabled={busy} onClick={() => onLiberar?.(row.id, action.action)}
                    data-action={`produto-midia-${action.action}`}
                    data-permission="Cadastros.Produto.aprovar-conteudo"
                    data-sensitive>{action.label}</Button>
                ))}
                {downloadAction && (
                  <Button type="button" variant="outline" size="sm"
                    disabled={busy} onClick={() => onDownload?.(row.id)}
                    data-action="produto-midia-download"
                    data-permission="Cadastros.Produto.visualizar"
                    data-sensitive>{downloadAction.label}</Button>
                )}
                {principalAction && (
                  <Button type="button" variant="outline" size="sm"
                    disabled={busy} onClick={() => onPrincipal?.(row.id)}
                    data-action="produto-midia-principal"
                    data-permission="Cadastros.Produto.editar"
                    data-sensitive>{principalAction.label}</Button>
                )}
                {deactivateAction && (
                  <Button type="button" variant="outline" size="sm"
                    disabled={busy} onClick={() => onDeactivate?.(row.id)}
                    data-action="produto-midia-inativar"
                    data-permission="Cadastros.Produto.editar"
                    data-sensitive>{deactivateAction.label}</Button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" disabled={mediaPage === 0 || busy}
          onClick={() => onPageChange?.(mediaPage - 1)}>Anterior</Button>
        <span className="text-sm">{mediaPage + 1}</span>
        <Button type="button" variant="outline" disabled={!mediaHasMore || busy}
          onClick={() => onPageChange?.(mediaPage + 1)}>Proxima</Button>
      </div>
      {canEdit && (
        <>
          <Label htmlFor="produto-dam-file">Arquivo</Label>
          <Input ref={fileInputRef} id="produto-dam-file" type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf,video/mp4"
            onChange={onUpload} disabled={busy} data-permission="Cadastros.Produto.editar" />
          {progress != null && (
            <div className="flex items-center gap-2 text-sm">
              <Upload className="h-4 w-4" />{progress}%
              <Button type="button" variant="ghost" size="icon" title="Cancelar envio"
                onClick={() => onCancelUpload?.()}><X className="h-4 w-4" /></Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
