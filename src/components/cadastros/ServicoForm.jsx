import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Stars } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function ServicoForm({ servico, onSubmit, isSubmitting, windowMode = false }) {
  const dadosIniciais = servico;
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = hasPermission?.("Cadastros.Servico.criar") || hasPermission?.("Cadastros.Produto.criar");
  const podeEditar = hasPermission?.("Cadastros.Servico.editar") || hasPermission?.("Cadastros.Produto.editar");
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    descricao: '',
    codigo_servico: '',
    tipo_servico: 'Produção',
    unidade: 'HORA',
    preco_servico: 0,
    custo_hora_homem: 0,
    tempo_execucao_medio_min: 0,
    margem_servico: 30,
    requer_especializacao: false,
    aliquota_iss: 5,
    ativo: true,
    observacoes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.descricao || !formData.preco_servico) {
      alert('Preencha os campos obrigatórios');
      return;
    }
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeSalvar) {
      alert('Sem permissão para salvar serviço.');
      return;
    }
    onSubmit({
      ...formData,
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
      nome: formData.descricao
    });
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Descrição do Serviço *</Label>
        <Input
          value={formData.descricao}
          onChange={(e) => setFormData({...formData, descricao: e.target.value})}
          placeholder="Ex: Corte de Aço, Dobra, Soldagem"
          data-action="editar-descricao-servico"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Código</Label>
          <Input
            value={formData.codigo_servico}
            onChange={(e) => setFormData({...formData, codigo_servico: e.target.value})}
            placeholder="SRV-001"
            data-action="editar-codigo-servico"
          />
        </div>

        <div>
          <Label>Tipo de Serviço</Label>
          <Select value={formData.tipo_servico} onValueChange={(v) => setFormData({...formData, tipo_servico: v})}>
            <SelectTrigger data-action="selecionar-tipo-servico">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Produção">Produção</SelectItem>
              <SelectItem value="Manutenção">Manutenção</SelectItem>
              <SelectItem value="Consultoria">Consultoria</SelectItem>
              <SelectItem value="Logística">Logística</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Unidade de Cobrança</Label>
          <Select value={formData.unidade} onValueChange={(v) => setFormData({...formData, unidade: v})}>
            <SelectTrigger data-action="selecionar-unidade-servico">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HORA">Hora</SelectItem>
              <SelectItem value="KG">Quilograma</SelectItem>
              <SelectItem value="PEÇA">Peça</SelectItem>
              <SelectItem value="MT">Metro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Preço do Serviço *</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.preco_servico}
            onChange={(e) => setFormData({...formData, preco_servico: parseFloat(e.target.value)})}
            data-action="editar-preco-servico"
          />
        </div>
      </div>

      <div>
        <Label>Observações</Label>
        <Textarea
          value={formData.observacoes}
          onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
          rows={3}
          data-action="editar-observacoes-servico"
        />
      </div>

      <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
        <Label>Serviço Ativo</Label>
        <Switch
          checked={formData.ativo}
          onCheckedChange={(v) => setFormData({...formData, ativo: v})}
          disabled={!podeSalvar}
          data-permission="Cadastros.Servico.alterarStatus"
          data-action="alternar-status-servico"
          data-sensitive="true"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="submit"
          disabled={isSubmitting || !contextoValido || !podeSalvar}
          data-permission="Cadastros.Servico.salvar"
          data-action="salvar-servico"
          data-sensitive="true"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {dadosIniciais ? 'Atualizar' : 'Criar Serviço'}
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Stars className="w-5 h-5 text-blue-600" />
            {dadosIniciais ? 'Editar Serviço' : 'Novo Serviço'}
          </h2>
        </div>
        {formContent}
      </div>
    );
  }

  return formContent;
}
