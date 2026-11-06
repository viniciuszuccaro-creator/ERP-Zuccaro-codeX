import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import useCadastroRecordState from './useCadastroRecordState';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, X, Settings, Zap } from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * Formulário para configurar origens de pedido por canal
 * Permite definir como cada canal (ERP, Site, Chatbot, etc.) cria pedidos
 * 
 * @param {Object} parametro - Parâmetro existente (para edição) ou null (para novo)
 * @param {Function} onSuccess - Callback após salvar com sucesso
 * @param {Function} onCancel - Callback para cancelar
 * @param {boolean} windowMode - Se está em modo janela
 */
export default function ParametroOrigemPedidoForm({ 
  parametro: parametroProp = null,
  item = undefined, data = undefined, initialData = undefined, defaultValues = undefined,
  onSuccess, 
  onCancel,
  windowMode = false 
}) {
  const parametro = parametroProp || item || data || initialData || defaultValues || null;
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, createInContext, updateInContext } = useContextoVisual();
  const { canCreate, canEdit } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextKey = empresaAtual?.id || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const podeSalvar = parametro?.id
    ? (canEdit("Cadastros", "ParametroOrigemPedido") || canEdit("Cadastros", "Canais de Origem") || canEdit("Cadastros", null))
    : (canCreate("Cadastros", "ParametroOrigemPedido") || canCreate("Cadastros", "Canais de Origem") || canCreate("Cadastros", null));
  
  const [formData, setFormData] = useCadastroRecordState({
    nome: parametro?.nome || '',
    canal: parametro?.canal || 'ERP',
    tipo_criacao: parametro?.tipo_criacao || 'Manual',
    origem_pedido_manual: parametro?.origem_pedido_manual || 'Manual',
    origem_pedido_automatico: parametro?.origem_pedido_automatico || 'Manual',
    bloquear_edicao_automatico: parametro?.bloquear_edicao_automatico ?? true,
    url_webhook: parametro?.url_webhook || '',
    api_token: parametro?.api_token || '',
    ativo: parametro?.ativo ?? true,
    descricao: parametro?.descricao || '',
    cor_badge: parametro?.cor_badge || 'blue',
    empresa_id: parametro?.empresa_id || empresaAtual?.id || '',
    group_id: parametro?.group_id || groupId || '',
  }, JSON.stringify([parametro?.id ?? null, parametro?.updated_date ?? null, groupId, empresaAtual?.id ?? null]));

  const mutation = useMutation({
    mutationFn: (data) => {
      if (!contextoValido) throw new Error("Selecione um grupo ou empresa antes de salvar.");
      if (!podeSalvar) throw new Error("Seu perfil nao permite salvar canais de origem.");
      const payload = {
        ...data,
        ...(empresaAtual?.id && !data.empresa_id ? { empresa_id: empresaAtual.id } : {}),
        ...(groupId && !data.group_id ? { group_id: groupId } : {})
      };
      if (parametro?.id) {
        return updateInContext('ParametroOrigemPedido', parametro.id, payload);
      }
      return createInContext('ParametroOrigemPedido', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parametros-origem-pedido'] });
      toast.success(parametro ? 'Parâmetro atualizado!' : 'Parâmetro criado!');
      onSuccess?.();
    },
    onError: (error) => {
      toast.error('Erro ao salvar: ' + error.message);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const containerClass = windowMode 
    ? "w-full h-full flex flex-col overflow-hidden" 
    : "";

  return (
    <div className={containerClass}>
      <form onSubmit={handleSubmit} className={windowMode ? "flex-1 overflow-auto p-6 space-y-6" : "space-y-6"}>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="w-5 h-5 text-blue-600" />
              Configuração do Canal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nome">Nome do Canal *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: ERP Manual, Site Automático"
                  required
                />
              </div>

              <div>
                <Label htmlFor="canal">Canal *</Label>
                <Select
                  value={formData.canal}
                  onValueChange={(value) => setFormData({ ...formData, canal: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ERP">ERP</SelectItem>
                    <SelectItem value="Site">Site</SelectItem>
                    <SelectItem value="Chatbot">Chatbot</SelectItem>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="API">API</SelectItem>
                    <SelectItem value="Marketplace">Marketplace</SelectItem>
                    <SelectItem value="E-commerce">E-commerce</SelectItem>
                    <SelectItem value="Portal Cliente">Portal Cliente</SelectItem>
                    <SelectItem value="App Mobile">App Mobile</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="tipo_criacao">Tipo de Criação *</Label>
                <Select
                  value={formData.tipo_criacao}
                  onValueChange={(value) => setFormData({ ...formData, tipo_criacao: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manual">Manual</SelectItem>
                    <SelectItem value="Automático">Automático</SelectItem>
                    <SelectItem value="Misto">Misto (Manual + Automático)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="cor_badge">Cor do Badge</Label>
                <Select
                  value={formData.cor_badge}
                  onValueChange={(value) => setFormData({ ...formData, cor_badge: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blue">Azul</SelectItem>
                    <SelectItem value="green">Verde</SelectItem>
                    <SelectItem value="purple">Roxo</SelectItem>
                    <SelectItem value="orange">Laranja</SelectItem>
                    <SelectItem value="red">Vermelho</SelectItem>
                    <SelectItem value="yellow">Amarelo</SelectItem>
                    <SelectItem value="pink">Rosa</SelectItem>
                    <SelectItem value="cyan">Ciano</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between pt-7">
                <Label htmlFor="ativo">Canal Ativo</Label>
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descreva como este canal funciona..."
                rows={2}
              />
            </div>

          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="w-5 h-5 text-sky-600" />
              Mapeamento de Origem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {(formData.tipo_criacao === 'Manual' || formData.tipo_criacao === 'Misto') && (
              <div>
                <Label htmlFor="origem_pedido_manual">
                  Origem do Pedido (Criação Manual)
                </Label>
                <Select
                  value={formData.origem_pedido_manual}
                  onValueChange={(value) => setFormData({ ...formData, origem_pedido_manual: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manual">Manual</SelectItem>
                    <SelectItem value="E-commerce">E-commerce</SelectItem>
                    <SelectItem value="API">API</SelectItem>
                    <SelectItem value="Importado">Importado</SelectItem>
                    <SelectItem value="Site">Site</SelectItem>
                    <SelectItem value="App">App</SelectItem>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="Portal">Portal</SelectItem>
                    <SelectItem value="Marketplace">Marketplace</SelectItem>
                    <SelectItem value="Chatbot">Chatbot</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">
                  Valor que será usado quando o pedido for criado manualmente neste canal
                </p>
              </div>
            )}

            {(formData.tipo_criacao === 'Automático' || formData.tipo_criacao === 'Misto') && (
              <>
                <div>
                  <Label htmlFor="origem_pedido_automatico">
                    Origem do Pedido (Criação Automática)
                  </Label>
                  <Select
                    value={formData.origem_pedido_automatico}
                    onValueChange={(value) => setFormData({ ...formData, origem_pedido_automatico: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Manual">Manual</SelectItem>
                      <SelectItem value="E-commerce">E-commerce</SelectItem>
                      <SelectItem value="API">API</SelectItem>
                      <SelectItem value="Importado">Importado</SelectItem>
                      <SelectItem value="Site">Site</SelectItem>
                      <SelectItem value="App">App</SelectItem>
                      <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                      <SelectItem value="Portal">Portal</SelectItem>
                      <SelectItem value="Marketplace">Marketplace</SelectItem>
                      <SelectItem value="Chatbot">Chatbot</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">
                    Valor que será usado quando o pedido for criado automaticamente neste canal
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <Label htmlFor="bloquear_edicao">Bloquear Edição (Automático)</Label>
                    <p className="text-xs text-slate-500">
                      Impede que o usuário altere a origem em pedidos automáticos
                    </p>
                  </div>
                  <Switch
                    id="bloquear_edicao"
                    checked={formData.bloquear_edicao_automatico}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, bloquear_edicao_automatico: checked })
                    }
                  />
                </div>
              </>
            )}

          </CardContent>
        </Card>

        {(formData.canal === 'API' || formData.canal === 'Marketplace') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configurações de Integração</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="url_webhook">URL do Webhook</Label>
                <Input
                  id="url_webhook"
                  type="url"
                  value={formData.url_webhook}
                  onChange={(e) => setFormData({ ...formData, url_webhook: e.target.value })}
                  placeholder="https://api.exemplo.com/webhook/pedidos"
                />
              </div>

              <div>
                <Label htmlFor="api_token">Token de Autenticação</Label>
                <Input
                  id="api_token"
                  type="password"
                  value={formData.api_token}
                  onChange={(e) => setFormData({ ...formData, api_token: e.target.value })}
                  placeholder="Token secreto da API"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {!windowMode && (
          <div className="flex gap-3 justify-end pt-4 border-t">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={mutation.isPending || !contextoValido || !podeSalvar}>
              <Save className="w-4 h-4 mr-2" />
              {mutation.isPending ? 'Salvando...' : parametro ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        )}

      </form>

      {windowMode && (
        <div className="p-4 border-t bg-white flex gap-3 justify-end">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={mutation.isPending || !contextoValido || !podeSalvar}>
            <Save className="w-4 h-4 mr-2" />
            {mutation.isPending ? 'Salvando...' : parametro ? 'Atualizar' : 'Criar'}
          </Button>
        </div>
      )}
    </div>
  );
}
