import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Warehouse } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import CadastroCodigoRegistroField from "@/components/cadastros/CadastroCodigoRegistroField";
import useCadastroReopenOnIdentity from "@/components/cadastros/useCadastroReopenOnIdentity";
import { toast } from "sonner";

const EMPTY_ESTRUTURA = {
  tem_corredores: false,
  tem_prateleiras: false,
  tem_andares: false,
  quantidade_corredores: 0,
  quantidade_ruas: 0,
};

const EMPTY_LOCAL = {
  nome: "",
  codigo: "",
  tipo: "Almoxarifado",
  capacidade_m3: 0,
  ativo: true,
  estrutura_fisica: { ...EMPTY_ESTRUTURA },
  controla_temperatura: false,
  observacoes: "",
  empresa_id: "",
  group_id: "",
};

const mapLocalEstoqueToForm = (record, defaults = {}) => {
  if (!record) {
    return {
      ...EMPTY_LOCAL,
      empresa_id: defaults.empresa_id || "",
      group_id: defaults.group_id || "",
      estrutura_fisica: { ...EMPTY_ESTRUTURA },
    };
  }
  const estrutura = record.estrutura_fisica && typeof record.estrutura_fisica === "object"
    ? record.estrutura_fisica
    : null;
  return {
    ...EMPTY_LOCAL,
    ...record,
    capacidade_m3: Number.isFinite(Number(record.capacidade_m3)) ? Number(record.capacidade_m3) : 0,
    estrutura_fisica: {
      ...EMPTY_ESTRUTURA,
      ...(estrutura || {}),
      tem_corredores: estrutura ? Boolean(estrutura.tem_corredores) : EMPTY_ESTRUTURA.tem_corredores,
      tem_prateleiras: estrutura ? Boolean(estrutura.tem_prateleiras) : EMPTY_ESTRUTURA.tem_prateleiras,
      tem_andares: estrutura ? Boolean(estrutura.tem_andares) : EMPTY_ESTRUTURA.tem_andares,
      quantidade_corredores: Number.isFinite(Number(estrutura?.quantidade_corredores))
        ? Number(estrutura.quantidade_corredores)
        : EMPTY_ESTRUTURA.quantidade_corredores,
      quantidade_ruas: Number.isFinite(Number(estrutura?.quantidade_ruas))
        ? Number(estrutura.quantidade_ruas)
        : EMPTY_ESTRUTURA.quantidade_ruas,
    },
    controla_temperatura: Boolean(record.controla_temperatura),
    ativo: record.ativo !== false,
    observacoes: record.observacoes == null ? "" : String(record.observacoes),
  };
};

/**
 * Reopen canônico (#353): useCadastroReopenOnIdentity — updated_at|updated_date,
 * preservação de estrutura_fisica aninhada, código/ID no boundId.
 */
