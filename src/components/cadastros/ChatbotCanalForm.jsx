import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Smartphone, Save } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

export default function ChatbotCanalForm({ chatbotCanal, onSubmit, isSubmitting, windowMode = false }) {
  const dadosIniciais = chatbotCanal;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(groupId || empresaAtual?.id || dadosIniciais?.empresa_id);
  const podeCriar = canCreate("Cadastros", "ChatbotCanal") || canCreate("Sistema", "ChatbotCanal") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "ChatbotCanal") || canEdit("Sistema", "ChatbotCanal") || canEdit("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    nome_canal: "",
    tipo_canal: "WhatsApp",
    whatsapp_numero: "",
    whatsapp_token: "",
    mensagem_boas_vindas: "",
    mensagem_ausencia: "",
    transfere_para_humano: true,
    ativo: true,
    observacoes: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome_canal) {
      alert('Nome do canal é obrigatório');
      return;
    }
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeSalvar) {
      alert('Sem permissao para salvar canais de chatbot.');
      return;
    }
    await onSubmit({
      ...formData,
      nome: formData.nome_canal,
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
    });
  };

  const form = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-green-600" />
            Canal do Chatbot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome do Canal *</Label>
              <Input
                value={formData.nome_canal}
                onChange={(e) => setFormData({ ...formData, nome_canal: e.target.value })}
                placeholder="Ex: WhatsApp Principal"
              />
            </div>
            <div>
              <Label>Tipo de Canal</Label>
              <Select value={formData.tipo_canal} onValueChange={(val) => setFormData({ ...formData, tipo_canal: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="Site Widget">Site Widget</SelectItem>
                  <SelectItem value="Portal">Portal</SelectItem>
                  <SelectItem value="App Mobile">App Mobile</SelectItem>
                  <SelectItem value="Telegram">Telegram</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.tipo_canal === "WhatsApp" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Número WhatsApp</Label>
                <Input
                  value={formData.whatsapp_numero}
                  onChange={(e) => setFormData({ ...formData, whatsapp_numero: e.target.value })}
                  placeholder="+55 11 99999-9999"
                />
              </div>
              <div>
                <Label>Token API</Label>
                <Input
                  type="password"
                  value={formData.whatsapp_token}
                  onChange={(e) => setFormData({ ...formData, whatsapp_token: e.target.value })}
                />
              </div>
            </div>
          )}

          <div>
            <Label>Mensagem de Boas-Vindas</Label>
            <Textarea
              value={formData.mensagem_boas_vindas}
              onChange={(e) => setFormData({ ...formData, mensagem_boas_vindas: e.target.value })}
              rows={3}
            />
          </div>

          <div>
            <Label>Mensagem de Ausência</Label>
            <Textarea
              value={formData.mensagem_ausencia}
              onChange={(e) => setFormData({ ...formData, mensagem_ausencia: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
            <Label>Transfere para Humano</Label>
            <Switch
              checked={formData.transfere_para_humano}
              onCheckedChange={(val) => setFormData({ ...formData, transfere_para_humano: val })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
            <Label>Canal Ativo</Label>
            <Switch
              checked={formData.ativo}
              onCheckedChange={(val) => setFormData({ ...formData, ativo: val })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={isSubmitting || !contextoValido || !podeSalvar} data-permission="Cadastros.ChatbotCanal.salvar" data-action="salvar-canal-chatbot" data-sensitive>
          <Save className="w-4 h-4 mr-2" />
          {isSubmitting ? 'Salvando...' : dadosIniciais ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <Smartphone className="w-8 h-8 text-green-600" />
            <h2 className="text-2xl font-bold text-slate-900">
              {dadosIniciais ? 'Editar Canal' : 'Novo Canal'}
            </h2>
          </div>
          {form}
        </div>
      </div>
    );
  }

  return form;
}
