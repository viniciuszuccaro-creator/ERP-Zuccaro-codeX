import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Package } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import CadastroCodigoRegistroField from "@/components/cadastros/CadastroCodigoRegistroField";

const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const emptyTipoFrete = {
  descricao: '',
  modalidade: 'CIF',
  cobra_frete: true,
  calculo_automatico: false,
  formula_calculo: 'Por KM',
  valor_base_km: 0,
  responsavel_pagamento: 'Empresa',
  ativo: true,
};

/**
 * Tipo de frete — aliases Visualizador + reopen por id.
 */
export default function TipoFreteForm({
  tipo, tipoFrete, item, data, initialData, defaultValues, onSubmit, isSubmitting, windowMode = false,
}) {
  const dadosIniciais = item || data || initialData || defaultValues || tipoFrete || tipo;
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = hasPermission?.("Cadastros.TipoFrete.criar") || hasPermission?.("Logistica.TipoFrete.criar");
  const podeEditar = hasPermission?.("Cadastros.TipoFrete.editar") || hasPermission?.("Logistica.TipoFrete.editar");
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(() => ({ ...emptyTipoFrete, ...(dadosIniciais || {}) }));

  const prevIdRef = useRef(dadosIniciais?.id);
  useEffect(() => {
    if (dadosIniciais?.id && dadosIniciais.id !== prevIdRef.current) {
      prevIdRef.current = dadosIniciais.id;
      setFormData({ ...emptyTipoFrete, ...dadosIniciais });
    }
  }, [dadosIniciais?.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const descricao = sanitizeText(formData.descricao, 240);
    if (!descricao || !formData.modalidade) {
      alert('Preencha os campos obrigatórios');
      return;
    }
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeSalvar) {
      alert('Sem permissão para salvar tipo de frete.');
      return;
    }
    onSubmit({
      ...formData,
      descricao,
      modalidade: sanitizeText(formData.modalidade, 40),
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
      nome: descricao,
    });
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CadastroCodigoRegistroField
        hasId={Boolean(dadosIniciais?.id)}
        entityId={dadosIniciais?.id}
        value={formData.codigo}
        action="codigo-registro-tipo-frete"
      />

      <div>
        <Label>Descrição *</Label>
        <Input
          value={formData.descricao}
          onChange={(e) => setFormData({...formData, descricao: e.target.value})}
          placeholder="Ex: Frete Padrão SP, Entrega Expressa"
        />
      </div>

      <div>
        <Label>Modalidade *</Label>
        <Select value={formData.modalidade} onValueChange={(v) => setFormData({...formData, modalidade: v})}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CIF">CIF - Empresa paga</SelectItem>
            <SelectItem value="FOB">FOB - Cliente paga</SelectItem>
            <SelectItem value="Próprio">Próprio - Frota própria</SelectItem>
            <SelectItem value="Terceiro">Terceiro - Transportadora</SelectItem>
            <SelectItem value="Retira">Retira - Cliente busca</SelectItem>
            <SelectItem value="Cortesia">Cortesia - Grátis</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
        <div>
          <Label>Cobra Frete</Label>
          <p className="text-xs text-slate-500">Se adiciona valor ao pedido</p>
        </div>
        <Switch
          checked={formData.cobra_frete}
          onCheckedChange={(v) => setFormData({...formData, cobra_frete: v})}
          disabled={!podeSalvar}
          data-permission="Cadastros.TipoFrete.editar"
          data-sensitive="true"
        />
      </div>

      {formData.cobra_frete && (
        <>
          <div>
            <Label>Fórmula de Cálculo</Label>
            <Select value={formData.formula_calculo} onValueChange={(v) => setFormData({...formData, formula_calculo: v})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Por KM">Por KM rodado</SelectItem>
                <SelectItem value="Por Região">Por Região/Cidade</SelectItem>
                <SelectItem value="Por Peso">Por Peso (KG)</SelectItem>
                <SelectItem value="Tabela Fixa">Tabela Fixa</SelectItem>
                <SelectItem value="API Externa">API Externa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.formula_calculo === 'Por KM' && (
            <div>
              <Label>Valor por KM (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.valor_base_km}
                onChange={(e) => setFormData({...formData, valor_base_km: parseFloat(e.target.value)})}
              />
            </div>
          )}
        </>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="submit"
          disabled={isSubmitting || !contextoValido || !podeSalvar}
          data-permission="Cadastros.TipoFrete.salvar"
          data-sensitive="true"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {tipo ? 'Atualizar' : 'Criar Tipo de Frete'}
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            {dadosIniciais ? 'Editar Tipo de Frete' : 'Novo Tipo de Frete'}
          </h2>
        </div>
        {formContent}
      </div>
    );
  }

  return formContent;
}
