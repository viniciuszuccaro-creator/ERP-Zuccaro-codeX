import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TrendingUp } from 'lucide-react';
import usePermissions from '@/components/lib/usePermissions';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import CadastroCodigoRegistroField from "@/components/cadastros/CadastroCodigoRegistroField";
import useCadastroReopenOnIdentity from "@/components/cadastros/useCadastroReopenOnIdentity";

const EMPTY_MOEDA = {
  codigo: '',
  nome: '',
  tipo: 'Moeda',
  cotacao_atual: 1,
  ativo: true,
  empresa_id: '',
  group_id: '',
};

const mapMoedaIndiceToForm = (record, defaults = {}) => {
  if (!record) {
    return {
      ...EMPTY_MOEDA,
      empresa_id: defaults.empresa_id || '',
      group_id: defaults.group_id || '',
    };
  }
  return {
    ...EMPTY_MOEDA,
    ...record,
    cotacao_atual: Number.isFinite(Number(record.cotacao_atual))
      ? Number(record.cotacao_atual)
      : 1,
    ativo: record.ativo !== false,
  };
};

/**
 * Reopen canônico (#353): useCadastroReopenOnIdentity — anti-wipe em troca de
 * registro/updated_at|updated_date; código/ID vinculados ao boundId.
 */
export default function MoedaIndiceForm({ moeda, moedaIndice, item, data, onSubmit, onSave, onClose, windowMode = false }) {
  const dadosIniciais = item || data || moedaIndice || moeda;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const emptyForm = mapMoedaIndiceToForm(null, {
    empresa_id: empresaAtual?.id || '',
    group_id: groupId || '',
  });
  const [formData, setFormData] = useState(() => mapMoedaIndiceToForm(dadosIniciais, emptyForm));

  const { boundId: moedaBoundId } = useCadastroReopenOnIdentity(dadosIniciais, {
    formData,
    setFormData,
    emptyForm,
    mapToForm: (record) => mapMoedaIndiceToForm(record, emptyForm),
  });

  const podeCriar = canCreate("Cadastros", "MoedaIndice") || canCreate("Financeiro", "MoedaIndice") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "MoedaIndice") || canEdit("Financeiro", "MoedaIndice") || canEdit("Cadastros", null);
  const podeSalvar = moedaBoundId ? podeEditar : podeCriar;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (moedaBoundId && !podeEditar) {
      alert("Sem permissao para editar moedas e indices.");
      return;
    }
    if (!moedaBoundId && !podeCriar) {
      alert("Sem permissao para criar moedas e indices.");
      return;
    }
    if (!contextoValido) {
      alert("Selecione um grupo ou empresa antes de salvar.");
      return;
    }
    const payload = {
      ...formData,
      ...(moedaBoundId ? { id: moedaBoundId } : {}),
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
      <CadastroCodigoRegistroField
        idOnly
        hasId={Boolean(moedaBoundId)}
        entityId={moedaBoundId}
        action="id-tecnico-moeda-indice"
      />
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
        className="w-full bg-sky-600 hover:bg-sky-700"
        disabled={!contextoValido || !podeSalvar}
        data-permission="Cadastros.MoedaIndice.salvar"
        data-action="salvar-moeda-indice"
        data-sensitive
      >
        {moedaBoundId ? 'Atualizar' : 'Criar Moeda/Índice'}
      </Button>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-sky-50 to-sky-100">
          <TrendingUp className="w-6 h-6 text-sky-600" />
          <h2 className="text-lg font-bold text-slate-900">
            {moedaBoundId ? 'Editar Moeda/Índice' : 'Nova Moeda/Índice'}
          </h2>
        </div>
        <div className="flex-1 overflow-auto">{content}</div>
      </div>
    );
  }

  return content;
}
