import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Save } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeSecret = (value) => String(value ?? "").replace(/[<>]/g, "").slice(0, 1200).trim();
const sanitizePhone = (value) => String(value ?? "").replace(/[^0-9+()\-\s]/g, "").slice(0, 30).trim();
const toInteger = (value, fallback = 0) => Number.isFinite(Number(value)) ? parseInt(value, 10) : fallback;

export default function ConfiguracaoWhatsAppForm({ config, item, data, initialData, defaultValues, onSubmit, isSubmitting, windowMode = false }) {
  const dadosIniciais = item || data || initialData || defaultValues || config;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "ConfiguracaoWhatsApp") || canCreate("Sistema", "WhatsApp") || canCreate("Comercial", "WhatsApp") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "ConfiguracaoWhatsApp") || canEdit("Sistema", "WhatsApp") || canEdit("Comercial", "WhatsApp") || canEdit("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    provedor: "Evolution API",
    api_url: "",
    api_key: "",
    instance_id: "",
    numero_whatsapp: "",
    status_conexao: "Desconectado",
    enviar_pedido_aprovado: true,
    enviar_saida_entrega: true,
    enviar_entrega_concluida: true,
    enviar_cobranca: true,
    enviar_cobranca_dias_antes: 3,
    template_pedido_aprovado: "",
    template_saida_entrega: "",
    template_entrega_concluida: "",
    template_cobranca: "",
    ativo: true,
    observacoes: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!podeSalvar) {
      alert(dadosIniciais?.id ? "Sem permissao para editar configuracao do WhatsApp." : "Sem permissao para criar configuracao do WhatsApp.");
      return;
    }
    if (!contextoValido) {
      alert("Selecione um grupo ou empresa antes de salvar.");
      return;
    }

    const payload = {
      ...formData,
      provedor: sanitizeText(formData.provedor, 120),
      nome: sanitizeText(formData.provedor || "Configuracao WhatsApp", 180),
      api_url: sanitizeText(formData.api_url, 500),
      api_key: sanitizeSecret(formData.api_key),
      instance_id: sanitizeText(formData.instance_id, 180),
      numero_whatsapp: sanitizePhone(formData.numero_whatsapp),
      status_conexao: sanitizeText(formData.status_conexao, 60),
      enviar_cobranca_dias_antes: toInteger(formData.enviar_cobranca_dias_antes, 3),
      template_pedido_aprovado: sanitizeText(formData.template_pedido_aprovado, 2000),
      template_saida_entrega: sanitizeText(formData.template_saida_entrega, 2000),
      template_entrega_concluida: sanitizeText(formData.template_entrega_concluida, 2000),
      template_cobranca: sanitizeText(formData.template_cobranca, 2000),
      observacoes: sanitizeText(formData.observacoes, 1000),
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id
    };

    if (!payload.provedor || !payload.numero_whatsapp) {
      alert("Provedor e numero do WhatsApp sao obrigatorios.");
      return;
    }

    await onSubmit(payload);
  };

  const form = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            Configuracao WhatsApp Business
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Provedor *</Label>
              <Select value={formData.provedor} onValueChange={(val) => setFormData({ ...formData, provedor: val })} disabled={!podeSalvar}>
                <SelectTrigger data-permission="Sistema.WhatsApp.editar" data-action="selecionar-provedor-whatsapp" data-sensitive>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Evolution API">Evolution API</SelectItem>
                  <SelectItem value="Baileys">Baileys</SelectItem>
                  <SelectItem value="WPPCONNECT">WPPCONNECT</SelectItem>
                  <SelectItem value="Twilio">Twilio</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Numero WhatsApp *</Label>
              <Input value={formData.numero_whatsapp} onChange={(e) => setFormData({ ...formData, numero_whatsapp: e.target.value })} placeholder="(11) 98765-4321" disabled={!podeSalvar} data-permission="Sistema.WhatsApp.editar" data-action="editar-numero-whatsapp" data-sensitive />
            </div>
          </div>

          <div>
            <Label>URL da API</Label>
            <Input value={formData.api_url} onChange={(e) => setFormData({ ...formData, api_url: e.target.value })} placeholder="https://evolution-api.com" disabled={!podeSalvar} data-permission="Sistema.WhatsApp.editar" data-action="editar-url-whatsapp" data-sensitive />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>API Key</Label>
              <Input type="password" value={formData.api_key} onChange={(e) => setFormData({ ...formData, api_key: e.target.value })} placeholder="Token de autenticacao" disabled={!podeSalvar} data-permission="Sistema.WhatsApp.editar" data-action="editar-token-whatsapp" data-sensitive />
            </div>

            <div>
              <Label>Instance ID</Label>
              <Input value={formData.instance_id} onChange={(e) => setFormData({ ...formData, instance_id: e.target.value })} placeholder="ID da instancia" disabled={!podeSalvar} data-permission="Sistema.WhatsApp.editar" data-action="editar-instancia-whatsapp" data-sensitive />
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <p className="font-semibold text-slate-900">Eventos Automaticos</p>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded"><Label>Pedido Aprovado</Label><Switch checked={formData.enviar_pedido_aprovado} onCheckedChange={(val) => setFormData({ ...formData, enviar_pedido_aprovado: val })} disabled={!podeSalvar} data-permission="Sistema.WhatsApp.alterarStatus" data-action="alternar-pedido-aprovado-whatsapp" data-sensitive /></div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded"><Label>Saida para Entrega</Label><Switch checked={formData.enviar_saida_entrega} onCheckedChange={(val) => setFormData({ ...formData, enviar_saida_entrega: val })} disabled={!podeSalvar} data-permission="Sistema.WhatsApp.alterarStatus" data-action="alternar-saida-entrega-whatsapp" data-sensitive /></div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded"><Label>Entrega Concluida</Label><Switch checked={formData.enviar_entrega_concluida} onCheckedChange={(val) => setFormData({ ...formData, enviar_entrega_concluida: val })} disabled={!podeSalvar} data-permission="Sistema.WhatsApp.alterarStatus" data-action="alternar-entrega-concluida-whatsapp" data-sensitive /></div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded"><Label>Enviar Cobranca</Label><Switch checked={formData.enviar_cobranca} onCheckedChange={(val) => setFormData({ ...formData, enviar_cobranca: val })} disabled={!podeSalvar} data-permission="Sistema.WhatsApp.alterarStatus" data-action="alternar-cobranca-whatsapp" data-sensitive /></div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded"><Label>Configuracao Ativa</Label><Switch checked={formData.ativo} onCheckedChange={(val) => setFormData({ ...formData, ativo: val })} disabled={!podeSalvar} data-permission="Sistema.WhatsApp.alterarStatus" data-action="alternar-configuracao-whatsapp" data-sensitive /></div>
          </div>

          <div>
            <Label>Observacoes</Label>
            <Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={2} disabled={!podeSalvar} data-permission="Sistema.WhatsApp.editar" data-action="editar-observacoes-whatsapp" data-sensitive />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={isSubmitting || !podeSalvar} data-permission="Sistema.WhatsApp.salvar" data-action="salvar-configuracao-whatsapp" data-sensitive>
          <Save className="w-4 h-4 mr-2" />
          {isSubmitting ? "Salvando..." : dadosIniciais ? "Atualizar" : "Criar"}
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <MessageCircle className="w-8 h-8 text-green-600" />
            <h2 className="text-2xl font-bold text-slate-900">
              {dadosIniciais ? "Editar WhatsApp Business" : "Nova Configuracao WhatsApp"}
            </h2>
          </div>
          {form}
        </div>
      </div>
    );
  }

  return form;
}
