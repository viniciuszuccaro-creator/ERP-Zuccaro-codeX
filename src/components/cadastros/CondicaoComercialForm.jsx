import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign } from 'lucide-react';
import usePermissions from '@/components/lib/usePermissions';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import CadastroCodigoRegistroField from '@/components/cadastros/CadastroCodigoRegistroField';

const sanitizeText = (value, max = 500) => String(value ?? '').replace(/[<>]/g, '').slice(0, max).trim();
const emptyCondicao = {
  nome_condicao: '',
  tipo_condicao: 'Pagamento',
  forma_pagamento: 'À Vista',
  numero_parcelas: 1,
  intervalo_parcelas_dias: 30,
  desconto_percentual: 0,
  tipo_frete: 'CIF',
  ativo: true,
};

export default function CondicaoComercialForm({
  condicao,
  condicaoComercial,
  item,
  data,
  initialData,
  defaultValues,
  onSubmit,
  windowMode = false,
}) {
  const dadosIniciais = item || data || initialData || defaultValues || condicaoComercial || condicao;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "CondicaoComercial") || canCreate("Financeiro", "CondicaoComercial") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "CondicaoComercial") || canEdit("Financeiro", "CondicaoComercial") || canEdit("Cadastros", null);
  const [formData, setFormData] = useState(() => ({ ...emptyCondicao, ...(dadosIniciais || {}) }));

  const prevIdRef = useRef(dadosIniciais?.id);
  useEffect(() => {
    if (dadosIniciais?.id && dadosIniciais.id !== prevIdRef.current) {
      prevIdRef.current = dadosIniciais.id;
      setFormData({ ...emptyCondicao, ...dadosIniciais });
    }
  }, [dadosIniciais?.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (dadosIniciais?.id && !podeEditar) {
      alert("Sem permissao para editar condicoes comerciais.");
      return;
    }
    if (!dadosIniciais?.id && !podeCriar) {
      alert("Sem permissao para criar condicoes comerciais.");
      return;
    }
    const nome = sanitizeText(formData.nome_condicao || formData.nome || '', 180);
    onSubmit({
      ...formData,
      nome_condicao: nome,
      nome,
      group_id: groupId || formData.group_id,
      empresa_id: contexto === 'empresa' ? empresaAtual?.id : formData.empresa_id,
    });
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <CadastroCodigoRegistroField
        idOnly
        hasId={Boolean(dadosIniciais?.id)}
        entityId={dadosIniciais?.id}
        action="id-tecnico-condicao-comercial"
      />
      <div>
        <Label>Nome da Condição *</Label>
        <Input
          value={formData.nome_condicao}
          onChange={(e) => setFormData({ ...formData, nome_condicao: e.target.value })}
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
        className="w-full bg-green-600 hover:bg-green-700"
        disabled={dadosIniciais?.id ? !podeEditar : !podeCriar}
        data-permission="Cadastros.CondicaoComercial.salvar"
        data-sensitive
      >
        {dadosIniciais ? 'Atualizar Condição' : 'Criar Condição Comercial'}
      </Button>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-green-50 to-green-100">
          <DollarSign className="w-6 h-6 text-green-600" />
          <h2 className="text-lg font-bold text-slate-900">
            {dadosIniciais ? 'Editar Condição' : 'Nova Condição Comercial'}
          </h2>
        </div>
        <div className="flex-1 overflow-auto">{content}</div>
      </div>
    );
  }

  return content;
}
