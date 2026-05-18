import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Users } from 'lucide-react';

export default function SegmentoClienteForm({ segmento, segmentoCliente, item, data, initialData, defaultValues, onSubmit, onSave, onClose, windowMode = false }) {
  const dadosIniciais = item || data || initialData || defaultValues || segmentoCliente || segmento;
  const [formData, setFormData] = useState(dadosIniciais || {
    nome_segmento: '',
    tipo_segmento: 'Comercial',
    ativo: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(formData);
    } else {
      if (onSave) onSave();
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
          placeholder="Metalúrgicas, Construtoras, Varejo..."
          required
          data-permission="Cadastros.SegmentoCliente.editar"
          data-action="Cadastros.SegmentoCliente.nome_segmento"
        />
      </div>

      <div>
        <Label>Tipo de Segmento</Label>
        <Select value={formData.tipo_segmento} onValueChange={(v) => setFormData({ ...formData, tipo_segmento: v })}>
          <SelectTrigger data-permission="Cadastros.SegmentoCliente.editar" data-action="Cadastros.SegmentoCliente.tipo_segmento">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Industrial">Industrial</SelectItem>
            <SelectItem value="Comercial">Comercial</SelectItem>
            <SelectItem value="Construção Civil">Construção Civil</SelectItem>
            <SelectItem value="Consumidor Final">Consumidor Final</SelectItem>
            <SelectItem value="Governo">Governo</SelectItem>
            <SelectItem value="Outro">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Descrição</Label>
        <Textarea
          value={formData.descricao || ''}
          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
          rows={3}
          data-permission="Cadastros.SegmentoCliente.editar"
          data-action="Cadastros.SegmentoCliente.descricao"
        />
      </div>

      <div className="flex items-center justify-between p-3 border rounded bg-slate-50">
        <Label className="font-semibold">Segmento Ativo</Label>
        <Switch
          checked={formData.ativo}
          onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
          data-permission="Cadastros.SegmentoCliente.editar"
          data-action="Cadastros.SegmentoCliente.ativo"
          data-sensitive="true"
        />
      </div>

      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" data-permission="Cadastros.SegmentoCliente.editar" data-action="Cadastros.SegmentoCliente.salvar" data-sensitive="true">
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
