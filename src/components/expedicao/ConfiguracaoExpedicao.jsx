import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Truck, MessageCircle, Mail, Settings } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";

const sanitizeText = (value) => String(value || "")
  .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
  .replace(/javascript:\s*/gi, "")
  .trim();

const sanitizeObject = (obj) => Object.fromEntries(
  Object.entries(obj || {}).map(([key, value]) => [key, typeof value === "string" ? sanitizeText(value) : value])
);

const defaultTransportadora = {
  provider: "Nenhum",
  api_url: "",
  api_token: "",
  calcular_frete_auto: false,
  enviar_rastreamento_auto: false
};

const defaultWhatsApp = {
  provider: "Nenhum",
  api_url: "",
  api_token: "",
  enviar_auto: false,
  modelo_saida: "Seu pedido {{numero_pedido}} saiu para entrega. Previsão: {{data_prevista}}.",
  modelo_entregue: "Seu pedido {{numero_pedido}} foi entregue. Obrigado!",
  modelo_frustrada: "Tentativa de entrega do pedido {{numero_pedido}} não concluída. Motivo: {{motivo}}"
};

const defaultEmail = {
  enviar_auto: false,
  assunto_saida: "Seu pedido saiu para entrega",
  assunto_entregue: "Pedido entregue",
  corpo_saida: "",
  corpo_entregue: ""
};

const defaultGeral = {
  separacao_obrigatoria: false,
  foto_obrigatoria: false,
  assinatura_obrigatoria: false,
  perguntar_salvar_cliente: false,
  google_maps_api_key: ""
};

/**
 * Configuracao de integracoes e regras da Expedicao.
 */
