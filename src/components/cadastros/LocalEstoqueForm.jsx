import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Warehouse, MapPin } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { toast } from "sonner";

/**
 * FORMULÁRIO DE LOCAL DE ESTOQUE V21.2 - FASE 2
 * Padrão: w-full h-full em window mode
 */
export default function LocalEstoqueForm({ 
  local,
  localEstoque, 
  windowMode = false,
  onSubmit,
  onCancel 
}) {
  const dadosIniciais = localEstoque || local;
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = hasPermission?.("Cadastros.LocalEstoque.criar") || hasPermission?.("Estoque.LocalEstoque.criar");
  const podeEditar = hasPermission?.("Cadastros.LocalEstoque.editar") || hasPermission?.("Estoque.LocalEstoque.editar");
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState({
    nome: "",
    codigo: "",
    tipo: "Almoxarifado",
    capacidade_m3: 0,
    ativo: true,
    estrutura_fisica: {
      tem_corredores: false,
      tem_prateleiras: false,
      tem_andares: false,
      quantidade_corredores: 0,
      quantidade_ruas: 0
    },
    controla_temperatura: false,
    ...dadosIniciais
  });

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
        group_id: groupId || formData.group_id,
        empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id
      });
    }
  };

  const containerClass = windowMode 
    ? "w-full h-full flex flex-col overflow-hidden" 
    : "p-6";

  const contentClass = windowMode 
    ? "flex-1 overflow-y-auto p-6" 
    : "";

  return (
    <div className={containerClass}>
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
              />
            </div>

            <div>
              <Label>Código</Label>
              <Input
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                placeholder="Ex: ALM-01"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value })}
              >
                <SelectTrigger>
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
              />
            </div>
          </div>

          <Card className="bg-slate-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Estrutura Física</CardTitle>
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
                    estrutura_fisica: { ...formData.estrutura_fisica, tem_corredores: checked }
                  })}
                />
              </div>

              {formData.estrutura_fisica?.tem_corredores && (
                <div>
                  <Label className="text-xs">Quantidade de Corredores</Label>
                  <Input
                    type="number"
                    value={formData.estrutura_fisica?.quantidade_corredores || 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      estrutura_fisica: {
                        ...formData.estrutura_fisica,
                        quantidade_corredores: parseInt(e.target.value) || 0
                      }
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
                    estrutura_fisica: { ...formData.estrutura_fisica, tem_prateleiras: checked }
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
                    controla_temperatura: checked
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
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
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
                className="bg-blue-600 hover:bg-blue-700"
                disabled={!contextoValido || !podeSalvar}
                data-permission="Cadastros.LocalEstoque.salvar"
                data-sensitive="true"
              >
                <Warehouse className="w-4 h-4 mr-2" />
                {dadosIniciais ? 'Atualizar' : 'Criar'} Local
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
