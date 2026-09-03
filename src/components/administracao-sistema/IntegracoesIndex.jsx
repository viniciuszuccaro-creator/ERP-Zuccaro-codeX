import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ContextoConfigBanner from "@/components/administracao-sistema/common/ContextoConfigBanner";
import HerancaConfigNotice from "@/components/administracao-sistema/common/HerancaConfigNotice";
import IntegracoesPanel from "@/components/administracao-sistema/configuracoes-gerais/IntegracoesPanel";
import TesteNFe from "@/components/integracoes/TesteNFe";
import TesteBoletos from "@/components/integracoes/TesteBoletos";
import ConfigWhatsAppBusiness from "@/components/integracoes/ConfigWhatsAppBusiness";
import TesteTransportadoras from "@/components/integracoes/TesteTransportadoras";
import TesteGoogleMaps from "@/components/integracoes/TesteGoogleMaps";
import StatusIntegracoes from "@/components/integracoes/StatusIntegracoes";

import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/lib/UserContext";
import { FileText, DollarSign, MessageCircle, Truck, Globe, ShoppingCart, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import SincronizacaoMarketplacesAtiva from "@/components/integracoes/SincronizacaoMarketplacesAtiva";
import usePermissions from "@/components/lib/usePermissions";

const sanitizeAuditText = (value, max = 300) => String(value ?? "")
  .replace(/[<>]/g, "")
  .replace(/javascript:/gi, "")
  .trim()
  .slice(0, max);

const SENSITIVE_AUDIT_KEY = /(token|senha|password|secret|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|certificado|private|webhook[_-]?url)/i;

const sanitizeAuditPayload = (value, keyName = "") => {
  if (SENSITIVE_AUDIT_KEY.test(keyName)) return { protegido: true };
  if (Array.isArray(value)) return value.map((item) => sanitizeAuditPayload(item, keyName));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        sanitizeAuditText(key, 80),
        sanitizeAuditPayload(item, key)
      ])
    );
  }
  return typeof value === "string" ? sanitizeAuditText(value, 500) : value;
};