export default function ConfiguracaoExpedicao({ empresaId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const effectiveEmpresaId = empresaId || empresaAtual?.id || null;
  const effectiveGroupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(effectiveGroupId || effectiveEmpresaId);
  const canViewConfig = hasPermission("Expedicao", "Configuracoes", "visualizar") || hasPermission("Expedicao", "Painel Logistico", "visualizar");
  const canEditConfig = hasPermission("Expedicao", "Configuracoes", "editar") || hasPermission("Expedicao", "Painel Logistico", "editar");
  const configKey = effectiveEmpresaId ? `expedicao_${effectiveEmpresaId}` : `expedicao_grupo_${effectiveGroupId || "sem_contexto"}`;

  const [configTransportadora, setConfigTransportadora] = useState(defaultTransportadora);
  const [configWhatsApp, setConfigWhatsApp] = useState(defaultWhatsApp);
  const [configEmail, setConfigEmail] = useState(defaultEmail);
  const [configGeral, setConfigGeral] = useState(defaultGeral);

  const auditConfig = async ({ acao, sucesso = true, motivo = null, detalhes = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: "Expedicao",
        entidade: "ConfiguracaoSistema",
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        usuario_id: user?.id || user?.email || null,
        usuario_nome: user?.full_name || user?.email || "Sistema",
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId,
        resultado: sucesso ? "sucesso" : "bloqueado",
        motivo,
        detalhes,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar configuracao de expedicao", error);
    }
  };

  const { data: config, isLoading } = useQuery({
    queryKey: ["config-expedicao", configKey, effectiveGroupId, effectiveEmpresaId],
    queryFn: async () => {
      const configs = await filterInContext("ConfiguracaoSistema", { chave: configKey, categoria: "Integracoes" }, undefined, 1);
      return configs[0] || null;
    },
    enabled: contextoValido && canViewConfig
  });

  useEffect(() => {
    if (!config) return;
    setConfigTransportadora({ ...defaultTransportadora, ...(config.integracao_transportadoras || {}) });
    setConfigWhatsApp({ ...defaultWhatsApp, ...(config.integracao_whatsapp || {}) });
    setConfigEmail({ ...defaultEmail, ...(config.configuracoes_email || {}) });
    setConfigGeral({ ...defaultGeral, ...(config.configuracoes_gerais || {}) });
  }, [config]);

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!contextoValido || !canEditConfig) {
        await auditConfig({ acao: "ConfiguracaoExpedicao.salvar.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
        throw new Error("Contexto e permissao sao obrigatorios para salvar configuracoes de expedicao.");
      }
      const confirmado = window.confirm("Confirma salvar as configurações de expedição para o contexto atual?");
      if (!confirmado) {
        await auditConfig({ acao: "ConfiguracaoExpedicao.salvar.cancelado", sucesso: false, motivo: "confirmacao_cancelada" });
        throw new Error("Salvamento cancelado pelo usuario.");
      }
      const dadosConfig = {
        chave: configKey,
        categoria: "Integracoes",
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId,
        integracao_transportadoras: sanitizeObject(configTransportadora),
        integracao_whatsapp: sanitizeObject(configWhatsApp),
        configuracoes_email: sanitizeObject(configEmail),
        configuracoes_gerais: sanitizeObject(configGeral)
      };

      const saved = config?.id
        ? await updateInContext("ConfiguracaoSistema", config.id, dadosConfig)
        : await createInContext("ConfiguracaoSistema", dadosConfig);
      await auditConfig({ acao: "ConfiguracaoExpedicao.salvar", detalhes: { configKey, registro_id: saved?.id || config?.id || null } });
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config-expedicao"] });
      toast({ title: "Configurações salvas!" });
    },
    onError: (error) => {
      auditConfig({ acao: "ConfiguracaoExpedicao.salvar.erro", sucesso: false, motivo: error?.message || "erro_salvar" });
      toast({ title: "Erro ao salvar configurações", description: error?.message || "Tente novamente", variant: "destructive" });
    }
  });

  const disabled = isLoading || !contextoValido || !canEditConfig || salvarMutation.isPending;

  return (
    <div className="w-full h-full space-y-6" data-permission="Expedicao.Configuracoes.visualizar" data-context-required="true">
      <Tabs defaultValue="transportadora">
        <TabsList className="bg-white border shadow-sm">
          <TabsTrigger value="transportadora"><Truck className="w-4 h-4 mr-2" />Transportadoras</TabsTrigger>
          <TabsTrigger value="whatsapp"><MessageCircle className="w-4 h-4 mr-2" />WhatsApp</TabsTrigger>
          <TabsTrigger value="email"><Mail className="w-4 h-4 mr-2" />E-mail</TabsTrigger>
          <TabsTrigger value="geral"><Settings className="w-4 h-4 mr-2" />Geral</TabsTrigger>
        </TabsList>

        <TabsContent value="transportadora" className="space-y-4">
          <Card>
            <CardHeader className="bg-blue-50 border-b"><CardTitle className="text-base">Integração com Transportadoras</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>Provedor</Label>
                <Select value={configTransportadora.provider} onValueChange={(v) => setConfigTransportadora({ ...configTransportadora, provider: v })} disabled={disabled}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nenhum">Nenhum</SelectItem>
                    <SelectItem value="Melhor Envio">Melhor Envio</SelectItem>
                    <SelectItem value="Kangu">Kangu</SelectItem>
                    <SelectItem value="Correios">Correios (API)</SelectItem>
                    <SelectItem value="Jadlog">Jadlog</SelectItem>
                    <SelectItem value="Custom">Custom API</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {configTransportadora.provider !== "Nenhum" && (
                <>
                  <div><Label>URL da API</Label><Input value={configTransportadora.api_url} onChange={(e) => setConfigTransportadora({ ...configTransportadora, api_url: e.target.value })} placeholder="https://api.melhorenvio.com/..." className="mt-2" disabled={disabled} /></div>
                  <div><Label>API Token/Key</Label><Input type="password" value={configTransportadora.api_token} onChange={(e) => setConfigTransportadora({ ...configTransportadora, api_token: e.target.value })} placeholder="Seu token de API" className="mt-2" disabled={disabled} /></div>
                  <div className="flex items-center gap-3 pt-3"><input type="checkbox" id="calc-frete" checked={configTransportadora.calcular_frete_auto} onChange={(e) => setConfigTransportadora({ ...configTransportadora, calcular_frete_auto: e.target.checked })} disabled={disabled} /><label htmlFor="calc-frete" className="text-sm">Calcular frete automaticamente ao criar entrega</label></div>
                  <div className="flex items-center gap-3"><input type="checkbox" id="rastreamento" checked={configTransportadora.enviar_rastreamento_auto} onChange={(e) => setConfigTransportadora({ ...configTransportadora, enviar_rastreamento_auto: e.target.checked })} disabled={disabled} /><label htmlFor="rastreamento" className="text-sm">Enviar código de rastreamento para o cliente</label></div>
                </>
              )}

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                <strong>Atenção:</strong> As integrações estão preparadas, mas ainda não implementadas. Configure agora e elas serão ativadas em atualizações futuras.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader className="bg-green-50 border-b"><CardTitle className="text-base">Integração WhatsApp</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>Provedor WhatsApp</Label>
                <Select value={configWhatsApp.provider} onValueChange={(v) => setConfigWhatsApp({ ...configWhatsApp, provider: v })} disabled={disabled}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nenhum">Nenhum</SelectItem>
                    <SelectItem value="Twilio">Twilio</SelectItem>
                    <SelectItem value="Zenvia">Zenvia</SelectItem>
                    <SelectItem value="Evolution API">Evolution API</SelectItem>
                    <SelectItem value="Custom">Custom API</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {configWhatsApp.provider !== "Nenhum" && (
                <>
                  <div><Label>URL da API</Label><Input value={configWhatsApp.api_url} onChange={(e) => setConfigWhatsApp({ ...configWhatsApp, api_url: e.target.value })} className="mt-2" disabled={disabled} /></div>
                  <div><Label>API Token</Label><Input type="password" value={configWhatsApp.api_token} onChange={(e) => setConfigWhatsApp({ ...configWhatsApp, api_token: e.target.value })} className="mt-2" disabled={disabled} /></div>
                  <div className="space-y-3 pt-4">
                    <h4 className="font-semibold text-sm">Modelos de Mensagens</h4>
                    <div><Label>Saída para Entrega</Label><Textarea value={configWhatsApp.modelo_saida} onChange={(e) => setConfigWhatsApp({ ...configWhatsApp, modelo_saida: e.target.value })} rows={2} className="mt-2" disabled={disabled} /><p className="text-xs text-slate-500 mt-1">Variáveis: <span className="font-mono">{"{{numero_pedido}}"}</span>, <span className="font-mono">{"{{data_prevista}}"}</span></p></div>
                    <div><Label>Entrega Concluída</Label><Textarea value={configWhatsApp.modelo_entregue} onChange={(e) => setConfigWhatsApp({ ...configWhatsApp, modelo_entregue: e.target.value })} rows={2} className="mt-2" disabled={disabled} /></div>
                    <div><Label>Entrega Frustrada</Label><Textarea value={configWhatsApp.modelo_frustrada} onChange={(e) => setConfigWhatsApp({ ...configWhatsApp, modelo_frustrada: e.target.value })} rows={2} className="mt-2" disabled={disabled} /><p className="text-xs text-slate-500 mt-1">Variável: <span className="font-mono">{"{{motivo}}"}</span></p></div>
                  </div>
                  <div className="flex items-center gap-3"><input type="checkbox" id="whats-auto" checked={configWhatsApp.enviar_auto} onChange={(e) => setConfigWhatsApp({ ...configWhatsApp, enviar_auto: e.target.checked })} disabled={disabled} /><label htmlFor="whats-auto" className="text-sm">Enviar mensagens automaticamente</label></div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader className="bg-purple-50 border-b"><CardTitle className="text-base">Notificações por E-mail</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded"><input type="checkbox" id="email-auto" checked={configEmail.enviar_auto} onChange={(e) => setConfigEmail({ ...configEmail, enviar_auto: e.target.checked })} disabled={disabled} /><label htmlFor="email-auto" className="text-sm">Enviar e-mails automaticamente nas mudanças de status</label></div>
              <div><Label>Assunto - Saída para Entrega</Label><Input value={configEmail.assunto_saida} onChange={(e) => setConfigEmail({ ...configEmail, assunto_saida: e.target.value })} className="mt-2" disabled={disabled} /></div>
              <div><Label>Corpo do E-mail - Saída</Label><Textarea value={configEmail.corpo_saida} onChange={(e) => setConfigEmail({ ...configEmail, corpo_saida: e.target.value })} rows={4} className="mt-2" placeholder="Olá {{cliente_nome}}, seu pedido {{numero_pedido}} saiu para entrega..." disabled={disabled} /></div>
              <div><Label>Assunto - Entrega Concluída</Label><Input value={configEmail.assunto_entregue} onChange={(e) => setConfigEmail({ ...configEmail, assunto_entregue: e.target.value })} className="mt-2" disabled={disabled} /></div>
              <div><Label>Corpo do E-mail - Entregue</Label><Textarea value={configEmail.corpo_entregue} onChange={(e) => setConfigEmail({ ...configEmail, corpo_entregue: e.target.value })} rows={4} className="mt-2" disabled={disabled} /></div>
              <p className="text-xs text-slate-500 p-3 bg-slate-50 rounded">O servidor SMTP é configurado em Integrações &gt; E-mail.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geral" className="space-y-4">
          <Card>
            <CardHeader className="bg-slate-50 border-b"><CardTitle className="text-base">Configurações Gerais</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Regras de Expedição</h4>
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded"><input type="checkbox" id="separacao-obrigatoria" checked={configGeral.separacao_obrigatoria} onChange={(e) => setConfigGeral({ ...configGeral, separacao_obrigatoria: e.target.checked })} disabled={disabled} /><label htmlFor="separacao-obrigatoria" className="text-sm">Exigir separação/conferência antes de gerar romaneio</label></div>
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded"><input type="checkbox" id="foto-obrigatoria" checked={configGeral.foto_obrigatoria} onChange={(e) => setConfigGeral({ ...configGeral, foto_obrigatoria: e.target.checked })} disabled={disabled} /><label htmlFor="foto-obrigatoria" className="text-sm">Foto de comprovante obrigatória para finalizar entrega</label></div>
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded"><input type="checkbox" id="assinatura-obrigatoria" checked={configGeral.assinatura_obrigatoria} onChange={(e) => setConfigGeral({ ...configGeral, assinatura_obrigatoria: e.target.checked })} disabled={disabled} /><label htmlFor="assinatura-obrigatoria" className="text-sm">Assinatura digital obrigatória para finalizar entrega</label></div>
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded"><input type="checkbox" id="salvar-cliente" checked={configGeral.perguntar_salvar_cliente} onChange={(e) => setConfigGeral({ ...configGeral, perguntar_salvar_cliente: e.target.checked })} disabled={disabled} /><label htmlFor="salvar-cliente" className="text-sm">Perguntar se quer salvar endereço/contato no cliente</label></div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-semibold text-sm mb-3">Integração Google Maps (preparado)</h4>
                <div><Label>Google Maps API Key</Label><Input type="password" placeholder="Chave de API do Google Maps" className="mt-2" value={configGeral.google_maps_api_key} onChange={(e) => setConfigGeral({ ...configGeral, google_maps_api_key: e.target.value })} disabled={disabled} /><p className="text-xs text-slate-500 mt-2">Será usado para roteirização e cálculo de rotas quando a integração estiver ativa.</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={() => salvarMutation.mutate()} disabled={disabled} className="bg-blue-600 hover:bg-blue-700" data-action="ConfiguracaoExpedicao.salvar" data-permission="Expedicao.Configuracoes.editar" data-context-required="true" data-sensitive="true">
          {salvarMutation.isPending ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}
