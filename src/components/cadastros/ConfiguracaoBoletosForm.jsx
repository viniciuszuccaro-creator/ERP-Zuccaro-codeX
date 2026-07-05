import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Save } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeSecret = (value) => String(value ?? "").replace(/[<>]/g, "").slice(0, 1200).trim();
const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const toInteger = (value, fallback = 0) => Number.isFinite(Number(value)) ? parseInt(value, 10) : fallback;

export default function ConfiguracaoBoletosForm({ config, item, data, initialData, defaultValues, onSubmit, isSubmitting, windowMode = false }) {
  const dadosIniciais = item || data || initialData || defaultValues || config;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "ConfiguracaoBoletos") || canCreate("Sistema", "Boletos") || canCreate("Financeiro", "Boletos") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "ConfiguracaoBoletos") || canEdit("Sistema", "Boletos") || canEdit("Financeiro", "Boletos") || canEdit("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    provedor: "Asaas",
    api_url: "",
    api_key: "",
    wallet_id: "",
    ambiente: "Sandbox",
    gerar_boleto_automatico: false,
    gerar_pix_automatico: true,
    dias_vencimento_padrao: 3,
    multa_percentual: 2,
    juros_diario_percentual: 0.033,
    desconto_antecipacao_percentual: 0,
    enviar_email_cobranca: true,
    enviar_whatsapp_cobranca: true,
    webhook_url: "",
    ativo: true,
    observacoes: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!podeSalvar) {
      alert(dadosIniciais?.id ? "Sem permissao para editar configuracao de boletos." : "Sem permissao para criar configuracao de boletos.");
      return;
    }
    if (!contextoValido) {
      alert("Selecione um grupo ou empresa antes de salvar.");
      return;
    }

    const payload = {
      ...formData,
      provedor: sanitizeText(formData.provedor, 120),
      nome: sanitizeText(formData.provedor || "Configuracao Boletos e PIX", 180),
      api_url: sanitizeText(formData.api_url, 500),
      api_key: sanitizeSecret(formData.api_key),
      wallet_id: sanitizeText(formData.wallet_id, 180),
      ambiente: sanitizeText(formData.ambiente, 40),
      dias_vencimento_padrao: toInteger(formData.dias_vencimento_padrao, 3),
      multa_percentual: toNumber(formData.multa_percentual, 0),
      juros_diario_percentual: toNumber(formData.juros_diario_percentual, 0),
      desconto_antecipacao_percentual: toNumber(formData.desconto_antecipacao_percentual, 0),
      webhook_url: sanitizeText(formData.webhook_url, 500),
      observacoes: sanitizeText(formData.observacoes, 1000),
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id
    };

    if (!payload.provedor || !payload.api_key) {
      alert("Provedor e API Key sao obrigatorios.");
      return;
    }

    await onSubmit(payload);
  };

  const form = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Configuracao Boletos & PIX
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Provedor *</Label>
              <Select value={formData.provedor} onValueChange={(val) => setFormData({ ...formData, provedor: val })} disabled={!podeSalvar}>
                <SelectTrigger data-permission="Sistema.Boletos.editar" data-action="selecionar-provedor-boletos" data-sensitive>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asaas">Asaas</SelectItem>
                  <SelectItem value="Juno">Juno</SelectItem>
                  <SelectItem value="Mercado Pago">Mercado Pago</SelectItem>
                  <SelectItem value="PagSeguro">PagSeguro</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Ambiente</Label>
              <Select value={formData.ambiente} onValueChange={(val) => setFormData({ ...formData, ambiente: val })} disabled={!podeSalvar}>
                <SelectTrigger data-permission="Sistema.Boletos.editar" data-action="selecionar-ambiente-boletos" data-sensitive>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sandbox">Sandbox (Testes)</SelectItem>
                  <SelectItem value="Producao">Producao</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>URL da API</Label>
            <Input value={formData.api_url} onChange={(e) => setFormData({ ...formData, api_url: e.target.value })} placeholder="https://www.asaas.com/api/v3" disabled={!podeSalvar} data-permission="Sistema.Boletos.editar" data-action="editar-url-api-boletos" data-sensitive />
          </div>

          <div>
            <Label>API Key *</Label>
            <Input type="password" value={formData.api_key} onChange={(e) => setFormData({ ...formData, api_key: e.target.value })} placeholder="Insira a chave da API" disabled={!podeSalvar} data-permission="Sistema.Boletos.editar" data-action="editar-api-key-boletos" data-sensitive />
          </div>

          <div>
            <Label>Wallet ID</Label>
            <Input value={formData.wallet_id} onChange={(e) => setFormData({ ...formData, wallet_id: e.target.value })} placeholder="ID da carteira (se aplicavel)" disabled={!podeSalvar} data-permission="Sistema.Boletos.editar" data-action="editar-wallet-boletos" data-sensitive />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><Label>Dias Vencimento</Label><Input type="number" value={formData.dias_vencimento_padrao} onChange={(e) => setFormData({ ...formData, dias_vencimento_padrao: parseInt(e.target.value, 10) })} disabled={!podeSalvar} data-permission="Sistema.Boletos.editar" data-action="editar-dias-vencimento" data-sensitive /></div>
            <div><Label>Multa (%)</Label><Input type="number" step="0.01" value={formData.multa_percentual} onChange={(e) => setFormData({ ...formData, multa_percentual: parseFloat(e.target.value) })} disabled={!podeSalvar} data-permission="Sistema.Boletos.editar" data-action="editar-multa-boletos" data-sensitive /></div>
            <div><Label>Juros/Dia (%)</Label><Input type="number" step="0.001" value={formData.juros_diario_percentual} onChange={(e) => setFormData({ ...formData, juros_diario_percentual: parseFloat(e.target.value) })} disabled={!podeSalvar} data-permission="Sistema.Boletos.editar" data-action="editar-juros-boletos" data-sensitive /></div>
            <div><Label>Desc. Antec. (%)</Label><Input type="number" step="0.01" value={formData.desconto_antecipacao_percentual} onChange={(e) => setFormData({ ...formData, desconto_antecipacao_percentual: parseFloat(e.target.value) })} disabled={!podeSalvar} data-permission="Sistema.Boletos.editar" data-action="editar-desconto-boletos" data-sensitive /></div>
          </div>

          <div>
            <Label>Webhook URL</Label>
            <Input value={formData.webhook_url} onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })} placeholder="https://seusite.com/webhook/pagamentos" disabled={!podeSalvar} data-permission="Sistema.Boletos.editar" data-action="editar-webhook-boletos" data-sensitive />
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded"><Label>Gerar Boleto Automaticamente</Label><Switch checked={formData.gerar_boleto_automatico} onCheckedChange={(val) => setFormData({ ...formData, gerar_boleto_automatico: val })} disabled={!podeSalvar} data-permission="Sistema.Boletos.alterarStatus" data-action="alternar-boleto-automatico" data-sensitive /></div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded"><Label>Gerar PIX Automaticamente</Label><Switch checked={formData.gerar_pix_automatico} onCheckedChange={(val) => setFormData({ ...formData, gerar_pix_automatico: val })} disabled={!podeSalvar} data-permission="Sistema.Boletos.alterarStatus" data-action="alternar-pix-automatico" data-sensitive /></div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded"><Label>Enviar Email com Cobranca</Label><Switch checked={formData.enviar_email_cobranca} onCheckedChange={(val) => setFormData({ ...formData, enviar_email_cobranca: val })} disabled={!podeSalvar} data-permission="Sistema.Boletos.alterarStatus" data-action="alternar-email-cobranca" data-sensitive /></div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded"><Label>Enviar WhatsApp com Cobranca</Label><Switch checked={formData.enviar_whatsapp_cobranca} onCheckedChange={(val) => setFormData({ ...formData, enviar_whatsapp_cobranca: val })} disabled={!podeSalvar} data-permission="Sistema.Boletos.alterarStatus" data-action="alternar-whatsapp-cobranca" data-sensitive /></div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded"><Label>Configuracao Ativa</Label><Switch checked={formData.ativo} onCheckedChange={(val) => setFormData({ ...formData, ativo: val })} disabled={!podeSalvar} data-permission="Sistema.Boletos.alterarStatus" data-action="alternar-configuracao-boletos" data-sensitive /></div>
          </div>

          <div>
            <Label>Observacoes</Label>
            <Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={2} disabled={!podeSalvar} data-permission="Sistema.Boletos.editar" data-action="editar-observacoes-boletos" data-sensitive />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={isSubmitting || !podeSalvar} data-permission="Sistema.Boletos.salvar" data-action="salvar-configuracao-boletos" data-sensitive>
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
            <DollarSign className="w-8 h-8 text-green-600" />
            <h2 className="text-2xl font-bold text-slate-900">
              {dadosIniciais ? "Editar Configuracao Boletos & PIX" : "Nova Configuracao Boletos & PIX"}
            </h2>
          </div>
          {form}
        </div>
      </div>
    );
  }

  return form;
}