export default function IntegracoesIndex({ initialTab }) {
  const { empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const { user } = useUser();
  const { isAdmin, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(initialTab || "gerenciamento");
  const [criandoBase, setCriandoBase] = useState(false);
  const [testandoWebhook, setTestandoWebhook] = useState(null);

  const grupoAtivoId = grupoAtual?.id
    || empresaAtual?.group_id
    || empresaAtual?.grupo_id
    || user?.grupo_atual_id
    || user?.grupo_padrao_id
    || (() => {
      try { return localStorage.getItem('group_atual_id'); } catch { return null; }
    })();
  const scopeId = empresaAtual?.id || grupoAtivoId || null;
  const scope = empresaAtual?.id
    ? { empresa_id: empresaAtual.id, group_id: grupoAtivoId || null }
    : grupoAtivoId
      ? { group_id: grupoAtivoId }
      : {};
  const scopeLabel = empresaAtual?.id ? "empresa atual" : grupoAtivoId ? "grupo atual" : "contexto atual";
  const integracoesKey = scopeId ? `integracoes_${scopeId}` : null;
  const integracoesQueryKey = ["configuracaoSistema", "integracoes", scopeId || "sem-contexto"];
  const contextoValido = !!grupoAtivoId;
  const podeEditarIntegracoes = isAdmin() || hasPermission("Sistema", "Integrações", "editar") || hasPermission("Sistema", "Integracoes", "editar");
  const podeCriarIntegracoes = isAdmin() || hasPermission("Sistema", "Integrações", "criar") || hasPermission("Sistema", "Integracoes", "criar");

  const auditIntegracao = async ({ acao, descricao, dadosNovos }) => {
    try {
      await createInContext("AuditLog", {
        usuario: user?.full_name || user?.email || "Usuario local",
        usuario_id: user?.id || null,
        empresa_id: empresaAtual?.id || null,
        group_id: grupoAtivoId || null,
        grupo_id: grupoAtivoId || null,
        acao: sanitizeAuditText(acao, 120),
        modulo: "Integracoes",
        entidade: "ConfiguracaoSistema",
        registro_id: integracoesKey || null,
        descricao: sanitizeAuditText(descricao, 500),
        dados_novos: sanitizeAuditPayload(dadosNovos || null),
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Falha ao auditar integracao:", error);
    }
  };

  const handleTabChange = (next) => {
    setTab(next);
    void auditIntegracao({
      acao: "Visualizacao",
      descricao: `Aba visualizada: ${sanitizeAuditText(next, 80)}`,
      dadosNovos: { tab: next },
    });
  };

  const { data: configuracao } = useQuery({
    queryKey: integracoesQueryKey,
    queryFn: async () => {
      if (!integracoesKey) return null;
      try {
        const res = await base44.functions.invoke('getEntityRecord', {
          entityName: 'ConfiguracaoSistema',
          group_id: grupoAtivoId || null,
          empresa_id: empresaAtual?.id || null,
          filter: { chave: integracoesKey, ...scope },
          limit: 1,
        });
        const list = Array.isArray(res?.data) ? res.data : [];
        return list[0] || null;
      } catch (error) {
        console.warn("[IntegracoesIndex] Falha ao consultar configuracao:", error);
        await auditIntegracao({
          acao: "Erro ao consultar",
          descricao: "Falha ao consultar configuracao de integracoes.",
          dadosNovos: { operacao: "consultar_configuracao" },
        });
        return null;
      }
    },
    enabled: contextoValido && !!integracoesKey,
    staleTime: 60000,
  });

  const nfeOk = !!configuracao?.integracao_nfe?.api_key;
  const boletosOk = !!configuracao?.integracao_boletos?.api_key;
  const webhookUrl = `${window?.location?.origin || ''}/functions/legacyIntegrationsMirror`;

  const handleCriarBase = async () => {
    if (!integracoesKey) {
      toast.error("Selecione um grupo ou empresa para criar a base de integracoes.");
      await auditIntegracao({
        acao: "Bloqueio sem contexto",
        descricao: "Tentativa de criar estrutura base de integracoes sem grupo ou empresa.",
        dadosNovos: { scope },
      });
      return;
    }
    if (!podeCriarIntegracoes) {
      toast.error("Seu perfil nao permite criar estrutura base de integracoes.");
      await auditIntegracao({
        acao: "Bloqueio por permissao",
        descricao: "Tentativa de criar estrutura base de integracoes sem permissao.",
        dadosNovos: { scope },
      });
      return;
    }

    setCriandoBase(true);
    try {
      const payload = {
        chave: integracoesKey,
        data: {
          chave: integracoesKey,
          categoria: 'Integracoes',
          integracao_nfe: { provedor: null, api_url: null, api_key: null, cnpj_emitente: null, ambiente: 'homologacao' },
          integracao_boletos: { provedor: null, api_url: null, api_key: null, customer_id_default: null, customers_map: {} }
        },
        scope
      };
      await base44.functions.invoke('upsertConfig', payload);
      await auditIntegracao({
        acao: "Criacao Base",
        descricao: `Estrutura base de integracoes criada para ${scopeLabel}`,
        dadosNovos: { operacao: "criar_base", categoria: "Integracoes", possui_nfe: true, possui_boletos: true }
      });
      await queryClient.invalidateQueries({ queryKey: integracoesQueryKey, exact: true });
      toast.success(`Estrutura base criada para ${scopeLabel}.`);
    } catch (err) {
      console.warn("[IntegracoesIndex] Falha ao criar estrutura base:", err);
      await auditIntegracao({
        acao: "Erro Criacao Base",
        descricao: "Falha ao criar estrutura base de integracoes.",
        dadosNovos: { operacao: "criar_base" },
      });
      toast.error("Erro ao criar estrutura base.");
    } finally {
      setCriandoBase(false);
    }
  };

  const handleTestWebhookAsaasPago = async () => {
    if (!scopeId) {
      toast.error("Selecione um grupo ou empresa para testar o webhook.");
      await auditIntegracao({
        acao: "Bloqueio sem contexto",
        descricao: "Tentativa de testar webhook Asaas sem grupo ou empresa.",
        dadosNovos: { provider: "asaas" },
      });
      return;
    }
    if (!podeEditarIntegracoes) {
      toast.error("Seu perfil nao permite testar webhooks de integracoes.");
      await auditIntegracao({
        acao: "Bloqueio por permissao",
        descricao: "Tentativa de testar webhook Asaas sem permissao.",
        dadosNovos: { provider: "asaas" },
      });
      return;
    }
    setTestandoWebhook("asaas");
    try {
      const payload = {
        provider: 'asaas',
        ...scope,
        payment: { id: 'test_payment', status: 'RECEIVED', value: 10 }
      };
      await base44.functions.invoke('legacyIntegrationsMirror', payload);
      await auditIntegracao({
        acao: "Teste Webhook",
        descricao: `Webhook Asaas simulado para ${scopeLabel}`,
        dadosNovos: { provider: "asaas", evento: "payment_received", simulacao: true }
      });
      toast.success(`Webhook Asaas simulado para ${scopeLabel}.`);
    } catch (err) {
      console.warn("[IntegracoesIndex] Falha ao simular webhook Asaas:", err);
      await auditIntegracao({
        acao: "Erro Teste Webhook",
        descricao: "Falha ao simular webhook Asaas.",
        dadosNovos: { provider: "asaas", simulacao: true },
      });
      toast.error("Erro ao simular webhook Asaas.");
    } finally {
      setTestandoWebhook(null);
    }
  };

  const handleTestWebhookNFeAutorizada = async () => {
    if (!scopeId) {
      toast.error("Selecione um grupo ou empresa para testar o webhook.");
      await auditIntegracao({
        acao: "Bloqueio sem contexto",
        descricao: "Tentativa de testar webhook NF-e sem grupo ou empresa.",
        dadosNovos: { provider: "enotas" },
      });
      return;
    }
    if (!podeEditarIntegracoes) {
      toast.error("Seu perfil nao permite testar webhooks de integracoes.");
      await auditIntegracao({
        acao: "Bloqueio por permissao",
        descricao: "Tentativa de testar webhook NF-e sem permissao.",
        dadosNovos: { provider: "enotas" },
      });
      return;
    }
    setTestandoWebhook("nfe");
    try {
      const payload = {
        provider: 'enotas',
        ...scope,
        nfeId: 'test_nf',
        status: 'autorizada'
      };
      await base44.functions.invoke('legacyIntegrationsMirror', payload);
      await auditIntegracao({
        acao: "Teste Webhook",
        descricao: `Webhook NF-e simulado para ${scopeLabel}`,
        dadosNovos: { provider: "enotas", evento: "nfe_authorized", simulacao: true }
      });
      toast.success(`Webhook NF-e simulado para ${scopeLabel}.`);
    } catch (err) {
      console.warn("[IntegracoesIndex] Falha ao simular webhook NF-e:", err);
      await auditIntegracao({
        acao: "Erro Teste Webhook",
        descricao: "Falha ao simular webhook NF-e.",
        dadosNovos: { provider: "enotas", simulacao: true },
      });
      toast.error("Erro ao simular webhook NF-e.");
    } finally {
      setTestandoWebhook(null);
    }
  };

  const handleCopy = async (text) => {
    if (!contextoValido || !podeEditarIntegracoes) {
      toast.error("Selecione um contexto e confirme permissao antes de copiar URL sensivel.");
      await auditIntegracao({
        acao: contextoValido ? "Bloqueio por permissao" : "Bloqueio sem contexto",
        descricao: "Tentativa de copiar URL de webhook sem contexto/permissao.",
        dadosNovos: { recurso: "legacyIntegrationsMirror" },
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      await auditIntegracao({
        acao: "Copiar URL Webhook",
        descricao: `URL de webhook copiada para ${scopeLabel}`,
        dadosNovos: { recurso: "legacyIntegrationsMirror" },
      });
      toast.success("URL copiada.");
    } catch (error) {
      console.warn("[IntegracoesIndex] Falha ao copiar URL:", error);
      await auditIntegracao({
        acao: "Erro Copiar URL Webhook",
        descricao: "Falha ao copiar URL de webhook.",
        dadosNovos: { recurso: "legacyIntegrationsMirror" },
      });
      toast.error("Nao foi possivel copiar a URL.");
    }
  };

   return (
    <div className="w-full h-full flex flex-col">
      <Tabs value={tab} onValueChange={handleTabChange} className="w-full h-full">
        <TabsList className="flex flex-wrap gap-2 h-auto">
          <TabsTrigger value="gerenciamento" data-action="Integracoes.tab.gerenciamento" data-permission="Sistema.Integracoes.visualizar" data-context-required="group-or-company"><CheckCircle2 className="w-4 h-4 mr-2" />Gerenciamento</TabsTrigger>
          <TabsTrigger value="status" data-action="Integracoes.tab.status" data-permission="Sistema.Integracoes.visualizar" data-context-required="group-or-company"><CheckCircle2 className="w-4 h-4 mr-2" />Status</TabsTrigger>
          <TabsTrigger value="nfe" data-action="Integracoes.tab.nfe" data-permission="Sistema.Integracoes.visualizar" data-context-required="group-or-company"><FileText className="w-4 h-4 mr-2" />NF-e</TabsTrigger>
          <TabsTrigger value="boletos" data-action="Integracoes.tab.boletos" data-permission="Sistema.Integracoes.visualizar" data-context-required="group-or-company"><DollarSign className="w-4 h-4 mr-2" />Boletos/PIX</TabsTrigger>
          <TabsTrigger value="whatsapp" data-action="Integracoes.tab.whatsapp" data-permission="Sistema.Integracoes.visualizar" data-context-required="group-or-company"><MessageCircle className="w-4 h-4 mr-2" />WhatsApp</TabsTrigger>
          <TabsTrigger value="transportadoras" data-action="Integracoes.tab.transportadoras" data-permission="Sistema.Integracoes.visualizar" data-context-required="group-or-company"><Truck className="w-4 h-4 mr-2" />Transportadoras</TabsTrigger>
          <TabsTrigger value="maps" data-action="Integracoes.tab.maps" data-permission="Sistema.Integracoes.visualizar" data-context-required="group-or-company"><Globe className="w-4 h-4 mr-2" />Maps</TabsTrigger>
          <TabsTrigger value="marketplaces" data-action="Integracoes.tab.marketplaces" data-permission="Sistema.Integracoes.visualizar" data-context-required="group-or-company"><ShoppingCart className="w-4 h-4 mr-2" />Marketplaces</TabsTrigger>
        </TabsList>

        <TabsContent value="gerenciamento" className="mt-4">
          <Card className="w-full">
            <CardContent className="p-4">
              <div className="w-full mb-3 space-y-2">
                <ContextoConfigBanner />
                <HerancaConfigNotice />
              </div>
              <div className="w-full mb-4">
                <IntegracoesPanel />
              </div>

              {/* Checklist de Implantação Global */}
              <Card className="w-full mb-4">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold mb-2">Checklist de Implantacao ({scopeLabel})</h3>
                    {!configuracao && (
                      <Button
                        variant="outline"
                        onClick={handleCriarBase}
                        disabled={criandoBase || !contextoValido || !podeCriarIntegracoes}
                        data-action="Integracoes.criarEstruturaBase"
                        data-permission="Sistema.Integracoes.criar"
                        data-sensitive="true"
                      >
                        {criandoBase ? "Criando..." : "Criar estrutura base"}
                      </Button>
                    )}
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      {nfeOk ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                      )}
                      <span>NF-e: provedor e API key {nfeOk ? 'configurados' : 'pendentes'} em ConfiguracaoSistema para o {scopeLabel}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      {boletosOk ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                      )}
                      <span>Boletos/PIX: provedor e API key {boletosOk ? 'configurados' : 'pendentes'} (Asaas/Juno)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600" />
                      <span>Webhooks: aponte para <code className="px-1 py-0.5 bg-slate-100 rounded">functions/legacyIntegrationsMirror</code> com header <code className="px-1 py-0.5 bg-slate-100 rounded">x-internal-token: DEPLOY_AUDIT_TOKEN</code> (definido no ambiente).</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600" />
                      <span>RBAC/Testes: valide permissões de emissão e execute testes E2E (NF-e/Boletos/PIX) — Auditoria registra tudo.</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Webhooks & Testes Rápidos */}
              <Card className="w-full mb-4">
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold">Webhooks & Testes Rápidos</h3>
                  <div className="flex items-center gap-2 text-xs">
                    <code className="px-2 py-1 bg-slate-100 rounded flex-1 overflow-x-auto">{webhookUrl}</code>
                    <Button size="sm" variant="outline" onClick={() => handleCopy(webhookUrl)} disabled={!contextoValido || !podeEditarIntegracoes} data-action="Integracoes.webhook.copiarUrl" data-permission="Sistema.Integracoes.editar" data-context-required="group-or-company" data-sensitive="true">Copiar URL</Button>
                  </div>
                  <div className="text-xs text-slate-600">Header: x-internal-token: <span className="font-mono">DEPLOY_AUDIT_TOKEN</span></div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={handleTestWebhookAsaasPago} disabled={testandoWebhook === "asaas" || !contextoValido || !podeEditarIntegracoes} data-action="Integracoes.webhook.testarAsaasPago" data-permission="Sistema.Integracoes.editar" data-sensitive="true">
                      {testandoWebhook === "asaas" ? "Testando..." : "Testar webhook Asaas (pago)"}
                    </Button>
                    <Button size="sm" onClick={handleTestWebhookNFeAutorizada} disabled={testandoWebhook === "nfe" || !contextoValido || !podeEditarIntegracoes} data-action="Integracoes.webhook.simularNFeAutorizada" data-permission="Sistema.Integracoes.editar" data-sensitive="true">
                      {testandoWebhook === "nfe" ? "Simulando..." : "Simular NF-e autorizada"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Atalho para Cadastros Gerais — evita duplicação */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                💡 <strong>Configurações de NF-e, Boletos, WhatsApp, APIs Externas e Webhooks</strong> estão centralizadas em <strong>Cadastros Gerais → Tecnologia, IA & Parâmetros</strong>. Use os links das abas acima (NF-e, Boletos/PIX, WhatsApp, etc.) para testes e configurações técnicas.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="mt-4">
          <Card className="w-full"><CardContent className="p-4"><StatusIntegracoes empresaId={empresaAtual?.id} groupId={grupoAtivoId} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="nfe" className="mt-4">
          <Card className="w-full"><CardContent className="p-4"><TesteNFe configuracao={configuracao} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="boletos" className="mt-4">
          <Card className="w-full"><CardContent className="p-4"><TesteBoletos configuracao={configuracao} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="whatsapp" className="mt-4">
          <Card className="w-full"><CardContent className="p-4"><ConfigWhatsAppBusiness empresaId={empresaAtual?.id} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="transportadoras" className="mt-4">
          <Card className="w-full"><CardContent className="p-4"><TesteTransportadoras configuracao={configuracao} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="maps" className="mt-4">
          <Card className="w-full"><CardContent className="p-4"><TesteGoogleMaps configuracao={configuracao} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="marketplaces" className="mt-4">
          <Card className="w-full"><CardContent className="p-4"><SincronizacaoMarketplacesAtiva /></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
