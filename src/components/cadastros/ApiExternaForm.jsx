import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Save } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

export default function ApiExternaForm({ apiExterna, onSubmit, isSubmitting, windowMode = false }) {
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || apiExterna?.group_id || null;
  const contextoValido = Boolean(groupId || empresaAtual?.id || apiExterna?.empresa_id);
  const podeCriar = canCreate("Cadastros", "ApiExterna") || canCreate("Sistema", "ApiExterna") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "ApiExterna") || canEdit("Sistema", "ApiExterna") || canEdit("Cadastros", null);
  const podeSalvar = apiExterna?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(apiExterna || {
    nome_integracao: "",
    tipo_api: "REST",
    descricao: "",
    url_base: "",
    api_key: "",
    api_secret: "",
    headers_autenticacao: {},
    timeout_segundos: 30,
    ativo: true,
    observacoes: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome_integracao) {
      alert('Nome da integração é obrigatório');
      return;
    }
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeSalvar) {
      alert('Sem permissao para salvar APIs externas.');
      return;
    }
    await onSubmit({
      ...formData,
      nome: formData.nome_integracao,
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
    });
  };

  const form = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            API Externa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome da Integração *</Label>
              <Input
                value={formData.nome_integracao}
                onChange={(e) => setFormData({ ...formData, nome_integracao: e.target.value })}
                placeholder="Ex: API WhatsApp Business"
                disabled={!podeSalvar}
                data-permission="Cadastros.ApiExterna.editar"
                data-action="editar-nome-api-externa"
                data-sensitive
              />
            </div>
            <div>
              <Label>Tipo de API</Label>
              <Select value={formData.tipo_api} onValueChange={(val) => setFormData({ ...formData, tipo_api: val })} disabled={!podeSalvar}>
                <SelectTrigger data-permission="Cadastros.ApiExterna.editar" data-action="editar-tipo-api-externa" data-sensitive>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REST">REST</SelectItem>
                  <SelectItem value="GraphQL">GraphQL</SelectItem>
                  <SelectItem value="SOAP">SOAP</SelectItem>
                  <SelectItem value="Webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>URL Base</Label>
            <Input
              value={formData.url_base}
              onChange={(e) => setFormData({ ...formData, url_base: e.target.value })}
              placeholder="https://api.exemplo.com/v1"
              disabled={!podeSalvar}
              data-permission="Cadastros.ApiExterna.editar"
              data-action="editar-url-api-externa"
              data-sensitive
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>API Key</Label>
              <Input
                type="password"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                disabled={!podeSalvar}
                data-permission="Cadastros.ApiExterna.credenciais"
                data-action="editar-api-key-api-externa"
                data-sensitive
              />
            </div>
            <div>
              <Label>API Secret</Label>
              <Input
                type="password"
                value={formData.api_secret}
                onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                disabled={!podeSalvar}
                data-permission="Cadastros.ApiExterna.credenciais"
                data-action="editar-api-secret-api-externa"
                data-sensitive
              />
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={3}
              disabled={!podeSalvar}
              data-permission="Cadastros.ApiExterna.editar"
              data-action="editar-descricao-api-externa"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
            <Label>API Ativa</Label>
            <Switch
              checked={formData.ativo}
              onCheckedChange={(val) => setFormData({ ...formData, ativo: val })}
              disabled={!podeSalvar}
              data-permission="Cadastros.ApiExterna.editar"
              data-action="alternar-api-externa"
              data-sensitive
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSubmitting || !contextoValido || !podeSalvar} data-permission="Cadastros.ApiExterna.salvar" data-action="salvar-api-externa" data-sensitive>
          <Save className="w-4 h-4 mr-2" />
          {isSubmitting ? 'Salvando...' : apiExterna ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <Zap className="w-8 h-8 text-blue-600" />
            <h2 className="text-2xl font-bold text-slate-900">
              {apiExterna ? 'Editar API Externa' : 'Nova API Externa'}
            </h2>
          </div>
          {form}
        </div>
      </div>
    );
  }

  return form;
}
