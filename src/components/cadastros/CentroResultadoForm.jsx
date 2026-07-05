import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Target } from 'lucide-react';
import usePermissions from '@/components/lib/usePermissions';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

const sanitizeText = (value, max = 255) => String(value ?? '').replace(/[<>]/g, '').slice(0, max).trim();
const sanitizeCode = (value) => String(value ?? '').replace(/[^0-9A-Za-z._-]/g, '').slice(0, 40).trim().toUpperCase();

export default function CentroResultadoForm({ centro, centroResultado, item, data, initialData, defaultValues, onSubmit, onSave, onClose, windowMode = false }) {
  const dadosIniciais = item || data || initialData || defaultValues || centroResultado || centro;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "CentroResultado") || canCreate("Financeiro", "CentroResultado") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "CentroResultado") || canEdit("Financeiro", "CentroResultado") || canEdit("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || { codigo: '', nome: '', descricao: '', ativo: true });

  useEffect(() => {
    if (dadosIniciais?.id) setFormData({ ...dadosIniciais });
  }, [dadosIniciais?.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!podeSalvar) {
      alert(dadosIniciais?.id ? "Sem permissao para editar centros de resultado." : "Sem permissao para criar centros de resultado.");
      return;
    }
    if (!contextoValido) {
      alert("Selecione um grupo ou empresa antes de salvar.");
      return;
    }
    const payload = {
      ...formData,
      codigo: sanitizeCode(formData.codigo),
      nome: sanitizeText(formData.nome, 180),
      descricao: sanitizeText(formData.descricao, 1000),
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id
    };
    if (!payload.codigo || !payload.nome) {
      alert('Preencha codigo e nome.');
      return;
    }
    if (onSubmit) onSubmit(payload);
    else {
      if (onSave) onSave();
      if (onClose) onClose();
    }
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Codigo *</Label>
          <Input value={formData.codigo} onChange={(e) => setFormData({ ...formData, codigo: e.target.value })} required disabled={!podeSalvar} data-permission="Cadastros.CentroResultado.editar" data-action="editar-codigo-centro-resultado" data-sensitive />
        </div>
        <div>
          <Label>Nome *</Label>
          <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required disabled={!podeSalvar} data-permission="Cadastros.CentroResultado.editar" data-action="editar-nome-centro-resultado" data-sensitive />
        </div>
      </div>

      <div>
        <Label>Descricao</Label>
        <Textarea value={formData.descricao || ''} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={2} disabled={!podeSalvar} data-permission="Cadastros.CentroResultado.editar" data-action="editar-descricao-centro-resultado" data-sensitive />
      </div>

      <div className="flex items-center justify-between p-3 border rounded bg-slate-50">
        <Label className="font-semibold">Centro Ativo</Label>
        <Switch checked={!!formData.ativo} onCheckedChange={(v) => setFormData({ ...formData, ativo: v })} disabled={!podeSalvar} data-permission="Cadastros.CentroResultado.alterarStatus" data-action="alternar-status-centro-resultado" data-sensitive />
      </div>

      <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={!contextoValido || !podeSalvar} data-permission="Cadastros.CentroResultado.salvar" data-action="salvar-centro-resultado" data-sensitive>
        {dadosIniciais ? 'Atualizar' : 'Criar Centro de Resultado'}
      </Button>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-teal-50 to-teal-100">
          <Target className="w-6 h-6 text-teal-600" />
          <h2 className="text-lg font-bold text-slate-900">{dadosIniciais ? 'Editar Centro' : 'Novo Centro de Resultado'}</h2>
        </div>
        <div className="flex-1 overflow-auto">{content}</div>
      </div>
    );
  }
  return content;
}
