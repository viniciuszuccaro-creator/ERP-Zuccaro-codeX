import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Save, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

export default function ChatbotIntentForm({ chatbotIntent, onSubmit, isSubmitting, windowMode = false }) {
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || chatbotIntent?.group_id || null;
  const contextoValido = Boolean(groupId || empresaAtual?.id || chatbotIntent?.empresa_id);
  const podeCriar = canCreate("Cadastros", "ChatbotIntent") || canCreate("Sistema", "ChatbotIntent") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "ChatbotIntent") || canEdit("Sistema", "ChatbotIntent") || canEdit("Cadastros", null);
  const podeSalvar = chatbotIntent?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(chatbotIntent || {
    nome_intent: "",
    descricao: "",
    frases_treinamento: [],
    origem_dados: "",
    exige_autenticacao: false,
    resposta_template: "",
    ativo: true,
    observacoes: ""
  });

  const [novaFrase, setNovaFrase] = useState("");

  const adicionarFrase = () => {
    if (podeSalvar && novaFrase.trim()) {
      setFormData({
        ...formData,
        frases_treinamento: [...(formData.frases_treinamento || []), novaFrase.trim()]
      });
      setNovaFrase("");
    }
  };

  const removerFrase = (index) => {
    if (!podeSalvar) return;
    setFormData({
      ...formData,
      frases_treinamento: formData.frases_treinamento.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome_intent) {
      alert('Nome da intent é obrigatório');
      return;
    }
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeSalvar) {
      alert('Sem permissao para salvar intents do chatbot.');
      return;
    }
    await onSubmit({
      ...formData,
      nome: formData.nome_intent,
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
    });
  };

  const form = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-purple-600" />
            Intent do Chatbot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome da Intent *</Label>
            <Input
              value={formData.nome_intent}
              onChange={(e) => setFormData({ ...formData, nome_intent: e.target.value })}
              placeholder="Ex: consultar_pedido, 2via_boleto"
            />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={2}
            />
          </div>

          <div>
            <Label>Origem dos Dados</Label>
            <Input
              value={formData.origem_dados}
              onChange={(e) => setFormData({ ...formData, origem_dados: e.target.value })}
              placeholder="Ex: Pedido, ContaReceber, Cliente"
            />
          </div>

          <div>
            <Label>Frases de Treinamento</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={novaFrase}
                onChange={(e) => setNovaFrase(e.target.value)}
                placeholder="Ex: Quero consultar meu pedido"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), adicionarFrase())}
              />
              <Button type="button" onClick={adicionarFrase} size="sm" disabled={!podeSalvar} data-permission="Cadastros.ChatbotIntent.editar" data-action="adicionar-frase-treinamento" data-sensitive>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(formData.frases_treinamento || []).map((frase, idx) => (
                <Badge key={idx} className="bg-purple-100 text-purple-700">
                  {frase}
                  <button
                    type="button"
                    onClick={() => removerFrase(idx)}
                    className="ml-2 hover:text-red-600"
                    disabled={!podeSalvar}
                    data-permission="Cadastros.ChatbotIntent.editar"
                    data-action="remover-frase-treinamento"
                    data-sensitive
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label>Template de Resposta</Label>
            <Textarea
              value={formData.resposta_template}
              onChange={(e) => setFormData({ ...formData, resposta_template: e.target.value })}
              placeholder="Use {variavel} para campos dinâmicos"
              rows={4}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
            <Label>Exige Autenticação</Label>
            <Switch
              checked={formData.exige_autenticacao}
              onCheckedChange={(val) => setFormData({ ...formData, exige_autenticacao: val })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
            <Label>Intent Ativa</Label>
            <Switch
              checked={formData.ativo}
              onCheckedChange={(val) => setFormData({ ...formData, ativo: val })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" className="bg-purple-600 hover:bg-purple-700" disabled={isSubmitting || !contextoValido || !podeSalvar} data-permission="Cadastros.ChatbotIntent.salvar" data-action="salvar-intent-chatbot" data-sensitive>
          <Save className="w-4 h-4 mr-2" />
          {isSubmitting ? 'Salvando...' : chatbotIntent ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <MessageCircle className="w-8 h-8 text-purple-600" />
            <h2 className="text-2xl font-bold text-slate-900">
              {chatbotIntent ? 'Editar Intent' : 'Nova Intent'}
            </h2>
          </div>
          {form}
        </div>
      </div>
    );
  }

  return form;
}