export default function LocalEstoqueForm({
  local,
  localEstoque,
  item,
  data,
  windowMode = false,
  onSubmit,
  onCancel,
}) {
  const dadosIniciais = item || data || localEstoque || local;
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const emptyForm = mapLocalEstoqueToForm(null, {
    empresa_id: empresaAtual?.id || "",
    group_id: groupId || "",
  });
  const [formData, setFormData] = useState(() => mapLocalEstoqueToForm(dadosIniciais, emptyForm));

  const { boundId: localBoundId } = useCadastroReopenOnIdentity(dadosIniciais, {
    formData,
    setFormData,
    emptyForm,
    mapToForm: (record) => mapLocalEstoqueToForm(record, emptyForm),
  });

  const podeCriar = hasPermission?.("Cadastros.LocalEstoque.criar") || hasPermission?.("Estoque.LocalEstoque.criar");
  const podeEditar = hasPermission?.("Cadastros.LocalEstoque.editar") || hasPermission?.("Estoque.LocalEstoque.editar");
  const podeSalvar = localBoundId ? podeEditar : podeCriar;

  const handleSubmitForm = (e) => {
    e.preventDefault();
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de salvar.");
      return;
    }
    if (!podeSalvar) {
      toast.error("Sem permissão para salvar local de estoque.");
      return;
    }
    if (onSubmit) {
      onSubmit({
        ...formData,
        ...(localBoundId ? { id: localBoundId } : {}),
        group_id: groupId || formData.group_id,
        empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
        estrutura_fisica: {
          tem_corredores: Boolean(formData.estrutura_fisica?.tem_corredores),
          tem_prateleiras: Boolean(formData.estrutura_fisica?.tem_prateleiras),
          tem_andares: Boolean(formData.estrutura_fisica?.tem_andares),
          quantidade_corredores: Number(formData.estrutura_fisica?.quantidade_corredores) || 0,
          quantidade_ruas: Number(formData.estrutura_fisica?.quantidade_ruas) || 0,
        },
        controla_temperatura: Boolean(formData.controla_temperatura),
      });
    }
  };

  const containerClass = windowMode
    ? "w-full h-full flex flex-col overflow-hidden bg-sky-50/40"
    : "p-6";

  const contentClass = windowMode
    ? "flex-1 overflow-y-auto p-6"
    : "";

  return (
    <div className={containerClass}>
      {windowMode && (
        <div className="shrink-0 border-b border-sky-200 bg-sky-100/80 px-6 py-3">
          <h2 className="text-base font-semibold text-sky-950">
            {localBoundId ? "Editar Local de Estoque" : "Novo Local de Estoque"}
          </h2>
        </div>
      )}
      <div className={contentClass}>
        <form onSubmit={handleSubmitForm} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nome do Local *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Almoxarifado Central"
                required
                disabled={!podeSalvar}
                data-permission="Cadastros.LocalEstoque.editar"
              />
            </div>

            <CadastroCodigoRegistroField
              hasId={Boolean(localBoundId)}
              entityId={localBoundId}
              value={formData.codigo}
              action="codigo-registro-local-estoque"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                disabled={!podeSalvar}
              >
                <SelectTrigger data-permission="Cadastros.LocalEstoque.editar">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Almoxarifado">Almoxarifado</SelectItem>
                  <SelectItem value="Depósito">Depósito</SelectItem>
                  <SelectItem value="Loja">Loja</SelectItem>
                  <SelectItem value="Produção">Produção</SelectItem>
                  <SelectItem value="Expedição">Expedição</SelectItem>
                  <SelectItem value="Quarentena">Quarentena</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Capacidade (m³)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.capacidade_m3}
                onChange={(e) => setFormData({ ...formData, capacidade_m3: parseFloat(e.target.value) || 0 })}
                disabled={!podeSalvar}
                data-permission="Cadastros.LocalEstoque.editar"
              />
            </div>
          </div>

          <Card className="border-sky-100 bg-sky-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-sky-950">Estrutura Física</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Tem Corredores?</Label>
                <Switch
                  checked={formData.estrutura_fisica?.tem_corredores}
                  disabled={!podeSalvar}
                  data-permission="Cadastros.LocalEstoque.editar"
                  data-sensitive="true"
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    estrutura_fisica: { ...formData.estrutura_fisica, tem_corredores: checked },
                  })}
                />
              </div>

              {formData.estrutura_fisica?.tem_corredores && (
                <div>
                  <Label className="text-xs">Quantidade de Corredores</Label>
                  <Input
                    type="number"
                    value={formData.estrutura_fisica?.quantidade_corredores || 0}
                    disabled={!podeSalvar}
                    onChange={(e) => setFormData({
                      ...formData,
                      estrutura_fisica: {
                        ...formData.estrutura_fisica,
                        quantidade_corredores: parseInt(e.target.value, 10) || 0,
                      },
                    })}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label>Tem Prateleiras?</Label>
                <Switch
                  checked={formData.estrutura_fisica?.tem_prateleiras}
                  disabled={!podeSalvar}
                  data-permission="Cadastros.LocalEstoque.editar"
                  data-sensitive="true"
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    estrutura_fisica: { ...formData.estrutura_fisica, tem_prateleiras: checked },
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Controla Temperatura?</Label>
                <Switch
                  checked={formData.controla_temperatura}
                  disabled={!podeSalvar}
                  data-permission="Cadastros.LocalEstoque.editar"
                  data-sensitive="true"
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    controla_temperatura: checked,
                  })}
                />
              </div>
            </CardContent>
          </Card>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={3}
              disabled={!podeSalvar}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-sky-100">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.ativo}
                disabled={!podeSalvar}
                data-permission="Cadastros.LocalEstoque.alterarStatus"
                data-sensitive="true"
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
              <Label>Local Ativo</Label>
            </div>

            <div className="flex gap-3">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
              )}
              <Button
                type="submit"
                className="bg-sky-600 hover:bg-sky-700"
                disabled={!contextoValido || !podeSalvar}
                data-permission="Cadastros.LocalEstoque.salvar"
                data-sensitive="true"
              >
                <Warehouse className="w-4 h-4 mr-2" />
                {localBoundId ? "Atualizar" : "Criar"} Local
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
