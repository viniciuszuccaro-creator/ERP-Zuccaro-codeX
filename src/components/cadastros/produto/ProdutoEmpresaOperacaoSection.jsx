import React from 'react';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {Label} from '@/components/ui/label';
import {Switch} from '@/components/ui/switch';
import {Button} from '@/components/ui/button';
import useProdutoEmpresaOperacao from './useProdutoEmpresaOperacao';

/** Section extracted from the existing Produto form; no separate module or route. */
export default function ProdutoEmpresaOperacaoSection(props) {
  const view=useProdutoEmpresaOperacao(props);
  return <Card className="border-sky-200 bg-sky-50/40">
    <CardHeader><CardTitle className="text-base">Uso do produto nesta empresa</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-slate-600">O cadastro pertence ao Grupo. Este vínculo autoriza seu uso na empresa selecionada, sem alterar preços, estoque ou documentos existentes.</p>
      <div className="flex items-center gap-3"><Switch id="produto-empresa-ativo" checked={view.draft.ativo} disabled={!view.canSave}
        onCheckedChange={ativo=>view.changeDraft({ativo})} data-permission="Cadastros.Produto.vincular-empresa" data-action="alterar-vinculo-produto-empresa" data-sensitive/>
        <Label htmlFor="produto-empresa-ativo">Vínculo ativo</Label></div>
      <div className="flex items-center gap-3"><Switch id="produto-empresa-operacao" checked={view.draft.habilitado_operacao} disabled={!view.canSave||!view.draft.ativo}
        onCheckedChange={habilitado_operacao=>view.changeDraft({habilitado_operacao})} data-permission="Cadastros.Produto.vincular-empresa" data-action="habilitar-uso-produto-empresa" data-sensitive/>
        <Label htmlFor="produto-empresa-operacao">Habilitado para operações</Label></div>
      <p role="status" className="text-sm text-slate-600">{view.phase==='loading'?'Consultando vínculo…':view.message}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={!view.canConsult} onClick={view.reload} data-permission="Cadastros.Produto.visualizar" data-action="consultar-vinculo-produto-empresa">Consultar novamente</Button>
        <Button type="button" disabled={!view.canSave} onClick={view.save} data-permission="Cadastros.Produto.vincular-empresa" data-action="salvar-vinculo-produto-empresa" data-sensitive>{view.phase==='saving'?'Salvando…':'Salvar vínculo'}</Button>
      </div>
    </CardContent>
  </Card>;
}
