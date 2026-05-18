import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { MapPin } from 'lucide-react';
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

export default function RotaPadraoForm({ rota, rotaPadrao, onSubmit, windowMode = false }) {
  const dadosIniciais = rotaPadrao || rota;
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = hasPermission?.("Cadastros.RotaPadrao.criar") || hasPermission?.("Logistica.RotaPadrao.criar");
  const podeEditar = hasPermission?.("Cadastros.RotaPadrao.editar") || hasPermission?.("Logistica.RotaPadrao.editar");
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    nome_rota: '',
    descricao: '',
    origem: '',
    destino: '',
    distancia_km: 0,
    tempo_medio_horas: 0,
    ativo: true
  });

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
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
      nome: formData.nome_rota || formData.nome || ''
    });
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div>
        <Label>Nome da Rota *</Label>
        <Input
          value={formData.nome_rota}
          onChange={(e) => setFormData({ ...formData, nome_rota: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Origem</Label>
          <Input
            value={formData.origem}
            onChange={(e) => setFormData({ ...formData, origem: e.target.value })}
          />
        </div>
        <div>
          <Label>Destino</Label>
          <Input
            value={formData.destino}
            onChange={(e) => setFormData({ ...formData, destino: e.target.value })}
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
            onChange={(e) => setFormData({ ...formData, distancia_km: parseFloat(e.target.value) })}
          />
        </div>
        <div>
          <Label>Tempo Médio (horas)</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.tempo_medio_horas}
            onChange={(e) => setFormData({ ...formData, tempo_medio_horas: parseFloat(e.target.value) })}
          />
        </div>
      </div>

      <div>
        <Label>Descrição</Label>
        <Textarea
          value={formData.descricao}
          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
          rows={2}
        />
      </div>

      <div className="flex items-center justify-between p-3 border rounded bg-slate-50">
        <Label className="font-semibold">Rota Ativa</Label>
        <Switch
          checked={formData.ativo}
          disabled={!podeSalvar}
          data-permission="Cadastros.RotaPadrao.alterarStatus"
          data-sensitive="true"
          onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-orange-600 hover:bg-orange-700"
        disabled={!contextoValido || !podeSalvar}
        data-permission="Cadastros.RotaPadrao.salvar"
        data-sensitive="true"
      >
        {dadosIniciais ? 'Atualizar' : 'Criar Rota Padrão'}
      </Button>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-orange-50 to-orange-100">
          <MapPin className="w-6 h-6 text-orange-600" />
          <h2 className="text-lg font-bold text-slate-900">
            {dadosIniciais ? 'Editar Rota' : 'Nova Rota Padrão'}
          </h2>
        </div>
        <div className="flex-1 overflow-auto">{content}</div>
      </div>
    );
  }

  return content;
}
