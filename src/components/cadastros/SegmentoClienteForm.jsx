import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Users } from 'lucide-react';
import usePermissions from '@/components/lib/usePermissions';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

const sanitizeText = (value, max = 500) => String(value ?? '').replace(/[<>]/g, '').slice(0, max).trim();

export default function SegmentoClienteForm({ segmento, segmentoCliente, item, data, initialData, defaultValues, onSubmit, onSave, onClose, windowMode = false }) {
  const dadosIniciais = item || data || initialData || defaultValues || segmentoCliente || segmento;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate('Cadastros', 'SegmentoCliente') || canCreate('Comercial', 'SegmentoCliente') || canCreate('Cadastros', null);
  const podeEditar = canEdit('Cadastros', 'SegmentoCliente') || canEdit('Comercial', 'SegmentoCliente') || canEdit('Cadastros', null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    nome_segmento: '',
    tipo_segmento: 'Comercial',
    ativo: true
  });

  const buildPayload = () => ({
    ...formData,
    nome_segmento: sanitizeText(formData.nome_segmento, 180),
    nome: sanitizeText(formData.nome_segmento, 180),
    tipo_segmento: sanitizeText(formData.tipo_segmento, 80),
    descricao: sanitizeText(formData.descricao, 1000),
    group_id: groupId || formData.group_id,
    empresa_id: contexto === 'empresa' ? empresaAtual?.id : formData.empresa_id
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!podeSalvar) {
      alert(dadosIniciais?.id ? 'Sem permissao para editar segmento de cliente.' : 'Sem permissao para criar segmento de cliente.');
      return;
    }
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }

    const payload = buildPayload();
    if (!payload.nome_segmento) {
      alert('Nome do segmento e obrigatorio.');
      return;
    }

    if (onSubmit) {
      onSubmit(payload);
    } else {
      if (onSave) onSave(payload);
      if (onClose) onClose();
    }
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div>
        <Label>Nome do Segmento *</Label>
        <Input
          value={formData.nome_segmento}
          onChange={(e) => setFormData({ ...formData, nome_segmento: e.target.value })}
          placeholder="Metalurgicas, Construtoras, Varejo..."
          required
          disabled={!podeSalvar}
          data-permission="Cadastros.SegmentoCliente.editar"
          data-action="Cadastros.SegmentoCliente.nome_segmento"
          data-sensitive
        />
      </div>

      <div>
        <Label>Tipo de Segmento</Label>
        <Select value={formData.tipo_segmento} onValueChange={(v) => setFormData({ ...formData, tipo_segmento: v })} disabled={!podeSalvar}>
          <SelectTrigger data-permission="Cadastros.SegmentoCliente.editar" data-action="Cadastros.SegmentoCliente.tipo_segmento" data-sensitive>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Industrial">Industrial</SelectItem>
            <SelectItem value="Comercial">Comercial</SelectItem>
            <SelectItem value="Construcao Civil">Construcao Civil</SelectItem>
            <SelectItem value="Consumidor Final">Consumidor Final</SelectItem>
            <SelectItem value="Governo">Governo</SelectItem>
            <SelectItem value="Outro">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Descricao</Label>
        <Textarea
          value={formData.descricao || ''}
          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
          rows={3}
          disabled={!podeSalvar}
          data-permission="Cadastros.SegmentoCliente.editar"
          data-action="Cadastros.SegmentoCliente.descricao"
          data-sensitive
        />
      </div>

      <div className="flex items-center justify-between p-3 border rounded bg-slate-50">
        <Label className="font-semibold">Segmento Ativo</Label>
        <Switch
          checked={formData.ativo}
          onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
          disabled={!podeSalvar}
          data-permission="Cadastros.SegmentoCliente.alterarStatus"
          data-action="Cadastros.SegmentoCliente.ativo"
          data-sensitive
        />
      </div>

      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={!podeSalvar} data-permission="Cadastros.SegmentoCliente.salvar" data-action="Cadastros.SegmentoCliente.salvar" data-sensitive>
        {dadosIniciais ? 'Atualizar Segmento' : 'Criar Segmento'}
      </Button>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-blue-50 to-blue-100">
          <Users className="w-6 h-6 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900">
            {dadosIniciais ? 'Editar Segmento' : 'Novo Segmento de Cliente'}
          </h2>
        </div>
        <div className="flex-1 overflow-auto">{content}</div>
      </div>
    );
  }

  return content;
}
