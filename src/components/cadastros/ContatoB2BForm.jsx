import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function ContatoB2BForm({ contato, contatoB2B, item, data, onSubmit, onSave, onClose, isSubmitting, windowMode = false }) {
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const dadosIniciais = contatoB2B || contato || item || data;
  const contextoValido = Boolean(empresaAtual?.id || grupoAtual?.id);
  const [formData, setFormData] = useState(dadosIniciais || {
    cliente_id: '',
    nome_contato: '',
    cargo: '',
    departamento: 'Compras',
    email: '',
    telefone: '',
    whatsapp: '',
    preferencias_comunicacao: {
      receber_transacionais: true,
      receber_marketing: false,
      canal_preferencial: 'Email'
    },
    principal: false,
    ativo: true
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-contato-b2b', empresaAtual?.id || grupoAtual?.id || 'sem-contexto'],
    queryFn: () => filterInContext('Cliente', {}, 'nome', 500),
    enabled: contextoValido,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar o contato.');
      return;
    }
    if (!formData.nome_contato || !formData.email) {
      alert('Preencha os campos obrigatórios');
      return;
    }
    if (onSubmit) {
      onSubmit(formData);
    } else {
      if (onSave) onSave();
      if (onClose) onClose();
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Cliente *</Label>
        <Select value={formData.cliente_id} onValueChange={(v) => setFormData({...formData, cliente_id: v})} disabled={!contextoValido}>
          <SelectTrigger data-permission="Cadastros.ContatoB2B.editar" data-action="Cadastros.ContatoB2B.cliente">
            <SelectValue placeholder="Selecione o cliente" />
          </SelectTrigger>
          <SelectContent>
            {clientes.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Nome do Contato *</Label>
        <Input
          value={formData.nome_contato}
          onChange={(e) => setFormData({...formData, nome_contato: e.target.value})}
          placeholder="Nome completo"
          data-permission="Cadastros.ContatoB2B.editar"
          data-action="Cadastros.ContatoB2B.nome_contato"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Cargo</Label>
          <Input
            value={formData.cargo}
            onChange={(e) => setFormData({...formData, cargo: e.target.value})}
            placeholder="Ex: Gerente de Compras"
            data-permission="Cadastros.ContatoB2B.editar"
            data-action="Cadastros.ContatoB2B.cargo"
          />
        </div>
        <div>
          <Label>Departamento</Label>
          <Select value={formData.departamento} onValueChange={(v) => setFormData({...formData, departamento: v})}>
            <SelectTrigger data-permission="Cadastros.ContatoB2B.editar" data-action="Cadastros.ContatoB2B.departamento">
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
        <Input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          placeholder="contato@empresa.com"
          data-permission="Cadastros.ContatoB2B.editar"
          data-action="Cadastros.ContatoB2B.email"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Telefone</Label>
          <Input
            value={formData.telefone}
            onChange={(e) => setFormData({...formData, telefone: e.target.value})}
            data-permission="Cadastros.ContatoB2B.editar"
            data-action="Cadastros.ContatoB2B.telefone"
          />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input
            value={formData.whatsapp}
            onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
            data-permission="Cadastros.ContatoB2B.editar"
            data-action="Cadastros.ContatoB2B.whatsapp"
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
        <Label>Contato Principal</Label>
        <Switch
          checked={formData.principal}
          onCheckedChange={(v) => setFormData({...formData, principal: v})}
          data-permission="Cadastros.ContatoB2B.editar"
          data-action="Cadastros.ContatoB2B.principal"
          data-sensitive="true"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" disabled={isSubmitting || !contextoValido} data-permission="Cadastros.ContatoB2B.editar" data-action="Cadastros.ContatoB2B.salvar" data-sensitive="true">
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {dadosIniciais ? 'Atualizar' : 'Criar Contato'}
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
            {dadosIniciais ? 'Editar Contato B2B' : 'Novo Contato B2B'}
          </h2>
        </div>
        {formContent}
      </div>
    );
  }

  return formContent;
}
