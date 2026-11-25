import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { MapPin } from 'lucide-react';
import usePermissions from '@/components/lib/usePermissions';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import CadastroCodigoRegistroField from '@/components/cadastros/CadastroCodigoRegistroField';
import useCadastroReopenOnIdentity from '@/components/cadastros/useCadastroReopenOnIdentity';

const EMPTY_ROTA = {
  nome_rota: '',
  codigo: '',
  descricao: '',
  origem: '',
  destino: '',
  distancia_km: 0,
  tempo_medio_horas: 0,
  ativo: true,
  empresa_id: '',
  group_id: '',
};

const mapRotaPadraoToForm = (record, defaults = {}) => {
  if (!record) {
    return {
      ...EMPTY_ROTA,
      empresa_id: defaults.empresa_id || '',
      group_id: defaults.group_id || '',
    };
  }
  return {
    ...EMPTY_ROTA,
    ...record,
    nome_rota: record.nome_rota || record.nome || '',
    codigo: record.codigo == null ? '' : String(record.codigo),
    descricao: record.descricao == null ? '' : String(record.descricao),
    origem: record.origem == null ? '' : String(record.origem),
    destino: record.destino == null ? '' : String(record.destino),
    distancia_km: Number.isFinite(Number(record.distancia_km)) ? Number(record.distancia_km) : 0,
    tempo_medio_horas: Number.isFinite(Number(record.tempo_medio_horas)) ? Number(record.tempo_medio_horas) : 0,
    ativo: record.ativo !== false,
  };
};

/**
 * Reopen canônico (#353): useCadastroReopenOnIdentity — updated_at|updated_date,
 * preservação origem/destino/distância; CodigoField; identidade no boundId.
 */
export default function RotaPadraoForm({
  rota, rotaPadrao, item, data, initialData, defaultValues, onSubmit, windowMode = false,
}) {
  const dadosIniciais = item || data || initialData || defaultValues || rotaPadrao || rota;
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const emptyForm = mapRotaPadraoToForm(null, {
    empresa_id: empresaAtual?.id || '',
    group_id: groupId || '',
  });
  const [formData, setFormData] = useState(() => mapRotaPadraoToForm(dadosIniciais, emptyForm));

  const { boundId: rotaBoundId } = useCadastroReopenOnIdentity(dadosIniciais, {
    formData,
    setFormData,
    emptyForm,
    mapToForm: (record) => mapRotaPadraoToForm(record, emptyForm),
  });

  const podeCriar = hasPermission?.('Cadastros.RotaPadrao.criar') || hasPermission?.('Logistica.RotaPadrao.criar');
  const podeEditar = hasPermission?.('Cadastros.RotaPadrao.editar') || hasPermission?.('Logistica.RotaPadrao.editar');
  const podeSalvar = rotaBoundId ? podeEditar : podeCriar;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeSalvar) {
      alert('Sem permissão para salvar rota padrão.');
      return;
    }
    onSubmit({
      ...formData,
      ...(rotaBoundId ? { id: rotaBoundId } : {}),
      group_id: groupId || formData.group_id,
      empresa_id: contexto === 'empresa' ? empresaAtual?.id : formData.empresa_id,
      nome: formData.nome_rota || formData.nome || '',
    });
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <CadastroCodigoRegistroField
        hasId={Boolean(rotaBoundId)}
        entityId={rotaBoundId}
        value={formData.codigo}
        action="codigo-registro-rota-padrao"
      />
      <div>
        <Label>Nome da Rota *</Label>
        <Input
          value={formData.nome_rota}
          onChange={(e) => setFormData({ ...formData, nome_rota: e.target.value })}
          required
          disabled={!podeSalvar}
          data-permission="Cadastros.RotaPadrao.editar"
          data-action="editar-nome-rota-padrao"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Origem</Label>
          <Input
            value={formData.origem}
            onChange={(e) => setFormData({ ...formData, origem: e.target.value })}
            disabled={!podeSalvar}
            data-permission="Cadastros.RotaPadrao.editar"
            data-action="editar-origem-rota-padrao"
          />
        </div>
        <div>
          <Label>Destino</Label>
          <Input
            value={formData.destino}
            onChange={(e) => setFormData({ ...formData, destino: e.target.value })}
            disabled={!podeSalvar}
            data-permission="Cadastros.RotaPadrao.editar"
            data-action="editar-destino-rota-padrao"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Distância (km)</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.distancia_km}
            onChange={(e) => setFormData({ ...formData, distancia_km: parseFloat(e.target.value) || 0 })}
            disabled={!podeSalvar}
            data-permission="Cadastros.RotaPadrao.editar"
            data-action="editar-distancia-rota-padrao"
          />
        </div>
        <div>
          <Label>Tempo Médio (horas)</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.tempo_medio_horas}
            onChange={(e) => setFormData({ ...formData, tempo_medio_horas: parseFloat(e.target.value) || 0 })}
            disabled={!podeSalvar}
            data-permission="Cadastros.RotaPadrao.editar"
            data-action="editar-tempo-rota-padrao"
          />
        </div>
      </div>

      <div>
        <Label>Descrição</Label>
        <Textarea
          value={formData.descricao}
          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
          rows={2}
          disabled={!podeSalvar}
          data-permission="Cadastros.RotaPadrao.editar"
          data-action="editar-descricao-rota-padrao"
        />
      </div>

      <div className="flex items-center justify-between p-3 border border-sky-100 rounded bg-sky-50/50">
        <Label className="font-semibold">Rota Ativa</Label>
        <Switch
          checked={formData.ativo}
          disabled={!podeSalvar}
          data-permission="Cadastros.RotaPadrao.alterarStatus"
          data-action="alternar-status-rota-padrao"
          data-sensitive="true"
          onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-sky-600 hover:bg-sky-700"
        disabled={!contextoValido || !podeSalvar}
        data-permission="Cadastros.RotaPadrao.salvar"
        data-action="salvar-rota-padrao"
        data-sensitive="true"
      >
        {rotaBoundId ? 'Atualizar' : 'Criar Rota Padrão'}
      </Button>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-sky-50 to-sky-100">
          <MapPin className="w-6 h-6 text-sky-600" />
          <h2 className="text-lg font-bold text-slate-900">
            {rotaBoundId ? 'Editar Rota' : 'Nova Rota Padrão'}
          </h2>
        </div>
        <div className="flex-1 overflow-auto">{content}</div>
      </div>
    );
  }

  return content;
}
