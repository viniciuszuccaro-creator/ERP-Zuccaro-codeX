import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Briefcase } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

const sanitizeText = (value, max = 255) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeDoc = (value) => String(value ?? "").replace(/[^0-9A-Za-z./-]/g, "").slice(0, 32).trim();
const sanitizePhone = (value) => String(value ?? "").replace(/[^0-9+() -]/g, "").slice(0, 32).trim();
const toMoneyNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function RepresentanteForm({ representante, item, data, initialData, defaultValues, onSubmit, isSubmitting, windowMode = false }) {
  const dadosIniciais = item || data || initialData || defaultValues || representante;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "Representante") || canCreate("Comercial", "Representante") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "Representante") || canEdit("Comercial", "Representante") || canEdit("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    nome: '',
    cpf_cnpj: '',
    email: '',
    telefone: '',
    whatsapp: '',
    comissao_percentual: 0,
    tipo_contrato: 'Autonomo',
    data_contratacao: '',
    ativo: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!podeSalvar) {
      alert(dadosIniciais?.id ? 'Sem permissao para editar representantes.' : 'Sem permissao para criar representantes.');
      return;
    }
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    const payload = {
      ...formData,
      nome: sanitizeText(formData.nome, 180),
      cpf_cnpj: sanitizeDoc(formData.cpf_cnpj),
      email: sanitizeText(formData.email, 180).toLowerCase(),
      telefone: sanitizePhone(formData.telefone),
      whatsapp: sanitizePhone(formData.whatsapp),
      tipo_contrato: sanitizeText(formData.tipo_contrato, 40),
      data_contratacao: sanitizeText(formData.data_contratacao, 20),
      comissao_percentual: toMoneyNumber(formData.comissao_percentual),
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id
    };
    if (!payload.nome) {
      alert('Preencha o nome do representante');
      return;
    }
    onSubmit(payload);
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Nome *</Label>
        <Input
          value={formData.nome}
          onChange={(e) => setFormData({...formData, nome: e.target.value})}
          placeholder="Nome do representante"
          disabled={!podeSalvar}
          data-permission="Cadastros.Representante.editar"
          data-action="editar-nome-representante"
          data-sensitive
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>CPF/CNPJ</Label>
          <Input
            value={formData.cpf_cnpj}
            onChange={(e) => setFormData({...formData, cpf_cnpj: e.target.value})}
            disabled={!podeSalvar}
            data-permission="Cadastros.Representante.editar"
            data-action="editar-documento-representante"
            data-sensitive
          />
        </div>
        <div>
          <Label>Tipo de Contrato</Label>
          <Select value={formData.tipo_contrato} onValueChange={(v) => setFormData({...formData, tipo_contrato: v})} disabled={!podeSalvar}>
            <SelectTrigger data-permission="Cadastros.Representante.editar" data-action="editar-contrato-representante" data-sensitive>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PJ">PJ - Pessoa Juridica</SelectItem>
              <SelectItem value="CLT">CLT</SelectItem>
              <SelectItem value="Autonomo">Autonomo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>E-mail</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            disabled={!podeSalvar}
            data-permission="Cadastros.Representante.editar"
            data-action="editar-email-representante"
            data-sensitive
          />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input
            value={formData.whatsapp}
            onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
            disabled={!podeSalvar}
            data-permission="Cadastros.Representante.editar"
            data-action="editar-whatsapp-representante"
            data-sensitive
          />
        </div>
      </div>

      <div>
        <Label>Comissao Padrao (%)</Label>
        <Input
          type="number"
          step="0.01"
          value={formData.comissao_percentual}
          onChange={(e) => setFormData({...formData, comissao_percentual: parseFloat(e.target.value)})}
          disabled={!podeSalvar}
          data-permission="Cadastros.Representante.editar"
          data-action="editar-comissao-representante"
          data-sensitive
        />
      </div>

      <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
        <Label>Representante Ativo</Label>
        <Switch
          checked={formData.ativo}
          onCheckedChange={(v) => setFormData({...formData, ativo: v})}
          disabled={!podeSalvar}
          data-permission="Cadastros.Representante.editar"
          data-action="alternar-representante-ativo"
          data-sensitive
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" disabled={isSubmitting || !contextoValido || !podeSalvar} data-permission="Cadastros.Representante.salvar" data-action="salvar-representante" data-sensitive>
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {dadosIniciais ? 'Atualizar' : 'Criar Representante'}
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-600" />
            {dadosIniciais ? 'Editar Representante' : 'Novo Representante'}
          </h2>
        </div>
        {formContent}
      </div>
    );
  }

  return formContent;
}
