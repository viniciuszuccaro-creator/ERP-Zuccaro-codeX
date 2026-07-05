import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeEmail = (value) => sanitizeText(value, 180).toLowerCase();
const sanitizePhone = (value) => String(value ?? "").replace(/[^0-9+()\-\s]/g, "").slice(0, 30).trim();

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function ContatoB2BForm({ contato, contatoB2B, item, data, initialData, defaultValues, onSubmit, onSave, onClose, isSubmitting, windowMode = false }) {
  const dadosIniciais = item || data || initialData || defaultValues || contatoB2B || contato;
  const { canCreate, canEdit } = usePermissions();
  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "ContatoB2B") || canCreate("Comercial", "ContatoB2B") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "ContatoB2B") || canEdit("Comercial", "ContatoB2B") || canEdit("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    cliente_id: "",
    nome_contato: "",
    cargo: "",
    departamento: "Compras",
    email: "",
    telefone: "",
    whatsapp: "",
    preferencias_comunicacao: {
      receber_transacionais: true,
      receber_marketing: false,
      canal_preferencial: "Email"
    },
    principal: false,
    ativo: true
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-contato-b2b", empresaAtual?.id || groupId || "sem-contexto"],
    queryFn: () => filterInContext("Cliente", {}, "nome", 500),
    enabled: contextoValido,
  });

  const buildPayload = () => ({
    ...formData,
    cliente_id: sanitizeText(formData.cliente_id, 120),
    nome_contato: sanitizeText(formData.nome_contato, 180),
    nome: sanitizeText(formData.nome_contato, 180),
    cargo: sanitizeText(formData.cargo, 120),
    departamento: sanitizeText(formData.departamento, 80),
    email: sanitizeEmail(formData.email),
    telefone: sanitizePhone(formData.telefone),
    whatsapp: sanitizePhone(formData.whatsapp),
    preferencias_comunicacao: {
      receber_transacionais: Boolean(formData.preferencias_comunicacao?.receber_transacionais),
      receber_marketing: Boolean(formData.preferencias_comunicacao?.receber_marketing),
      canal_preferencial: sanitizeText(formData.preferencias_comunicacao?.canal_preferencial || "Email", 40)
    },
    group_id: groupId || formData.group_id,
    empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!podeSalvar) {
      alert(dadosIniciais?.id ? "Sem permissao para editar contato B2B." : "Sem permissao para criar contato B2B.");
      return;
    }
    if (!contextoValido) {
      alert("Selecione um grupo ou empresa antes de salvar o contato.");
      return;
    }

    const payload = buildPayload();
    if (!payload.nome_contato || !payload.email) {
      alert("Preencha os campos obrigatorios");
      return;
    }

    if (onSubmit) {
      onSubmit(payload);
    } else {
      if (onSave) onSave(payload);
      if (onClose) onClose();
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Cliente *</Label>
        <Select value={formData.cliente_id} onValueChange={(v) => setFormData({ ...formData, cliente_id: v })} disabled={!contextoValido || !podeSalvar}>
          <SelectTrigger data-permission="Cadastros.ContatoB2B.editar" data-action="Cadastros.ContatoB2B.cliente" data-sensitive>
            <SelectValue placeholder="Selecione o cliente" />
          </SelectTrigger>
          <SelectContent>
            {clientes.map((cliente) => (
              <SelectItem key={cliente.id} value={cliente.id}>{cliente.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Nome do Contato *</Label>
        <Input value={formData.nome_contato} onChange={(e) => setFormData({ ...formData, nome_contato: e.target.value })} placeholder="Nome completo" disabled={!podeSalvar} data-permission="Cadastros.ContatoB2B.editar" data-action="Cadastros.ContatoB2B.nome_contato" data-sensitive />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Cargo</Label>
          <Input value={formData.cargo} onChange={(e) => setFormData({ ...formData, cargo: e.target.value })} placeholder="Ex: Gerente de Compras" disabled={!podeSalvar} data-permission="Cadastros.ContatoB2B.editar" data-action="Cadastros.ContatoB2B.cargo" data-sensitive />
        </div>
        <div>
          <Label>Departamento</Label>
          <Select value={formData.departamento} onValueChange={(v) => setFormData({ ...formData, departamento: v })} disabled={!podeSalvar}>
            <SelectTrigger data-permission="Cadastros.ContatoB2B.editar" data-action="Cadastros.ContatoB2B.departamento" data-sensitive>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Compras">Compras</SelectItem>
              <SelectItem value="Financeiro">Financeiro</SelectItem>
              <SelectItem value="Obras">Obras</SelectItem>
              <SelectItem value="Engenharia">Engenharia</SelectItem>
              <SelectItem value="Diretoria">Diretoria</SelectItem>
              <SelectItem value="Outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>E-mail *</Label>
        <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="contato@empresa.com" disabled={!podeSalvar} data-permission="Cadastros.ContatoB2B.editar" data-action="Cadastros.ContatoB2B.email" data-sensitive />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Telefone</Label>
          <Input value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} disabled={!podeSalvar} data-permission="Cadastros.ContatoB2B.editar" data-action="Cadastros.ContatoB2B.telefone" data-sensitive />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input value={formData.whatsapp} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} disabled={!podeSalvar} data-permission="Cadastros.ContatoB2B.editar" data-action="Cadastros.ContatoB2B.whatsapp" data-sensitive />
        </div>
      </div>

      <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
        <Label>Contato Principal</Label>
        <Switch checked={formData.principal} onCheckedChange={(v) => setFormData({ ...formData, principal: v })} disabled={!podeSalvar} data-permission="Cadastros.ContatoB2B.alterarStatus" data-action="Cadastros.ContatoB2B.principal" data-sensitive />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" disabled={isSubmitting || !contextoValido || !podeSalvar} data-permission="Cadastros.ContatoB2B.salvar" data-action="Cadastros.ContatoB2B.salvar" data-sensitive>
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {dadosIniciais ? "Atualizar" : "Criar Contato"}
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            {dadosIniciais ? "Editar Contato B2B" : "Novo Contato B2B"}
          </h2>
        </div>
        {formContent}
      </div>
    );
  }

  return formContent;
}
