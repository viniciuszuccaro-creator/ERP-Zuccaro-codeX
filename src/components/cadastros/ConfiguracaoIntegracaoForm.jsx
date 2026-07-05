import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Save } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeSecret = (value) => String(value ?? "").replace(/[<>]/g, "").slice(0, 1200).trim();
const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export default function ConfiguracaoIntegracaoForm({ config, item, data, initialData, defaultValues, onSubmit, isSubmitting, windowMode = false }) {
  const dadosIniciais = item || data || initialData || defaultValues || config;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "ConfiguracaoIntegracao") || canCreate("Sistema", "Integracoes") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "ConfiguracaoIntegracao") || canEdit("Sistema", "Integracoes") || canEdit("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    marketplace: "",
    nome_integracao: "",
    tipo_integracao: "API REST",
    descricao: "",
    url_base: "",
    api_key: "",
    headers_customizados: {},
    timeout_segundos: 30,
    max_tentativas_retry: 3,
    ativo: true,
    observacoes: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!podeSalvar) {
      alert(dadosIniciais?.id ? "Sem permissao para editar integracoes." : "Sem permissao para criar integracoes.");
      return;
    }
    if (!contextoValido) {
      alert("Selecione um grupo ou empresa antes de salvar.");
      return;
    }
    const payload = {
      ...formData,
      marketplace: sanitizeText(formData.marketplace, 180),
      nome_integracao: sanitizeText(formData.nome_integracao, 180),
      nome: sanitizeText(formData.nome_integracao || formData.marketplace, 180),
      tipo_integracao: sanitizeText(formData.tipo_integracao, 60),
      descricao: sanitizeText(formData.descricao, 1000),
      url_base: sanitizeText(formData.url_base, 500),
      api_key: sanitizeSecret(formData.api_key),
      timeout_segundos: toNumber(formData.timeout_segundos, 30),
      max_tentativas_retry: toNumber(formData.max_tentativas_retry, 3),
      observacoes: sanitizeText(formData.observacoes, 1000),
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id
    };
    if (!payload.marketplace && !payload.nome_integracao) {
      alert("Nome da integracao ou marketplace e obrigatorio");
      return;
    }
    await onSubmit(payload);
  };

  const form = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-600" />
            Configuracao de Integracao
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Marketplace *</Label>
              <Input value={formData.marketplace} onChange={(e) => setFormData({ ...formData, marketplace: e.target.value })} placeholder="Ex: Mercado Livre, Amazon, Magalu" disabled={!podeSalvar} data-permission="Sistema.Integracoes.editar" data-action="editar-marketplace-integracao" data-sensitive />
            </div>
            <div>
              <Label>Nome da Integracao</Label>
              <Input value={formData.nome_integracao} onChange={(e) => setFormData({ ...formData, nome_integracao: e.target.value })} placeholder="Ex: ML Producao" disabled={!podeSalvar} data-permission="Sistema.Integracoes.editar" data-action="editar-nome-integracao" data-sensitive />
            </div>
          </div>

          <div>
            <Label>Tipo de Integracao</Label>
            <Select value={formData.tipo_integracao} onValueChange={(val) => setFormData({ ...formData, tipo_integracao: val })} disabled={!podeSalvar}>
              <SelectTrigger data-permission="Sistema.Integracoes.editar" data-action="selecionar-tipo-integracao" data-sensitive><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="API REST">API REST</SelectItem>
                <SelectItem value="SOAP">SOAP</SelectItem>
                <SelectItem value="GraphQL">GraphQL</SelectItem>
                <SelectItem value="Webhook">Webhook</SelectItem>
                <SelectItem value="FTP">FTP</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div><Label>URL Base</Label><Input value={formData.url_base} onChange={(e) => setFormData({ ...formData, url_base: e.target.value })} placeholder="https://api.exemplo.com/v1" disabled={!podeSalvar} data-permission="Sistema.Integracoes.editar" data-action="editar-url-integracao" data-sensitive /></div>
          <div><Label>API Key / Token</Label><Input type="password" value={formData.api_key} onChange={(e) => setFormData({ ...formData, api_key: e.target.value })} placeholder="Insira o token de autenticacao" disabled={!podeSalvar} data-permission="Sistema.Integracoes.editar" data-action="editar-token-integracao" data-sensitive /></div>
          <div><Label>Descricao</Label><Textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} placeholder="Descreva o proposito desta integracao" rows={3} disabled={!podeSalvar} data-permission="Sistema.Integracoes.editar" data-action="editar-descricao-integracao" data-sensitive /></div>

          <div className="grid grid-cols-2 gap-4">
            <div><Label>Timeout (segundos)</Label><Input type="number" value={formData.timeout_segundos} onChange={(e) => setFormData({ ...formData, timeout_segundos: parseInt(e.target.value) })} disabled={!podeSalvar} data-permission="Sistema.Integracoes.editar" data-action="editar-timeout-integracao" data-sensitive /></div>
            <div><Label>Max. Tentativas Retry</Label><Input type="number" value={formData.max_tentativas_retry} onChange={(e) => setFormData({ ...formData, max_tentativas_retry: parseInt(e.target.value) })} disabled={!podeSalvar} data-permission="Sistema.Integracoes.editar" data-action="editar-retry-integracao" data-sensitive /></div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded"><Label>Integracao Ativa</Label><Switch checked={formData.ativo} onCheckedChange={(val) => setFormData({ ...formData, ativo: val })} disabled={!podeSalvar} data-permission="Sistema.Integracoes.alterarStatus" data-action="alternar-integracao-ativa" data-sensitive /></div>
          <div><Label>Observacoes</Label><Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={2} disabled={!podeSalvar} data-permission="Sistema.Integracoes.editar" data-action="editar-observacoes-integracao" data-sensitive /></div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSubmitting || !contextoValido || !podeSalvar} data-permission="Sistema.Integracoes.salvar" data-action="salvar-integracao" data-sensitive>
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
          <div className="flex items-center gap-3 mb-6 pb-4 border-b"><Link2 className="w-8 h-8 text-blue-600" /><h2 className="text-2xl font-bold text-slate-900">{dadosIniciais ? "Editar Integracao" : "Nova Integracao"}</h2></div>
          {form}
        </div>
      </div>
    );
  }

  return form;
}
