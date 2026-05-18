import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Truck } from "lucide-react";
import { z } from "zod";
import FormWrapper from "@/components/common/FormWrapper";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { toast } from "sonner";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function VeiculoForm({ veiculo, item, data, initialData, defaultValues, onSubmit, isSubmitting, windowMode = false }) {
  const dadosIniciais = item || data || initialData || defaultValues || veiculo;
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = hasPermission?.("Cadastros.Veiculo.criar") || hasPermission?.("Logistica.Veiculo.criar");
  const podeEditar = hasPermission?.("Cadastros.Veiculo.editar") || hasPermission?.("Logistica.Veiculo.editar");
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = React.useState(dadosIniciais || {
    placa: '',
    modelo: '',
    tipo_veiculo: 'Caminhão Toco',
    ano_fabricacao: new Date().getFullYear(),
    capacidade_kg: 0,
    capacidade_m3: 0,
    tipo_combustivel: 'Diesel',
    consumo_medio_km_l: 0,
    km_atual: 0,
    periodicidade_revisao_km: 10000,
    rastreador_instalado: false,
    status: 'Disponível',
    proprio: true
  });

  const prevIdRef = React.useRef(dadosIniciais?.id);
  React.useEffect(() => {
    if (dadosIniciais?.id && dadosIniciais.id !== prevIdRef.current) {
      prevIdRef.current = dadosIniciais.id;
      setFormData({ ...dadosIniciais });
    }
  }, [dadosIniciais?.id]);

  const schema = z.object({
    placa: z.string().min(3, 'Placa é obrigatória'),
    tipo_veiculo: z.string().min(1, 'Tipo é obrigatório')
  });

  const handleSubmit = async () => {
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de salvar.");
      return;
    }
    if (!podeSalvar) {
      toast.error("Sem permissão para salvar veículo.");
      return;
    }
    onSubmit({
      ...formData,
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id
    });
  };

  const formContent = (
    <FormWrapper schema={schema} defaultValues={formData} onSubmit={handleSubmit} externalData={formData} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Placa *</Label>
          <Input
            value={formData.placa}
            onChange={(e) => setFormData({...formData, placa: e.target.value.toUpperCase()})}
            placeholder="ABC-1234"
            maxLength={8}
          />
        </div>

        <div>
          <Label>Modelo *</Label>
          <Input
            value={formData.modelo}
            onChange={(e) => setFormData({...formData, modelo: e.target.value})}
            placeholder="Ex: VW 24.280 Constellation"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Tipo de Veículo *</Label>
          <Select value={formData.tipo_veiculo} onValueChange={(v) => setFormData({...formData, tipo_veiculo: v})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Caminhão Toco">Caminhão Toco</SelectItem>
              <SelectItem value="Caminhão Truck">Caminhão Truck</SelectItem>
              <SelectItem value="Caminhonete">Caminhonete</SelectItem>
              <SelectItem value="Van">Van</SelectItem>
              <SelectItem value="Carro">Carro</SelectItem>
              <SelectItem value="Moto">Moto</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Ano Fabricação</Label>
          <Input
            type="number"
            value={formData.ano_fabricacao}
            onChange={(e) => setFormData({...formData, ano_fabricacao: parseInt(e.target.value) || new Date().getFullYear()})}
            placeholder="2024"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Capacidade (kg)</Label>
          <Input
            type="number"
            value={formData.capacidade_kg}
            onChange={(e) => setFormData({...formData, capacidade_kg: parseFloat(e.target.value) || 0})}
            placeholder="5000"
          />
        </div>

        <div>
          <Label>Volume (m³)</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.capacidade_m3}
            onChange={(e) => setFormData({...formData, capacidade_m3: parseFloat(e.target.value) || 0})}
            placeholder="15.0"
          />
        </div>

        <div>
          <Label>Consumo (km/l)</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.consumo_medio_km_l}
            onChange={(e) => setFormData({...formData, consumo_medio_km_l: parseFloat(e.target.value) || 0})}
            placeholder="5.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>KM Atual</Label>
          <Input
            type="number"
            value={formData.km_atual}
            onChange={(e) => setFormData({...formData, km_atual: parseInt(e.target.value) || 0})}
            placeholder="120000"
          />
        </div>

        <div>
          <Label>Revisão a Cada (km)</Label>
          <Input
            type="number"
            value={formData.periodicidade_revisao_km}
            onChange={(e) => setFormData({...formData, periodicidade_revisao_km: parseInt(e.target.value) || 10000})}
            placeholder="10000"
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
        <div>
          <Label>Rastreador GPS Instalado</Label>
          <p className="text-xs text-slate-500">Para rastreamento em tempo real</p>
        </div>
        <Switch
          checked={formData.rastreador_instalado}
          onCheckedChange={(v) => setFormData({...formData, rastreador_instalado: v})}
          disabled={!podeSalvar}
          data-permission="Cadastros.Veiculo.editar"
          data-sensitive="true"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="submit"
          disabled={isSubmitting || !contextoValido || !podeSalvar}
          data-permission="Cadastros.Veiculo.salvar"
          data-sensitive="true"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {dadosIniciais ? 'Atualizar Veículo' : 'Cadastrar Veículo'}
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            {dadosIniciais ? 'Editar Veículo' : 'Novo Veículo'}
          </h2>
        </div>
        {formContent}
      </div>
    );
  }

  return formContent;
}
