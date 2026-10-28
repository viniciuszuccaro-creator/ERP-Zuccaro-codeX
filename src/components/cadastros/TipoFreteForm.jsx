import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Package } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import CadastroCodigoRegistroField from "@/components/cadastros/CadastroCodigoRegistroField";
import useCadastroReopenOnIdentity from "@/components/cadastros/useCadastroReopenOnIdentity";

const EMPTY_TIPO_FRETE = {
  descricao: "",
  codigo: "",
  modalidade: "CIF",
  cobra_frete: true,
  calculo_automatico: false,
  formula_calculo: "Por KM",
  valor_base_km: 0,
  responsavel_pagamento: "Empresa",
  ativo: true,
  empresa_id: "",
  group_id: "",
};

const mapTipoFreteToForm = (record, defaults = {}) => {
  if (!record) {
    return {
      ...EMPTY_TIPO_FRETE,
      empresa_id: defaults.empresa_id || "",
      group_id: defaults.group_id || "",
    };
  }
  return {
    ...EMPTY_TIPO_FRETE,
    ...record,
    cobra_frete: record.cobra_frete !== false,
    calculo_automatico: Boolean(record.calculo_automatico),
    valor_base_km: Number.isFinite(Number(record.valor_base_km)) ? Number(record.valor_base_km) : 0,
    ativo: record.ativo !== false,
  };
};

/**
 * Reopen canônico (#353): useCadastroReopenOnIdentity — updated_at|updated_date,
 * preservação de modalidade/fórmula/valor_km, código/ID no boundId.
 */
export default function TipoFreteForm({
  tipo, tipoFrete, item, data, onSubmit, isSubmitting, windowMode = false,
}) {
  const dadosIniciais = item || data || tipoFrete || tipo;
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const emptyForm = mapTipoFreteToForm(null, {
    empresa_id: empresaAtual?.id || "",
    group_id: groupId || "",
  });
  const [formData, setFormData] = useState(() => mapTipoFreteToForm(dadosIniciais, emptyForm));

  const { boundId: tipoFreteBoundId } = useCadastroReopenOnIdentity(dadosIniciais, {
    formData,
    setFormData,
    emptyForm,
    mapToForm: (record) => mapTipoFreteToForm(record, emptyForm),
  });

  const podeCriar = hasPermission?.("Cadastros.TipoFrete.criar") || hasPermission?.("Logistica.TipoFrete.criar");
  const podeEditar = hasPermission?.("Cadastros.TipoFrete.editar") || hasPermission?.("Logistica.TipoFrete.editar");
  const podeSalvar = tipoFreteBoundId ? podeEditar : podeCriar;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.descricao || !formData.modalidade) {
      alert("Preencha os campos obrigatórios");
      return;
    }
    if (!contextoValido) {
      alert("Selecione um grupo ou empresa antes de salvar.");
      return;
    }
    if (!podeSalvar) {
      alert("Sem permissão para salvar tipo de frete.");
      return;
    }
    onSubmit({
      ...formData,
      ...(tipoFreteBoundId ? { id: tipoFreteBoundId } : {}),
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
      nome: formData.descricao,
    });
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CadastroCodigoRegistroField
        hasId={Boolean(tipoFreteBoundId)}
        entityId={tipoFreteBoundId}
        value={formData.codigo}
        action="codigo-registro-tipo-frete"
      />

      <div>
        <Label>Descrição *</Label>
        <Input
          value={formData.descricao}
          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
          placeholder="Ex: Frete Padrão SP, Entrega Expressa"
          disabled={!podeSalvar}
          data-permission="Cadastros.TipoFrete.editar"
        />
      </div>

      <div>
        <Label>Modalidade *</Label>
        <Select
          value={formData.modalidade}
          onValueChange={(v) => setFormData({ ...formData, modalidade: v })}
          disabled={!podeSalvar}
        >
          <SelectTrigger data-permission="Cadastros.TipoFrete.editar">
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

      <div className="flex items-center justify-between p-3 rounded border border-sky-100 bg-sky-50/50">
        <div>
          <Label>Cobra Frete</Label>
          <p className="text-xs text-slate-500">Se adiciona valor ao pedido</p>
        </div>
        <Switch
          checked={formData.cobra_frete}
          onCheckedChange={(v) => setFormData({ ...formData, cobra_frete: v })}
          disabled={!podeSalvar}
          data-permission="Cadastros.TipoFrete.editar"
          data-sensitive="true"
        />
      </div>

      {formData.cobra_frete && (
        <>
          <div>
            <Label>Fórmula de Cálculo</Label>
            <Select
              value={formData.formula_calculo}
              onValueChange={(v) => setFormData({ ...formData, formula_calculo: v })}
              disabled={!podeSalvar}
            >
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

          {formData.formula_calculo === "Por KM" && (
            <div>
              <Label>Valor por KM (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.valor_base_km}
                onChange={(e) => setFormData({ ...formData, valor_base_km: parseFloat(e.target.value) || 0 })}
                disabled={!podeSalvar}
              />
            </div>
          )}
        </>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-sky-100">
        <Button
          type="submit"
          className="bg-sky-600 hover:bg-sky-700"
          disabled={isSubmitting || !contextoValido || !podeSalvar}
          data-permission="Cadastros.TipoFrete.salvar"
          data-sensitive="true"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {tipoFreteBoundId ? "Atualizar" : "Criar Tipo de Frete"}
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col bg-white">
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-sky-50 to-sky-100">
          <Package className="w-6 h-6 text-sky-600" />
          <h2 className="text-lg font-bold text-slate-900">{tipoFreteBoundId ? "Editar Tipo de Frete" : "Novo Tipo de Frete"}</h2>
        </div>
        <div className="flex-1 overflow-auto p-6">{formContent}</div>
      </div>
    );
  }

  return formContent;
}
