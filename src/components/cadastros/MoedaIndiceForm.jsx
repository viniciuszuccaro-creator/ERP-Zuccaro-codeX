import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TrendingUp } from 'lucide-react';
import usePermissions from '@/components/lib/usePermissions';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

export default function MoedaIndiceForm({ moeda, moedaIndice, item, data, onSubmit, onSave, onClose, windowMode = false }) {
  const dadosIniciais = item || data || moedaIndice || moeda;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "MoedaIndice") || canCreate("Financeiro", "MoedaIndice") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "MoedaIndice") || canEdit("Financeiro", "MoedaIndice") || canEdit("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    codigo: '',
    nome: '',
    tipo: 'Moeda',
    cotacao_atual: 1,
    ativo: true
  });

  const prevIdRef = React.useRef(dadosIniciais?.id);
  useEffect(() => {
    if (dadosIniciais?.id && dadosIniciais.id !== prevIdRef.current) {
      prevIdRef.current = dadosIniciais.id;
      setFormData({ ...dadosIniciais });
    }
  }, [dadosIniciais?.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (dadosIniciais?.id && !podeEditar) {
      alert("Sem permissao para editar moedas e indices.");
      return;
    }
    if (!dadosIniciais?.id && !podeCriar) {
      alert("Sem permissao para criar moedas e indices.");
      return;
    }
    if (!contextoValido) {
      alert("Selecione um grupo ou empresa antes de salvar.");
      return;
    }
    const payload = {
      ...formData,
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
    };
    if (onSubmit) {
      onSubmit(payload);
    } else {
      if (onSave) onSave();
      if (onClose) onClose();
    }
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Código *</Label>
          <Input
            value={formData.codigo}
            onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
            placeholder="USD, EUR, IPCA..."
            required
            disabled={!podeSalvar}
            data-permission="Financeiro.MoedaIndice.editar"
            data-action="editar-codigo-moeda-indice"
            data-sensitive
          />
        </div>
        <div>
          <Label>Nome *</Label>
          <Input
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            required
            disabled={!podeSalvar}
            data-permission="Financeiro.MoedaIndice.editar"
            data-action="editar-nome-moeda-indice"
            data-sensitive
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Tipo</Label>
          <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
            <SelectTrigger disabled={!podeSalvar} data-permission="Financeiro.MoedaIndice.editar" data-action="selecionar-tipo-moeda-indice" data-sensitive>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Moeda">Moeda</SelectItem>
              <SelectItem value="Índice">Índice</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Cotação Atual</Label>
          <Input
            type="number"
            step="0.0001"
            value={formData.cotacao_atual}
            onChange={(e) => setFormData({ ...formData, cotacao_atual: parseFloat(e.target.value) })}
            disabled={!podeSalvar}
            data-permission="Financeiro.MoedaIndice.editar"
            data-action="editar-cotacao-moeda-indice"
            data-sensitive
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-3 border rounded bg-slate-50">
        <Label className="font-semibold">Ativo</Label>
        <Switch
          checked={formData.ativo}
          onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
          disabled={!podeSalvar}
          data-permission="Financeiro.MoedaIndice.alterarStatus"
          data-action="alternar-status-moeda-indice"
          data-sensitive
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-emerald-600 hover:bg-emerald-700"
        disabled={!contextoValido || !podeSalvar}
        data-permission="Cadastros.MoedaIndice.salvar"
        data-action="salvar-moeda-indice"
        data-sensitive
      >
        {dadosIniciais ? 'Atualizar' : 'Criar Moeda/Índice'}
      </Button>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-emerald-50 to-emerald-100">
          <TrendingUp className="w-6 h-6 text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-900">
            {dadosIniciais ? 'Editar Moeda/Índice' : 'Nova Moeda/Índice'}
          </h2>
        </div>
        <div className="flex-1 overflow-auto">{content}</div>
      </div>
    );
  }

  return content;
}
