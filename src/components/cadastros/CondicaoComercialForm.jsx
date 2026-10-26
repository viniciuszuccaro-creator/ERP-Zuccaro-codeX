import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign } from 'lucide-react';
import usePermissions from '@/components/lib/usePermissions';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import CadastroCodigoRegistroField from "@/components/cadastros/CadastroCodigoRegistroField";
import useCadastroReopenOnIdentity from "@/components/cadastros/useCadastroReopenOnIdentity";

/**
 * Reopen canônico (#353): useCadastroReopenOnIdentity — anti-wipe em troca de
 * registro/updated_date; ID técnico vinculado ao boundId. idOnly preservado
 * (condição comercial não renumerar código hierárquico/legado neste form).
 */
export default function CondicaoComercialForm({
  condicao,
  condicaoComercial,
  item,
  data,
  initialData,
  defaultValues,
  onSubmit,
  isSubmitting = false,
  windowMode = false,
}) {
  const dadosIniciais = item || data || initialData || defaultValues || condicaoComercial || condicao;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "CondicaoComercial") || canCreate("Financeiro", "CondicaoComercial") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "CondicaoComercial") || canEdit("Financeiro", "CondicaoComercial") || canEdit("Cadastros", null);
  const emptyFormData = {
    nome_condicao: '',
    tipo_condicao: 'Pagamento',
    forma_pagamento: 'À Vista',
    numero_parcelas: 1,
    intervalo_parcelas_dias: 30,
    desconto_percentual: 0,
    tipo_frete: 'CIF',
    ativo: true,
  };
  const [formData, setFormData] = useState(dadosIniciais || emptyFormData);

  const { boundId: condicaoBoundId } = useCadastroReopenOnIdentity(dadosIniciais, {
    formData,
    setFormData,
    emptyForm: emptyFormData,
    mapToForm: (record) => record || emptyFormData,
  });
  const podeSalvar = condicaoBoundId ? podeEditar : podeCriar;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (condicaoBoundId && !podeEditar) {
      alert("Sem permissao para editar condicoes comerciais.");
      return;
    }
    if (!condicaoBoundId && !podeCriar) {
      alert("Sem permissao para criar condicoes comerciais.");
      return;
    }
    onSubmit({
      ...formData,
      ...(condicaoBoundId ? { id: condicaoBoundId } : {}),
      nome: formData.nome_condicao || formData.nome || '',
      group_id: groupId || formData.group_id,
      empresa_id: contexto === 'empresa' ? empresaAtual?.id : formData.empresa_id,
    });
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <CadastroCodigoRegistroField
        idOnly
        hasId={Boolean(condicaoBoundId)}
        entityId={condicaoBoundId}
        action="id-tecnico-condicao-comercial"
      />
      <div>
        <Label>Nome da Condição *</Label>
        <Input
          value={formData.nome_condicao}
          onChange={(e) => setFormData({ ...formData, nome_condicao: e.target.value })}
          placeholder="Ex: À vista, 30/60 dias"
          data-action="editar-nome-condicao-comercial"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Tipo de Condição</Label>
          <Select value={formData.tipo_condicao} onValueChange={(v) => setFormData({ ...formData, tipo_condicao: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Pagamento">Pagamento</SelectItem>
              <SelectItem value="Desconto">Desconto</SelectItem>
              <SelectItem value="Frete">Frete</SelectItem>
              <SelectItem value="Prazo Entrega">Prazo Entrega</SelectItem>
              <SelectItem value="Comissão">Comissão</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Forma de Pagamento</Label>
          <Select value={formData.forma_pagamento} onValueChange={(v) => setFormData({ ...formData, forma_pagamento: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="À Vista">À Vista</SelectItem>
              <SelectItem value="Parcelado">Parcelado</SelectItem>
              <SelectItem value="Boleto">Boleto</SelectItem>
              <SelectItem value="PIX">PIX</SelectItem>
              <SelectItem value="Cartão">Cartão</SelectItem>
              <SelectItem value="Depósito">Depósito</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {formData.forma_pagamento === 'Parcelado' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Número de Parcelas</Label>
            <Input
              type="number"
              value={formData.numero_parcelas}
              onChange={(e) => setFormData({ ...formData, numero_parcelas: parseInt(e.target.value) })}
              min="1"
            />
          </div>
          <div>
            <Label>Intervalo entre Parcelas (dias)</Label>
            <Input
              type="number"
              value={formData.intervalo_parcelas_dias}
              onChange={(e) => setFormData({ ...formData, intervalo_parcelas_dias: parseInt(e.target.value) })}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Desconto (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.desconto_percentual}
            onChange={(e) => setFormData({ ...formData, desconto_percentual: parseFloat(e.target.value) })}
          />
        </div>
        <div>
          <Label>Tipo de Frete</Label>
          <Select value={formData.tipo_frete} onValueChange={(v) => setFormData({ ...formData, tipo_frete: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CIF">CIF</SelectItem>
              <SelectItem value="FOB">FOB</SelectItem>
              <SelectItem value="Retira">Retira</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Descrição</Label>
        <Textarea
          value={formData.descricao || ''}
          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
          rows={2}
          data-action="editar-descricao-condicao-comercial"
        />
      </div>

      <div className="flex items-center justify-between p-3 border rounded bg-slate-50">
        <Label className="font-semibold">Condição Ativa</Label>
        <Switch
          checked={formData.ativo}
          onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-sky-600 hover:bg-sky-700"
        disabled={isSubmitting || !podeSalvar}
        data-permission="Cadastros.CondicaoComercial.salvar"
        data-sensitive
      >
        {isSubmitting ? 'Salvando…' : (condicaoBoundId ? 'Atualizar Condição' : 'Criar Condição Comercial')}
      </Button>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-sky-50 to-sky-100">
          <DollarSign className="w-6 h-6 text-sky-600" />
          <h2 className="text-lg font-bold text-slate-900">
            {condicaoBoundId ? 'Editar Condição' : 'Nova Condição Comercial'}
          </h2>
        </div>
        <div className="flex-1 overflow-auto">{content}</div>
      </div>
    );
  }

  return content;
}
