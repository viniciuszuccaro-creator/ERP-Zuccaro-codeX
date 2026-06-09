import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import InventarioContagem from './InventarioContagem';
import { z } from 'zod';
import FormWrapper from '@/components/common/FormWrapper';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

export default function InventarioForm({ windowMode = true }) { // w-full/h-full garantidos no container pai
  const { carimbarContexto, empresaAtual, grupoAtual, contexto, createInContext, updateInContext } = useContextoVisual();
  const { canCreate, canEdit, canApprove } = usePermissions();
  const [inv, setInv] = useState({ descricao: '', data_referencia: new Date().toISOString().slice(0,10), status: 'Aberto', itens: [] });
  const [salvando, setSalvando] = useState(false);
  const contextoValido = Boolean(empresaAtual?.id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id);
  const podeSalvar = canCreate('Estoque', 'Inventário') || canCreate('Estoque', 'Inventario') || canEdit('Estoque', 'Inventário') || canEdit('Estoque', 'Inventario');
  const podeAprovar = canApprove('Estoque', 'Inventário') || canApprove('Estoque', 'Inventario') || canEdit('Estoque', 'Inventário') || canEdit('Estoque', 'Inventario');
  const controlesDesabilitados = !contextoValido || !podeSalvar || salvando;
  const grupoContextoId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || inv.group_id || null;

  const auditInventario = async ({ acao, sucesso = true, motivo = null, dados = {} }) => {
    try {
      await createInContext('AuditLog', {
        acao,
        modulo: 'Estoque',
        entidade: 'Inventario',
        registro_id: dados.registro_id || inv.id || null,
        empresa_id: dados.empresa_id || inv.empresa_id || empresaAtual?.id || null,
        group_id: dados.group_id || grupoContextoId,
        grupo_id: dados.group_id || grupoContextoId,
        tipo_auditoria: sucesso ? 'entidade' : 'seguranca',
        descricao: motivo || 'Auditoria do inventario.',
        dados_anteriores: dados.dados_anteriores || null,
        dados_novos: {
          ...dados,
          contexto,
          status: dados.status || inv.status,
          total_itens: dados.total_itens ?? (Array.isArray(inv.itens) ? inv.itens.length : 0),
        },
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (_) {}
  };

  const schema = z.object({
    descricao: z.string().min(1, 'Descrição é obrigatória'),
    data_referencia: z.string().min(4, 'Data é obrigatória'),
    status: z.string(),
  });

  const salvar = async (status = 'Aberto', options = {}) => {
    if (salvando) return;

    const statusSensivel = ['Aprovado', 'Concluido', 'Concluído', 'Cancelado'].includes(status);
    if (!contextoValido) {
      await auditInventario({ acao: 'Inventario.salvar_bloqueado', sucesso: false, motivo: 'Contexto de grupo ou empresa obrigatorio.', dados: { status } });
      return toast.error('Selecione um grupo ou empresa antes de salvar inventario.');
    }
    if (!podeSalvar) {
      await auditInventario({ acao: 'Inventario.salvar_negado', sucesso: false, motivo: 'Permissao negada para salvar inventario.', dados: { status } });
      return toast.error('Sem permissao para salvar inventario.');
    }
    if (statusSensivel && options.confirmar !== false) {
      const confirmado = window.confirm(`Confirma alterar o inventario para "${status}"? Esta acao sera auditada.`);
      if (!confirmado) {
        await auditInventario({ acao: 'Inventario.salvar_cancelado', sucesso: false, motivo: 'Confirmacao cancelada pelo usuario.', dados: { status } });
        return;
      }
    }

    setSalvando(true);
    const dadosAnteriores = inv.id ? { ...inv } : null;
    try {
      const payload = carimbarContexto({ ...inv, status }, 'empresa_id');
      let res;
      if (inv.id) res = await updateInContext('Inventario', inv.id, payload);
      else res = await createInContext('Inventario', payload);

      await auditInventario({
        acao: inv.id ? 'Inventario.editado' : 'Inventario.criado',
        sucesso: true,
        dados: {
          registro_id: res?.id || inv.id || null,
          empresa_id: payload.empresa_id || res?.empresa_id || null,
          group_id: payload.group_id || res?.group_id || null,
          status,
          total_itens: Array.isArray(payload.itens) ? payload.itens.length : 0,
          dados_anteriores: dadosAnteriores,
          dados_novos: res || payload,
        },
      });

      setInv(res);
      toast.success('Inventario salvo');
    } catch (e) {
      await auditInventario({ acao: 'Inventario.erro_salvar', sucesso: false, motivo: e?.message || 'Erro ao salvar inventario.', dados: { status } });
      toast.error(e?.message || 'Erro ao salvar inventario.');
    } finally { setSalvando(false); }
  };

  const aprovar = async () => {
    if (!contextoValido) {
      await auditInventario({ acao: 'Inventario.aprovar_bloqueado', sucesso: false, motivo: 'Contexto de grupo ou empresa obrigatorio.', dados: { status: 'Aprovado' } });
      return toast.error('Selecione um grupo ou empresa antes de aprovar inventario.');
    }
    if (!podeAprovar) {
      await auditInventario({ acao: 'Inventario.aprovar_negado', sucesso: false, motivo: 'Permissao negada para aprovar inventario.', dados: { status: 'Aprovado' } });
      return toast.error('Sem permissao para aprovar inventario.');
    }
    if (!inv.id) {
      await auditInventario({ acao: 'Inventario.aprovar_bloqueado', sucesso: false, motivo: 'Inventario precisa ser salvo antes da aprovacao.', dados: { status: 'Aprovado' } });
      return toast.error('Salve o inventario antes de aprovar');
    }
    await salvar('Aprovado');
    toast.info('Ajustes serao aplicados automaticamente');
  };

  return (
    <Card className="w-full h-full flex flex-col" data-permission="Estoque.Inventario" data-context-required="group-or-company" data-context-mode={contexto}>
      <CardHeader className="border-b bg-slate-50">
        <CardTitle>Inventário</CardTitle>
      </CardHeader>
      {(!contextoValido || !podeSalvar) && (
        <div className="px-4 pt-4">
          <Alert variant="destructive">
            <AlertDescription>
              O inventario exige contexto de grupo/empresa e permissao de estoque para salvar ou aplicar ajustes.
            </AlertDescription>
          </Alert>
        </div>
      )}
      <FormWrapper schema={schema} defaultValues={inv} onSubmit={() => salvar('Em Contagem')} externalData={inv} className="flex-1 overflow-auto p-4 space-y-4">
        <CardContent className="flex-1 overflow-auto p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-600">Descrição</label>
            <Input
              value={inv.descricao}
              disabled={controlesDesabilitados}
              onChange={(e)=>setInv({ ...inv, descricao: e.target.value })}
              placeholder="Inventário Mês/Ano"
              data-action="Estoque.Inventario.descricao"
              data-permission="Estoque.Inventario.editar"
              data-context-required="group-or-company"
            />
          </div>
          <div>
            <label className="text-xs text-slate-600">Data de Referência</label>
            <Input
              type="date"
              value={inv.data_referencia}
              disabled={controlesDesabilitados}
              onChange={(e)=>setInv({ ...inv, data_referencia: e.target.value })}
              data-action="Estoque.Inventario.dataReferencia"
              data-permission="Estoque.Inventario.editar"
              data-context-required="group-or-company"
            />
          </div>
          <div>
            <label className="text-xs text-slate-600">Status</label>
            <Select value={inv.status} disabled={controlesDesabilitados} onValueChange={(v)=>setInv({ ...inv, status: v })}>
              <SelectTrigger
                data-action="Estoque.Inventario.status"
                data-permission="Estoque.Inventario.editar"
                data-context-required="group-or-company"
              ><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Aberto">Aberto</SelectItem>
                <SelectItem value="Em Contagem">Em Contagem</SelectItem>
                <SelectItem value="Em Aprovação">Em Aprovação</SelectItem>
                <SelectItem value="Aprovado">Aprovado</SelectItem>
                <SelectItem value="Concluído">Concluído</SelectItem>
                <SelectItem value="Cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <InventarioContagem itens={inv.itens} disabled={controlesDesabilitados} onChange={(itens)=>setInv({ ...inv, itens })} />

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button
            variant="outline"
            type="submit"
            disabled={controlesDesabilitados}
            data-action="Estoque.Inventario.salvar"
            data-permission="Estoque.Inventario.editar"
            data-context-required="group-or-company"
            data-sensitive="true"
          >Salvar</Button>
          <Button
            type="button"
            onClick={aprovar}
            className="bg-green-600 hover:bg-green-700"
            disabled={salvando || inv.status==='Concluído' || !contextoValido || !podeAprovar}
            data-action="Estoque.Inventario.aprovarAplicar"
            data-permission="Estoque.Inventario.aprovar"
            data-context-required="group-or-company"
            data-sensitive="true"
          >Aprovar e Aplicar Ajustes</Button>
        </div>
      </CardContent>
      </FormWrapper>
    </Card>
  );
}
