import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

const sanitizeText = (value, max = 255) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeDate = (value) => sanitizeText(value, 20);

export default function TabelaPrecoForm({ tabela, item, data, initialData, defaultValues, onSubmit, isSubmitting, windowMode = false }) {
  const dadosIniciais = item || data || initialData || defaultValues || tabela;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "TabelaPreco") || canCreate("Comercial", "TabelaPreco") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "TabelaPreco") || canEdit("Comercial", "TabelaPreco") || canEdit("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    nome: '',
    descricao: '',
    tipo: 'Padrao',
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: '',
    ativo: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!podeSalvar) {
      alert(dadosIniciais?.id ? 'Sem permissao para editar tabela de preco.' : 'Sem permissao para criar tabela de preco.');
      return;
    }
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    const payload = {
      ...formData,
      nome: sanitizeText(formData.nome, 180),
      descricao: sanitizeText(formData.descricao, 500),
      tipo: sanitizeText(formData.tipo, 40),
      data_inicio: sanitizeDate(formData.data_inicio),
      data_fim: sanitizeDate(formData.data_fim),
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id
    };
    if (!payload.nome || !payload.tipo || !payload.data_inicio) {
      alert('Preencha os campos obrigatorios');
      return;
    }
    onSubmit(payload);
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Nome da Tabela *</Label>
        <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Ex: Atacado SP, Varejo Nacional" disabled={!podeSalvar} data-permission="Cadastros.TabelaPreco.editar" data-action="editar-nome-tabela-preco" data-sensitive />
      </div>

      <div>
        <Label>Descricao</Label>
        <Input value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} placeholder="Descricao interna" disabled={!podeSalvar} data-permission="Cadastros.TabelaPreco.editar" data-action="editar-descricao-tabela-preco" data-sensitive />
      </div>

      <div>
        <Label>Tipo de Tabela *</Label>
        <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })} disabled={!podeSalvar}>
          <SelectTrigger data-permission="Cadastros.TabelaPreco.editar" data-action="selecionar-tipo-tabela-preco" data-sensitive><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Padrao">Padrao</SelectItem>
            <SelectItem value="Atacado">Atacado</SelectItem>
            <SelectItem value="Varejo">Varejo</SelectItem>
            <SelectItem value="Especial">Especial</SelectItem>
            <SelectItem value="Promocional">Promocional</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Data Inicio *</Label>
          <Input type="date" value={formData.data_inicio} onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })} disabled={!podeSalvar} data-permission="Cadastros.TabelaPreco.editar" data-action="editar-data-inicio-tabela-preco" data-sensitive />
        </div>
        <div>
          <Label>Data Fim</Label>
          <Input type="date" value={formData.data_fim} onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })} disabled={!podeSalvar} data-permission="Cadastros.TabelaPreco.editar" data-action="editar-data-fim-tabela-preco" data-sensitive />
        </div>
      </div>

      <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
        <Label>Tabela Ativa</Label>
        <Switch checked={formData.ativo} onCheckedChange={(v) => setFormData({ ...formData, ativo: v })} disabled={!podeSalvar} data-permission="Cadastros.TabelaPreco.alterarStatus" data-action="alternar-status-tabela-preco" data-sensitive />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" disabled={isSubmitting || !contextoValido || !podeSalvar} data-permission="Cadastros.TabelaPreco.salvar" data-action="salvar-tabela-preco" data-sensitive>
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {dadosIniciais ? 'Atualizar' : 'Criar Tabela'}
        </Button>
      </div>
    </form>
  );

  if (windowMode) return <div className="w-full h-full overflow-auto bg-white p-6">{content}</div>;
  return content;
}
